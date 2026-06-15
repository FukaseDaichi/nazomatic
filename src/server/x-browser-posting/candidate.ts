import crypto from "crypto";

import { firestore } from "@/server/firebase/admin";
import { isRealtimeEventVisible } from "@/server/realtime/syndication/visibility";
import {
  composeBrowserPostText,
  suggestBrowserPostComment,
} from "@/server/x-browser-posting/comment";

const CAPTURE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CANDIDATES = 50;
const ACCOUNT_COLLECTION = "xBrowserPostingAccounts";
const EVENTS_COLLECTION = "realtimeEvents";

export const DEFAULT_BROWSER_POST_HASHTAG = "#謎チケ売ります";
export const DEFAULT_BROWSER_POST_COOLDOWN_MINUTES = 120;
export const MIN_BROWSER_POST_COOLDOWN_MINUTES = 30;
export const DEFAULT_BROWSER_POST_DAILY_LIMIT = 6;
export const MAX_BROWSER_POST_DAILY_LIMIT = 8;
export const DEFAULT_BROWSER_POST_WEEKLY_LIMIT = 30;
export const DEFAULT_BROWSER_POST_MAX_PER_RUN = 1;
export const MAX_BROWSER_POST_MAX_PER_RUN = 1;
export const DEFAULT_BROWSER_POST_LEASE_MINUTES = 10;

export type BrowserPostStatus = "posted" | "skipped" | "failed";
export type BrowserPostConfirmationMode = "interactive" | "unattended";
export type BrowserPostQuoteMode = "post_url" | "quote_ui";

export type BrowserPostCandidateSummary = {
  pickedEventId: string;
  postId: string | null;
  postURL: string | null;
  hashtags: string[];
  capturedAt: string | null;
  eventTime: string | null;
  ticketTitle: string | null;
  category: string | null;
  price: unknown;
  quantity: number | null;
  deliveryMethod: string | null;
  location: string | null;
  authorName: string | null;
  rawPostText: string | null;
};

export type PrepareBrowserPostParams = {
  hashtag: string;
  accountHandle: string;
  dryRun: boolean;
  reservedBy?: string | null;
  cooldownMinutes?: number | null;
  dailyLimit?: number | null;
  maxPerRun?: number | null;
};

export type PrepareBrowserPostResult = BrowserPostCandidateSummary & {
  reservationId: string;
  accountHandle: string;
  dryRun: boolean;
  suggestedComment: string;
  composedText: string;
  reservedUntil: string | null;
  rateLimit: {
    cooldownMinutes: number;
    dailyLimit: number;
    maxPerRun: number;
  };
};

export type ConfirmBrowserPostParams = {
  eventId: string;
  reservationId: string;
  accountHandle: string;
  status: BrowserPostStatus;
  quoteText?: string | null;
  quoteMode?: BrowserPostQuoteMode | null;
  postedPostURL?: string | null;
  postedPostId?: string | null;
  confirmationMode?: BrowserPostConfirmationMode | null;
  selectorProfileVersion?: string | null;
  error?: string | null;
};

export type ConfirmBrowserPostResult = {
  eventId: string;
  accountHandle: string;
  status: BrowserPostStatus;
  postedAt: string | null;
  lastReviewedAt: string | null;
};

export class BrowserPostConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserPostConfigError";
  }
}

export class BrowserPostRateLimitError extends Error {
  retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "BrowserPostRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class BrowserPostReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserPostReservationError";
  }
}

export async function pickRealtimeEventCandidate(hashtag: string) {
  const variants = buildHashtagVariants(hashtag);
  const cutoff = new Date(Date.now() - CAPTURE_WINDOW_MS);

  for (const variant of variants) {
    const snapshot = await firestore
      .collection(EVENTS_COLLECTION)
      .where("capturedAt", ">=", cutoff)
      .where("lastReviewedAt", "==", null)
      .where("hashtags", "array-contains", variant)
      .orderBy("capturedAt", "desc")
      .limit(MAX_CANDIDATES)
      .get();

    const doc = snapshot.docs.find((entry) =>
      isCandidateAvailable(entry.data(), new Date())
    );
    if (doc) {
      return doc;
    }
  }

  return null;
}

export async function prepareBrowserPostCandidate(
  params: PrepareBrowserPostParams
): Promise<PrepareBrowserPostResult | null> {
  const normalized = normalizePrepareParams(params);
  const now = new Date();
  const reservationId = crypto.randomUUID();
  const reservedUntil = new Date(
    now.getTime() + DEFAULT_BROWSER_POST_LEASE_MINUTES * 60 * 1000
  );

  if (normalized.dryRun) {
    const candidate = await pickRealtimeEventCandidate(normalized.hashtag);
    return candidate
      ? buildPrepareResponse({
          doc: candidate,
          accountHandle: normalized.accountHandle,
          reservationId,
          dryRun: true,
          reservedUntil: null,
          rateLimit: normalized.rateLimit,
        })
      : null;
  }

  return firestore.runTransaction(async (transaction) => {
    const accountRef = firestore
      .collection(ACCOUNT_COLLECTION)
      .doc(normalized.accountHandle);
    const accountSnapshot = await transaction.get(accountRef);
    assertCanReserveAccount({
      accountData: accountSnapshot.exists ? accountSnapshot.data() ?? {} : {},
      now,
      rateLimit: normalized.rateLimit,
    });

    const candidate = await pickRealtimeEventCandidateInTransaction(
      transaction,
      normalized.hashtag,
      now
    );
    if (!candidate) {
      return null;
    }

    transaction.set(
      candidate.ref,
      {
        xBrowserPost: {
          status: "leased",
          reservationId,
          reservedAt: now,
          reservedUntil,
          reservedBy: normalized.reservedBy,
          accountHandle: normalized.accountHandle,
        },
      },
      { merge: true }
    );

    transaction.set(
      accountRef,
      {
        accountHandle: normalized.accountHandle,
        activeReservationId: reservationId,
        activeReservationEventId: candidate.id,
        activeReservationUntil: reservedUntil,
        updatedAt: now,
      },
      { merge: true }
    );

    return buildPrepareResponse({
      doc: candidate,
      accountHandle: normalized.accountHandle,
      reservationId,
      dryRun: false,
      reservedUntil,
      rateLimit: normalized.rateLimit,
    });
  });
}

export async function confirmBrowserPostResult(
  params: ConfirmBrowserPostParams
): Promise<ConfirmBrowserPostResult> {
  const normalized = normalizeConfirmParams(params);
  const now = new Date();

  return firestore.runTransaction(async (transaction) => {
    const eventRef = firestore
      .collection(EVENTS_COLLECTION)
      .doc(normalized.eventId);
    const accountRef = firestore
      .collection(ACCOUNT_COLLECTION)
      .doc(normalized.accountHandle);

    const [eventSnapshot, accountSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(accountRef),
    ]);

    if (!eventSnapshot.exists) {
      throw new BrowserPostReservationError("Reserved event does not exist");
    }

    const eventData = eventSnapshot.data() ?? {};
    const currentReservation = readString(
      eventData.xBrowserPost,
      "reservationId"
    );
    if (currentReservation !== normalized.reservationId) {
      throw new BrowserPostReservationError("Reservation id does not match");
    }

    const postedAt = normalized.status === "posted" ? now : null;
    const lastReviewedAt =
      normalized.status === "posted" || normalized.status === "skipped"
        ? now
        : null;

    transaction.set(
      eventRef,
      {
        ...(lastReviewedAt ? { lastReviewedAt } : {}),
        xBrowserPost: {
          status: normalized.status,
          reservationId: normalized.reservationId,
          accountHandle: normalized.accountHandle,
          quoteText: normalized.quoteText,
          quoteMode: normalized.quoteMode,
          postedAt,
          postedPostURL: normalized.postedPostURL,
          postedPostId: normalized.postedPostId,
          confirmationMode: normalized.confirmationMode,
          selectorProfileVersion: normalized.selectorProfileVersion,
          error: normalized.error,
          confirmedAt: now,
          reservedAt: eventData.xBrowserPost?.reservedAt ?? null,
          reservedUntil: eventData.xBrowserPost?.reservedUntil ?? null,
        },
      },
      { merge: true }
    );

    const accountUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> =
      {
        activeReservationId: null,
        activeReservationEventId: null,
        activeReservationUntil: null,
        updatedAt: now,
      };

    if (normalized.status === "posted") {
      Object.assign(
        accountUpdate,
        buildPostedAccountUpdate(accountSnapshot.data() ?? {}, now)
      );
    }

    transaction.set(accountRef, accountUpdate, { merge: true });

    return {
      eventId: normalized.eventId,
      accountHandle: normalized.accountHandle,
      status: normalized.status,
      postedAt: postedAt ? postedAt.toISOString() : null,
      lastReviewedAt: lastReviewedAt ? lastReviewedAt.toISOString() : null,
    };
  });
}

export function buildHashtagVariants(rawHashtag: string) {
  const trimmed = rawHashtag.trim();
  if (!trimmed) {
    return [] as string[];
  }

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const withoutHash = withHash.replace(/^#/, "");

  const variants = new Map<string, true>();
  variants.set(withHash, true);
  if (withoutHash && withoutHash !== withHash) {
    variants.set(withoutHash, true);
  }

  return Array.from(variants.keys());
}

export function normalizeAccountHandle(rawHandle: string) {
  const normalized = rawHandle.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized)) {
    throw new BrowserPostConfigError(
      "accountHandle must be a valid X handle"
    );
  }
  return normalized;
}

function normalizePrepareParams(params: PrepareBrowserPostParams) {
  const hashtag = params.hashtag.trim() || DEFAULT_BROWSER_POST_HASHTAG;
  const variants = buildHashtagVariants(hashtag);
  if (variants.length === 0) {
    throw new BrowserPostConfigError("hashtag must not be empty");
  }

  return {
    hashtag,
    accountHandle: normalizeAccountHandle(params.accountHandle),
    dryRun: params.dryRun,
    reservedBy: params.reservedBy?.trim() || null,
    rateLimit: normalizeRateLimitSettings(params),
  };
}

function normalizeConfirmParams(params: ConfirmBrowserPostParams) {
  const eventId = params.eventId.trim();
  if (!eventId) {
    throw new BrowserPostConfigError("eventId is required");
  }
  const reservationId = params.reservationId.trim();
  if (!reservationId) {
    throw new BrowserPostConfigError("reservationId is required");
  }

  return {
    eventId,
    reservationId,
    accountHandle: normalizeAccountHandle(params.accountHandle),
    status: params.status,
    quoteText: normalizeNullableString(params.quoteText),
    quoteMode: params.quoteMode ?? "post_url",
    postedPostURL: normalizeNullableString(params.postedPostURL),
    postedPostId: normalizeNullableString(params.postedPostId),
    confirmationMode: params.confirmationMode ?? "interactive",
    selectorProfileVersion: normalizeNullableString(
      params.selectorProfileVersion
    ),
    error: normalizeNullableString(params.error),
  };
}

function normalizeRateLimitSettings(params: {
  cooldownMinutes?: number | null;
  dailyLimit?: number | null;
  maxPerRun?: number | null;
}) {
  const cooldownMinutes =
    params.cooldownMinutes ?? DEFAULT_BROWSER_POST_COOLDOWN_MINUTES;
  const dailyLimit = params.dailyLimit ?? DEFAULT_BROWSER_POST_DAILY_LIMIT;
  const maxPerRun = params.maxPerRun ?? DEFAULT_BROWSER_POST_MAX_PER_RUN;

  if (
    !Number.isFinite(cooldownMinutes) ||
    cooldownMinutes < MIN_BROWSER_POST_COOLDOWN_MINUTES
  ) {
    throw new BrowserPostConfigError(
      `cooldownMinutes must be at least ${MIN_BROWSER_POST_COOLDOWN_MINUTES}`
    );
  }
  if (
    !Number.isFinite(dailyLimit) ||
    dailyLimit < 1 ||
    dailyLimit > MAX_BROWSER_POST_DAILY_LIMIT
  ) {
    throw new BrowserPostConfigError(
      `dailyLimit must be between 1 and ${MAX_BROWSER_POST_DAILY_LIMIT}`
    );
  }
  if (
    !Number.isFinite(maxPerRun) ||
    maxPerRun < 1 ||
    maxPerRun > MAX_BROWSER_POST_MAX_PER_RUN
  ) {
    throw new BrowserPostConfigError(
      `maxPerRun must be ${MAX_BROWSER_POST_MAX_PER_RUN}`
    );
  }

  return {
    cooldownMinutes: Math.floor(cooldownMinutes),
    dailyLimit: Math.floor(dailyLimit),
    maxPerRun: Math.floor(maxPerRun),
  };
}

async function pickRealtimeEventCandidateInTransaction(
  transaction: FirebaseFirestore.Transaction,
  hashtag: string,
  now: Date
) {
  const variants = buildHashtagVariants(hashtag);
  const cutoff = new Date(now.getTime() - CAPTURE_WINDOW_MS);

  for (const variant of variants) {
    const query = firestore
      .collection(EVENTS_COLLECTION)
      .where("capturedAt", ">=", cutoff)
      .where("lastReviewedAt", "==", null)
      .where("hashtags", "array-contains", variant)
      .orderBy("capturedAt", "desc")
      .limit(MAX_CANDIDATES);

    const snapshot = await transaction.get(query);
    const doc = snapshot.docs.find((entry) =>
      isCandidateAvailable(entry.data(), now)
    );
    if (doc) {
      return doc;
    }
  }

  return null;
}

function isCandidateAvailable(
  data: FirebaseFirestore.DocumentData,
  now: Date
) {
  if (!isRealtimeEventVisible(data)) {
    return false;
  }

  const status = readString(data.xBrowserPost, "status");
  if (status === "posted" || status === "skipped") {
    return false;
  }

  if (status === "leased") {
    const reservedUntil = readDate(data.xBrowserPost, "reservedUntil");
    if (reservedUntil && reservedUntil.getTime() > now.getTime()) {
      return false;
    }
  }

  return true;
}

function assertCanReserveAccount({
  accountData,
  now,
  rateLimit,
}: {
  accountData: FirebaseFirestore.DocumentData;
  now: Date;
  rateLimit: {
    cooldownMinutes: number;
    dailyLimit: number;
  };
}) {
  const activeReservationUntil = readDate(accountData, "activeReservationUntil");
  if (
    activeReservationUntil &&
    activeReservationUntil.getTime() > now.getTime()
  ) {
    throw new BrowserPostRateLimitError(
      "Another browser post reservation is still active",
      secondsUntil(activeReservationUntil, now)
    );
  }

  const lastPostedAt = readDate(accountData, "lastPostedAt");
  if (lastPostedAt) {
    const nextAllowedAt = new Date(
      lastPostedAt.getTime() + rateLimit.cooldownMinutes * 60 * 1000
    );
    if (nextAllowedAt.getTime() > now.getTime()) {
      throw new BrowserPostRateLimitError(
        "Browser post cooldown is active",
        secondsUntil(nextAllowedAt, now)
      );
    }
  }

  const dailyKey = buildUtcDateKey(now);
  const dailyCount =
    readString(accountData, "dailyKey") === dailyKey
      ? readNumber(accountData, "dailyCount")
      : 0;
  if (dailyCount >= rateLimit.dailyLimit) {
    throw new BrowserPostRateLimitError(
      "Daily browser post limit has been reached",
      secondsUntil(nextUtcDay(now), now)
    );
  }

  const weeklyKey = buildUtcWeekKey(now);
  const weeklyCount =
    readString(accountData, "weeklyKey") === weeklyKey
      ? readNumber(accountData, "weeklyCount")
      : 0;
  if (weeklyCount >= DEFAULT_BROWSER_POST_WEEKLY_LIMIT) {
    throw new BrowserPostRateLimitError(
      "Weekly browser post limit has been reached",
      secondsUntil(nextUtcWeek(now), now)
    );
  }
}

function buildPrepareResponse({
  doc,
  accountHandle,
  reservationId,
  dryRun,
  reservedUntil,
  rateLimit,
}: {
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>;
  accountHandle: string;
  reservationId: string;
  dryRun: boolean;
  reservedUntil: Date | null;
  rateLimit: {
    cooldownMinutes: number;
    dailyLimit: number;
    maxPerRun: number;
  };
}): PrepareBrowserPostResult {
  const candidate = mapDocToCandidateSummary(doc);
  const suggestedComment = suggestBrowserPostComment();
  const composedText = candidate.postURL
    ? composeBrowserPostText(suggestedComment, candidate.postURL)
    : suggestedComment;

  return {
    ...candidate,
    reservationId,
    accountHandle,
    dryRun,
    suggestedComment,
    composedText,
    reservedUntil: reservedUntil ? reservedUntil.toISOString() : null,
    rateLimit,
  };
}

function mapDocToCandidateSummary(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
): BrowserPostCandidateSummary {
  const data = doc.data();
  return {
    pickedEventId: doc.id,
    postId: readString(data, "postId"),
    postURL: readString(data, "postURL"),
    hashtags: Array.isArray(data.hashtags)
      ? data.hashtags.filter((tag: unknown) => typeof tag === "string")
      : [],
    capturedAt: readDate(data, "capturedAt")?.toISOString() ?? null,
    eventTime: readDate(data, "eventTime")?.toISOString() ?? null,
    ticketTitle: readString(data, "ticketTitle"),
    category: readString(data, "category"),
    price: data.price ?? null,
    quantity: typeof data.quantity === "number" ? data.quantity : null,
    deliveryMethod: readString(data, "deliveryMethod"),
    location: readString(data, "location"),
    authorName: readString(data, "authorName"),
    rawPostText: readString(data, "rawPostText"),
  };
}

function buildPostedAccountUpdate(
  accountData: FirebaseFirestore.DocumentData,
  now: Date
) {
  const dailyKey = buildUtcDateKey(now);
  const weeklyKey = buildUtcWeekKey(now);

  return {
    lastPostedAt: now,
    dailyKey,
    dailyCount:
      readString(accountData, "dailyKey") === dailyKey
        ? readNumber(accountData, "dailyCount") + 1
        : 1,
    weeklyKey,
    weeklyCount:
      readString(accountData, "weeklyKey") === weeklyKey
        ? readNumber(accountData, "weeklyCount") + 1
        : 1,
  };
}

function buildUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildUtcWeekKey(date: Date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((start.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${start.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function nextUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
  );
}

function nextUtcWeek(date: Date) {
  const next = nextUtcDay(date);
  while (next.getUTCDay() !== 1) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function secondsUntil(target: Date, now: Date) {
  return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));
}

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function readString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function readNumber(obj: unknown, key: string): number {
  if (!obj || typeof obj !== "object") {
    return 0;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readDate(obj: unknown, key: string): Date | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  if (value instanceof Date) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

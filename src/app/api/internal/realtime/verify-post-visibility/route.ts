import { NextResponse } from "next/server";

import { firestore } from "@/server/firebase/admin";
import {
  SYNDICATION_HIDDEN_REASON_DELETED,
  computeNextSyndicationCheckAt,
  getSyndicationErrorCount,
  isRealtimeEventVisible,
  readDateValue,
  shouldBootstrapSyndicationState,
  shouldCheckSyndicationNow,
} from "@/server/realtime/syndication/visibility";
import {
  verifyPostAvailability,
  type VerifiedPostAvailability,
} from "@/server/realtime/syndication/verifyPost";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 200;
const DEFAULT_MAX_CONCURRENCY = 5;
const MAX_MAX_CONCURRENCY = 10;
const DEFAULT_BOOTSTRAP_SCAN_LIMIT = 500;
const MAX_BOOTSTRAP_SCAN_LIMIT = 2000;
const MAX_BATCH_OPERATIONS = 450;
const ACTIVE_EVENT_LOOKBACK_DAYS = 1;
const SCHEDULED_SCAN_MULTIPLIER = 3;

type VerifyPostVisibilityRequest = {
  batchSize?: number;
  maxConcurrency?: number;
  bootstrapScanLimit?: number;
  dryRun?: boolean;
};

type VerifyCandidate = {
  postId: string;
};

type VerifyPostVisibilityResponse = {
  dryRun: boolean;
  processedPostIds: number;
  available: number;
  deleted: number;
  unknown: number;
  updatedDocs: number;
  bootstrapCandidates: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceAuthorization(request);

    const body = await parseBody(request);
    const params = validateBody(body);
    const now = new Date();

    const { candidates, bootstrapCandidates } = await collectCandidates({
      batchSize: params.batchSize,
      bootstrapScanLimit: params.bootstrapScanLimit,
      now,
    });

    if (candidates.length === 0) {
      return NextResponse.json<VerifyPostVisibilityResponse>({
        dryRun: params.dryRun,
        processedPostIds: 0,
        available: 0,
        deleted: 0,
        unknown: 0,
        updatedDocs: 0,
        bootstrapCandidates,
      });
    }

    const results = await mapWithConcurrency(
      candidates,
      params.maxConcurrency,
      async (candidate) => ({
        postId: candidate.postId,
        status: await verifyPostAvailability(candidate.postId),
      })
    );

    const counts = summarizeResults(results);

    if (params.dryRun) {
      return NextResponse.json<VerifyPostVisibilityResponse>({
        dryRun: true,
        processedPostIds: results.length,
        available: counts.available,
        deleted: counts.deleted,
        unknown: counts.unknown,
        updatedDocs: 0,
        bootstrapCandidates,
      });
    }

    const updatedDocs = await applyVerificationResults(results, now);

    return NextResponse.json<VerifyPostVisibilityResponse>({
      dryRun: false,
      processedPostIds: results.length,
      available: counts.available,
      deleted: counts.deleted,
      unknown: counts.unknown,
      updatedDocs,
      bootstrapCandidates,
    });
  } catch (error) {
    return handleError(error);
  }
}

async function collectCandidates({
  batchSize,
  bootstrapScanLimit,
  now,
}: {
  batchSize: number;
  bootstrapScanLimit: number;
  now: Date;
}) {
  const candidates = new Map<string, VerifyCandidate>();

  const scheduledSnapshot = await firestore
    .collection("realtimeEvents")
    .where("syndicationNextCheckAt", "<=", now)
    .orderBy("syndicationNextCheckAt", "asc")
    .limit(Math.max(batchSize, batchSize * SCHEDULED_SCAN_MULTIPLIER))
    .get();

  addCandidatesFromSnapshot({
    snapshot: scheduledSnapshot,
    candidates,
    batchSize,
    now,
    mode: "scheduled",
  });

  let bootstrapCandidates = 0;

  if (candidates.size < batchSize) {
    const bootstrapSnapshot = await firestore
      .collection("realtimeEvents")
      .where("eventTime", ">=", getActiveEventCutoff(now))
      .orderBy("eventTime", "asc")
      .limit(bootstrapScanLimit)
      .get();

    bootstrapCandidates = addCandidatesFromSnapshot({
      snapshot: bootstrapSnapshot,
      candidates,
      batchSize,
      now,
      mode: "bootstrap",
    });
  }

  return {
    candidates: Array.from(candidates.values()),
    bootstrapCandidates,
  };
}

function addCandidatesFromSnapshot({
  snapshot,
  candidates,
  batchSize,
  now,
  mode,
}: {
  snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
  candidates: Map<string, VerifyCandidate>;
  batchSize: number;
  now: Date;
  mode: "scheduled" | "bootstrap";
}) {
  let added = 0;

  for (const doc of snapshot.docs) {
    if (candidates.size >= batchSize) {
      break;
    }

    const data = doc.data();
    const postId = extractPostId(data);

    if (!postId || candidates.has(postId) || !isRealtimeEventVisible(data)) {
      continue;
    }

    if (mode === "scheduled" && !shouldCheckSyndicationNow(data, now)) {
      continue;
    }

    if (mode === "bootstrap" && !shouldBootstrapSyndicationState(data)) {
      continue;
    }

    candidates.set(postId, { postId });
    added += 1;
  }

  return added;
}

function summarizeResults(
  results: Array<{ postId: string; status: VerifiedPostAvailability }>
) {
  return results.reduce(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    {
      available: 0,
      deleted: 0,
      unknown: 0,
    } satisfies Record<VerifiedPostAvailability, number>
  );
}

async function applyVerificationResults(
  results: Array<{ postId: string; status: VerifiedPostAvailability }>,
  now: Date
) {
  let updatedDocs = 0;
  let operationCount = 0;
  let batch = firestore.batch();

  for (const result of results) {
    const snapshot = await firestore
      .collection("realtimeEvents")
      .where("postId", "==", result.postId)
      .get();

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, buildUpdatePayload(doc.data(), result.status, now));
      updatedDocs += 1;
      operationCount += 1;

      if (operationCount >= MAX_BATCH_OPERATIONS) {
        await batch.commit();
        batch = firestore.batch();
        operationCount = 0;
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return updatedDocs;
}

function buildUpdatePayload(
  data: FirebaseFirestore.DocumentData,
  status: VerifiedPostAvailability,
  now: Date
) {
  const eventTime = readDateValue(data.eventTime);

  if (status === "available") {
    return {
      isVisible: true,
      hiddenReason: null,
      hiddenAt: null,
      syndicationStatus: "available",
      syndicationCheckedAt: now,
      syndicationNextCheckAt: computeNextSyndicationCheckAt({
        now,
        eventTime,
      }),
      syndicationErrorCount: 0,
    };
  }

  if (status === "deleted") {
    return {
      isVisible: false,
      hiddenReason: SYNDICATION_HIDDEN_REASON_DELETED,
      hiddenAt: now,
      syndicationStatus: "deleted",
      syndicationCheckedAt: now,
      syndicationNextCheckAt: null,
      syndicationErrorCount: 0,
    };
  }

  const errorCount = getSyndicationErrorCount(data) + 1;

  return {
    syndicationStatus: "unknown",
    syndicationCheckedAt: now,
    syndicationNextCheckAt: computeNextSyndicationCheckAt({
      now,
      eventTime,
      errorCount,
    }),
    syndicationErrorCount: errorCount,
  };
}

async function parseBody(
  request: Request
): Promise<VerifyPostVisibilityRequest> {
  if (request.body === null) {
    return {};
  }

  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") {
      return parsed as VerifyPostVisibilityRequest;
    }

    throw new Error("Body must be an object");
  } catch {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

function validateBody(body: VerifyPostVisibilityRequest) {
  return {
    batchSize: clampInteger(
      body.batchSize,
      DEFAULT_BATCH_SIZE,
      1,
      MAX_BATCH_SIZE,
      "batchSize"
    ),
    maxConcurrency: clampInteger(
      body.maxConcurrency,
      DEFAULT_MAX_CONCURRENCY,
      1,
      MAX_MAX_CONCURRENCY,
      "maxConcurrency"
    ),
    bootstrapScanLimit: clampInteger(
      body.bootstrapScanLimit,
      DEFAULT_BOOTSTRAP_SCAN_LIMIT,
      1,
      MAX_BOOTSTRAP_SCAN_LIMIT,
      "bootstrapScanLimit"
    ),
    dryRun: Boolean(body.dryRun),
  };
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  fieldName: string
) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: `${fieldName} must be a finite number` },
      { status: 400 }
    );
  }

  const normalized = Math.floor(value);
  if (normalized < min) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: `${fieldName} must be at least ${min}` },
      { status: 400 }
    );
  }

  return Math.min(normalized, max);
}

function extractPostId(data: FirebaseFirestore.DocumentData) {
  const postId = typeof data.postId === "string" ? data.postId.trim() : "";
  return postId || null;
}

function getActiveEventCutoff(now: Date) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - ACTIVE_EVENT_LOOKBACK_DAYS);
  return cutoff;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>
) {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    })
  );

  return results;
}

function enforceAuthorization(request: Request) {
  const expected = process.env.REALTIME_INTERNAL_API_TOKEN;
  if (!expected) {
    console.error("REALTIME_INTERNAL_API_TOKEN is not set");
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization");
  if (!header || header !== `Bearer ${expected}`) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}

function handleError(error: unknown) {
  if (error instanceof NextResponse || error instanceof Response) {
    return error;
  }

  console.error("Failed to verify realtime post visibility", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 }
  );
}

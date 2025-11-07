import { NextResponse } from "next/server";

import { firestore } from "@/server/firebase/admin";
import {
  PAGE_SIZE,
  YahooRealtimeParseError,
  YahooRealtimeRequestError,
  fetchYahooRealtimePosts,
} from "@/server/realtime/fetchYahooRealtime";
import { RULESET_VERSION, normalizePost } from "@/server/realtime/rules/normalizePost";
import type { NormalizedRealtimeEvent } from "@/types/realtimeEvent";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SKIP_REASON_NO_EVENT_TIME = "missing_event_time";
const SKIP_REASON_DUPLICATE = "already_exists";
const EXISTING_CHUNK_SIZE = 450;

export const runtime = "nodejs";

type RegisterRequest = {
  query: string;
  limit: number;
  sinceId?: string;
  dryRun: boolean;
};

type RegisterSkippedItem = {
  postId: string;
  reason: string;
};

type RegisterEventSummary = {
  postId: string;
  eventTime: string;
  confidence: number;
  needsReview: boolean;
};

type RegisterResponse = {
  query: string;
  processed: number;
  inserted: number;
  updated: number;
  skipped: RegisterSkippedItem[];
  events: RegisterEventSummary[];
};

export async function POST(request: Request) {
  try {
    enforceAuthorization(request);

    const body = await parseBody(request);
    const params = validateBody(body);

    const fetchLimit = Math.min(params.limit, PAGE_SIZE);
    const { posts } = await fetchYahooRealtimePosts({
      query: params.query,
      limit: fetchLimit,
    });

    const filteredPosts = filterBySinceId(posts, params.sinceId);
    const skipped: RegisterSkippedItem[] = [];

    const normalizedEvents: Array<{
      event: NormalizedRealtimeEvent;
      summary: RegisterEventSummary;
    }> = [];

    const capturedAt = new Date();

    for (const post of filteredPosts) {
      const { event } = normalizePost(post, { query: params.query, capturedAt });
      if (!event.eventTime) {
        skipped.push({ postId: event.postId, reason: SKIP_REASON_NO_EVENT_TIME });
        continue;
      }

      normalizedEvents.push({
        event,
        summary: {
          postId: event.postId,
          eventTime: event.eventTime.toISOString(),
          confidence: event.confidence,
          needsReview: event.needsReview,
        },
      });
    }

    if (normalizedEvents.length === 0) {
      return NextResponse.json<RegisterResponse>({
        query: params.query,
        processed: filteredPosts.length,
        inserted: 0,
        updated: 0,
        skipped,
        events: [],
      });
    }

    if (params.dryRun) {
      return NextResponse.json<RegisterResponse>({
        query: params.query,
        processed: filteredPosts.length,
        inserted: 0,
        updated: 0,
        skipped,
        events: normalizedEvents.map((entry) => entry.summary),
      });
    }

    const collection = firestore.collection("realtimeEvents");
    const docIds = normalizedEvents.map(({ event }) => buildDocId(event.postId));
    const existingIds = await fetchExistingDocumentIds(collection, docIds);

    const batch = firestore.batch();
    const events: RegisterEventSummary[] = [];
    let inserted = 0;

    normalizedEvents.forEach(({ event, summary }, index) => {
      const docId = docIds[index];
      if (existingIds.has(docId)) {
        skipped.push({ postId: event.postId, reason: SKIP_REASON_DUPLICATE });
        return;
      }

      events.push(summary);
      inserted += 1;
      batch.set(collection.doc(docId), convertEventToFirestoreData(event));
    });

    if (inserted > 0) {
      await batch.commit();
    }

    return NextResponse.json<RegisterResponse>({
      query: params.query,
      processed: filteredPosts.length,
      inserted,
      updated: 0,
      skipped,
      events,
    });
  } catch (error) {
    return handleError(error);
  }
}

function buildDocId(postId: string) {
  return `${postId}:${RULESET_VERSION}`;
}

async function fetchExistingDocumentIds(
  collection: FirebaseFirestore.CollectionReference,
  docIds: string[],
) {
  const existing = new Set<string>();

  for (let i = 0; i < docIds.length; i += EXISTING_CHUNK_SIZE) {
    const chunk = docIds.slice(i, i + EXISTING_CHUNK_SIZE);
    if (chunk.length === 0) {
      continue;
    }
    const refs = chunk.map((id) => collection.doc(id));
    const snapshots = await firestore.getAll(...refs);
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) {
        existing.add(snapshot.id);
      }
    });
  }

  return existing;
}

function enforceAuthorization(request: Request) {
  const expected = process.env.REALTIME_INTERNAL_API_TOKEN;
  if (!expected) {
    console.error("REALTIME_INTERNAL_API_TOKEN is not set");
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization");
  if (!header || header !== `Bearer ${expected}`) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
}

async function parseBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}

function validateBody(body: unknown): RegisterRequest {
  if (!body || typeof body !== "object") {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Request body must be an object" },
      { status: 400 },
    );
  }

  const query = extractString(body, "query");
  if (!query) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "query is required" },
      { status: 400 },
    );
  }

  const limit = clampLimit(extractNumber(body, "limit") ?? DEFAULT_LIMIT);
  const sinceId = extractString(body, "sinceId");
  if (sinceId && !/^[0-9]+$/.test(sinceId)) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "sinceId must be a numeric string" },
      { status: 400 },
    );
  }

  const dryRun = extractBoolean(body, "dryRun") ?? false;

  return {
    query: query.trim(),
    limit,
    sinceId: sinceId ?? undefined,
    dryRun,
  };
}

function extractString(obj: any, key: string): string | null {
  const value = obj?.[key];
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function extractNumber(obj: any, key: string): number | null {
  const value = obj?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function extractBoolean(obj: any, key: string): boolean | null {
  const value = obj?.[key];
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function clampLimit(limit: number): number {
  const normalized = Math.max(1, Math.floor(limit));
  return Math.min(normalized, MAX_LIMIT);
}

function filterBySinceId(
  posts: Awaited<ReturnType<typeof fetchYahooRealtimePosts>>["posts"],
  sinceId?: string,
) {
  if (!sinceId) {
    return posts;
  }
  return posts.filter((post) => isPostIdGreater(post.id, sinceId));
}

function isPostIdGreater(currentId: string, sinceId: string): boolean {
  try {
    return BigInt(currentId) > BigInt(sinceId);
  } catch {
    return currentId > sinceId;
  }
}

function convertEventToFirestoreData(event: NormalizedRealtimeEvent) {
  return {
    postId: event.postId,
    postURL: event.postURL,
    hashtags: event.hashtags,
    createdAt: event.createdAt,
    authorId: event.authorId,
    authorName: event.authorName,
    authorImageUrl: event.authorImageUrl,
    rawPostText: event.rawPostText,
    eventTime: event.eventTime,
    eventDateResolution: event.eventDateResolution,
    ticketTitle: event.ticketTitle,
    category: event.category,
    price: event.price,
    quantity: event.quantity,
    deliveryMethod: event.deliveryMethod,
    location: event.location,
    sourceQuery: event.sourceQuery,
    capturedAt: event.capturedAt,
    normalizationEngine: event.normalizationEngine,
    confidence: event.confidence,
    notes: event.notes,
    needsReview: event.needsReview,
    reviewStatus: event.reviewStatus,
    lastReviewedAt: event.lastReviewedAt,
  };
}

function handleError(error: unknown) {
  if (error instanceof NextResponse || error instanceof Response) {
    return error;
  }

  if (error instanceof YahooRealtimeRequestError) {
    return NextResponse.json<RealtimeApiErrorResponse>(
      {
        error: "Upstream request failed",
        details: error.message,
      },
      { status: error.status },
    );
  }

  if (error instanceof YahooRealtimeParseError) {
    return NextResponse.json<RealtimeApiErrorResponse>(
      {
        error: "Upstream response parsing failed",
        details: error.message,
      },
      { status: 502 },
    );
  }

  console.error("Unexpected error while registering realtime posts", error);

  return NextResponse.json<RealtimeApiErrorResponse>(
    {
      error: "Internal server error",
    },
    { status: 500 },
  );
}

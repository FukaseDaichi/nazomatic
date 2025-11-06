import { NextResponse } from "next/server";

import { firestore } from "@/server/firebase/admin";
import {
  PAGE_SIZE,
  YahooRealtimeParseError,
  YahooRealtimeRequestError,
  fetchYahooRealtimePosts,
} from "@/server/realtime/fetchYahooRealtime";
import {
  RULESET_VERSION,
  normalizePost,
} from "@/server/realtime/rules/normalizePost";
import type { NormalizedRealtimeEvent } from "@/types/realtimeEvent";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const NEEDS_REVIEW_REASON = "no_event_time";

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
  eventTime: string | null;
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
    const body = await parseBody(request);
    const params = validateBody(body);
    const capturedAt = new Date();

    const fetchLimit = Math.min(params.limit, PAGE_SIZE);
    const { posts } = await fetchYahooRealtimePosts({
      query: params.query,
      limit: fetchLimit,
    });

    const filteredPosts = filterBySinceId(posts, params.sinceId);
    const events: RegisterEventSummary[] = [];
    const skipped: RegisterSkippedItem[] = [];
    let inserted = 0;
    let updated = 0;

    const batch = firestore.batch();
    const collection = firestore.collection("realtimeEvents");

    for (const post of filteredPosts) {
      const { event } = normalizePost(post, {
        query: params.query,
        capturedAt,
      });

      if (!event.eventTime) {
        skipped.push({ postId: event.postId, reason: NEEDS_REVIEW_REASON });
        continue;
      }

      events.push({
        postId: event.postId,
        eventTime: event.eventTime.toISOString(),
        confidence: event.confidence,
        needsReview: event.needsReview,
      });

      if (params.dryRun) {
        continue;
      }

      const docId = `${event.postId}:${RULESET_VERSION}`;
      const docRef = collection.doc(docId);
      const existingSnapshot = await docRef.get();
      if (existingSnapshot.exists) {
        updated += 1;
      } else {
        inserted += 1;
      }

      batch.set(docRef, convertEventToFirestoreData(event), { merge: true });
    }

    if (!params.dryRun && events.length > 0) {
      await batch.commit();
    }

    return NextResponse.json<RegisterResponse>({
      query: params.query,
      processed: filteredPosts.length,
      inserted: params.dryRun ? 0 : inserted,
      updated: params.dryRun ? 0 : updated,
      skipped,
      events,
    });
  } catch (error) {
    return handleError(error);
  }
}

async function parseBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

function validateBody(body: unknown): RegisterRequest {
  if (!body || typeof body !== "object") {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const query = extractString(body, "query");
  if (!query) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "query is required" },
      { status: 400 }
    );
  }

  const limit = clampLimit(extractNumber(body, "limit") ?? DEFAULT_LIMIT);
  const sinceId = extractString(body, "sinceId");
  if (sinceId && !/^[0-9]+$/.test(sinceId)) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "sinceId must be a numeric string" },
      { status: 400 }
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
  sinceId?: string
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
      { status: error.status }
    );
  }

  if (error instanceof YahooRealtimeParseError) {
    return NextResponse.json<RealtimeApiErrorResponse>(
      {
        error: "Upstream response parsing failed",
        details: error.message,
      },
      { status: 502 }
    );
  }

  console.error("Unexpected error while registering realtime posts", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    {
      error: "Internal server error",
    },
    { status: 500 }
  );
}

import { NextResponse } from "next/server";

import { BrowserPostConfigError } from "@/server/x-browser-posting/candidate";
import { prepareTrendJokePost } from "@/server/x-browser-posting/trend-joke-post";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

export const runtime = "nodejs";

type PrepareTrendJokeRequest = {
  timezone?: string;
  runDate?: string | null;
  runSlot?: string | null;
  queryBundleKey?: string | null;
  searchQueries?: string[] | null;
  maxSearchQueries?: number | null;
  maxPostsPerQuery?: number | null;
  topicKey?: string | null;
  archetype?: string | null;
};

export async function POST(request: Request) {
  try {
    enforceAuthorization(request);

    const body = await parseBody(request);
    const params = validateBody(body);
    const prepared = await prepareTrendJokePost(params);

    return NextResponse.json(prepared);
  } catch (error) {
    return handleError(error);
  }
}

async function parseBody(request: Request): Promise<unknown> {
  if (request.body === null) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

function validateBody(body: unknown): PrepareTrendJokeRequest {
  if (!body || typeof body !== "object") {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  return {
    timezone: extractString(body, "timezone") ?? undefined,
    runDate: extractString(body, "runDate"),
    runSlot: extractString(body, "runSlot"),
    queryBundleKey: extractString(body, "queryBundleKey"),
    searchQueries: extractStringArray(body, "searchQueries"),
    maxSearchQueries: extractNumber(body, "maxSearchQueries"),
    maxPostsPerQuery: extractNumber(body, "maxPostsPerQuery"),
    topicKey: extractString(body, "topicKey"),
    archetype: extractString(body, "archetype"),
  };
}

function extractString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function extractNumber(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function extractStringArray(obj: unknown, key: string): string[] | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((entry): entry is string => typeof entry === "string");
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

  if (error instanceof BrowserPostConfigError) {
    return NextResponse.json<RealtimeApiErrorResponse>(
      { error: error.message },
      { status: 400 }
    );
  }

  console.error("Failed to prepare trend joke post", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 }
  );
}

import { NextResponse } from "next/server";

import { enforceInternalAuthorization } from "@/server/internal-api/authorization";
import { BrowserPostConfigError } from "@/server/x-browser-posting/candidate";
import {
  prepareObservationLog,
} from "@/server/x-browser-posting/observation-log";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

export const runtime = "nodejs";

type PrepareObservationLogRequest = {
  hashtag?: string;
  timezone?: string;
  runDate?: string | null;
  line?: string | null;
};

export async function POST(request: Request) {
  try {
    await enforceInternalAuthorization(request);

    const body = await parseBody(request);
    const params = validateBody(body);
    const prepared = await prepareObservationLog(params);
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

function validateBody(body: unknown): PrepareObservationLogRequest {
  if (!body || typeof body !== "object") {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  return {
    hashtag: extractString(body, "hashtag") ?? undefined,
    timezone: extractString(body, "timezone") ?? undefined,
    runDate: extractString(body, "runDate"),
    line: extractString(body, "line"),
  };
}

function extractString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
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

  console.error("Failed to prepare observation log", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 }
  );
}

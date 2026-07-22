import { NextResponse } from "next/server";

import {
  BrowserPostConfigError,
  BrowserPostRateLimitError,
  DEFAULT_BROWSER_POST_HASHTAG,
  prepareBrowserPostCandidate,
} from "@/server/x-browser-posting/candidate";
import type { RealtimeApiErrorResponse } from "@/types/realtime";
import { enforceInternalAuthorization } from "@/server/internal-api/authorization";

export const runtime = "nodejs";

type PrepareRequest = {
  hashtag?: string;
  accountHandle?: string;
  dryRun?: boolean;
  reservedBy?: string;
  cooldownMinutes?: number;
  dailyLimit?: number;
  maxPerRun?: number;
};

export async function POST(request: Request) {
  try {
    enforceInternalAuthorization(request);

    const body = await parseBody(request);
    const params = validateBody(body);
    const prepared = await prepareBrowserPostCandidate(params);

    if (!prepared) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "X-Browser-Post-Reason": "no_candidate",
        },
      });
    }

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

function validateBody(
  body: unknown
): PrepareRequest & {
  hashtag: string;
  accountHandle: string;
  dryRun: boolean;
} {
  if (!body || typeof body !== "object") {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const accountHandle = extractString(body, "accountHandle");
  if (!accountHandle) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "accountHandle is required" },
      { status: 400 }
    );
  }

  return {
    hashtag: extractString(body, "hashtag") ?? DEFAULT_BROWSER_POST_HASHTAG,
    accountHandle,
    dryRun: extractBoolean(body, "dryRun") ?? true,
    reservedBy: extractString(body, "reservedBy") ?? "",
    cooldownMinutes: extractNumber(body, "cooldownMinutes") ?? undefined,
    dailyLimit: extractNumber(body, "dailyLimit") ?? undefined,
    maxPerRun: extractNumber(body, "maxPerRun") ?? undefined,
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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractBoolean(obj: unknown, key: string): boolean | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
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

  if (error instanceof BrowserPostRateLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  console.error("Failed to prepare browser post", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 }
  );
}

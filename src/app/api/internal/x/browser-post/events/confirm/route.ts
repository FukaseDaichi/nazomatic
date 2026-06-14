import { NextResponse } from "next/server";

import {
  BrowserPostConfigError,
  BrowserPostReservationError,
  type BrowserPostConfirmationMode,
  type BrowserPostQuoteMode,
  type BrowserPostStatus,
  confirmBrowserPostResult,
} from "@/server/x-browser-posting/candidate";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

export const runtime = "nodejs";

type ConfirmRequest = {
  eventId?: string;
  reservationId?: string;
  accountHandle?: string;
  status?: BrowserPostStatus;
  quoteText?: string | null;
  quoteMode?: BrowserPostQuoteMode | null;
  postedPostURL?: string | null;
  postedPostId?: string | null;
  confirmationMode?: BrowserPostConfirmationMode | null;
  selectorProfileVersion?: string | null;
  error?: string | null;
};

export async function POST(request: Request) {
  try {
    enforceAuthorization(request);

    const body = await parseBody(request);
    const params = validateBody(body);
    const result = await confirmBrowserPostResult(params);

    return NextResponse.json(result);
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

function validateBody(body: unknown): Required<ConfirmRequest> {
  if (!body || typeof body !== "object") {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const eventId = extractString(body, "eventId");
  const reservationId = extractString(body, "reservationId");
  const accountHandle = extractString(body, "accountHandle");
  const status = extractStatus(body);

  if (!eventId || !reservationId || !accountHandle || !status) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      {
        error:
          "eventId, reservationId, accountHandle, and valid status are required",
      },
      { status: 400 }
    );
  }

  return {
    eventId,
    reservationId,
    accountHandle,
    status,
    quoteText: extractString(body, "quoteText"),
    quoteMode: extractQuoteMode(body),
    postedPostURL: extractString(body, "postedPostURL"),
    postedPostId: extractString(body, "postedPostId"),
    confirmationMode: extractConfirmationMode(body),
    selectorProfileVersion: extractString(body, "selectorProfileVersion"),
    error: extractString(body, "error"),
  };
}

function extractString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function extractStatus(obj: unknown): BrowserPostStatus | null {
  const value = extractString(obj, "status");
  return value === "posted" || value === "skipped" || value === "failed"
    ? value
    : null;
}

function extractQuoteMode(obj: unknown): BrowserPostQuoteMode | null {
  const value = extractString(obj, "quoteMode");
  return value === "post_url" || value === "quote_ui" ? value : null;
}

function extractConfirmationMode(
  obj: unknown
): BrowserPostConfirmationMode | null {
  const value = extractString(obj, "confirmationMode");
  return value === "interactive" || value === "unattended" ? value : null;
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

  if (error instanceof BrowserPostReservationError) {
    return NextResponse.json<RealtimeApiErrorResponse>(
      { error: error.message },
      { status: 409 }
    );
  }

  console.error("Failed to confirm browser post", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 }
  );
}

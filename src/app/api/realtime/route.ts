import { NextResponse } from "next/server";

import {
  PAGE_SIZE,
  YahooRealtimeParseError,
  YahooRealtimeRequestError,
  fetchYahooRealtimePosts,
} from "@/server/realtime/fetchYahooRealtime";
import type { RealtimeApiErrorResponse } from "@/types/realtime";

const CACHE_SECONDS = 60;
const MAX_LIMIT = PAGE_SIZE;

export const runtime = "nodejs";
export const revalidate = CACHE_SECONDS;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rawQuery = searchParams.get("query") ?? undefined;
  const page = parsePositiveInteger(searchParams.get("page"), "page");
  const limit = clampLimit(
    parsePositiveInteger(searchParams.get("limit"), "limit")
  );

  try {
    const data = await fetchYahooRealtimePosts({
      query: rawQuery,
      page: page ?? undefined,
      limit: limit ?? undefined,
    });

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

function parsePositiveInteger(
  value: string | null,
  parameterName: string
): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      {
        error: "Invalid parameter",
        details: `${parameterName} must be a positive integer value`,
      },
      { status: 400 }
    );
  }
  return Math.floor(parsed);
}

function clampLimit(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Math.min(value, MAX_LIMIT);
}

function handleError(error: unknown) {
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

  if (error instanceof NextResponse || error instanceof Response) {
    return error;
  }

  console.error("Unexpected error while fetching Yahoo realtime posts", error);

  return NextResponse.json<RealtimeApiErrorResponse>(
    {
      error: "Internal server error",
    },
    { status: 500 }
  );
}

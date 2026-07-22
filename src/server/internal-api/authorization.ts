import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import type { RealtimeApiErrorResponse } from "@/types/realtime";

const TOKEN_ENV_KEY = "REALTIME_INTERNAL_API_TOKEN";

/**
 * Realtime / X の内部 API 共通の Bearer 認証。
 * 失敗時は NextResponse を throw するため、route 側は handleError で受けること。
 */
export function enforceInternalAuthorization(request: Request) {
  const expected = process.env[TOKEN_ENV_KEY];
  if (!expected) {
    console.error(`${TOKEN_ENV_KEY} is not set`);
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization");
  if (!header || !matchesBearerToken(header, expected)) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}

function matchesBearerToken(header: string, expected: string) {
  const actual = Buffer.from(header, "utf8");
  const wanted = Buffer.from(`Bearer ${expected}`, "utf8");

  if (actual.length !== wanted.length) {
    return false;
  }

  return timingSafeEqual(actual, wanted);
}

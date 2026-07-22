import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import type { RealtimeApiErrorResponse } from "@/types/realtime";

import { consumeNonce } from "./nonce-store";
import {
  NONCE_HEADER,
  NONCE_PATTERN,
  SIGNATURE_HEADER,
  SIGNATURE_TTL_SECONDS,
  TIMESTAMP_HEADER,
  buildCanonicalString,
  signCanonicalString,
  signaturesMatch,
} from "./signature";

const TOKEN_ENV_KEY = "REALTIME_INTERNAL_API_TOKEN";
const SIGNING_SECRET_ENV_KEY = "INTERNAL_API_SIGNING_SECRET";
const ALLOW_UNSIGNED_ENV_KEY = "INTERNAL_API_ALLOW_UNSIGNED";

/**
 * Realtime / X の内部 API 共通認証。
 *
 * 1. `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>` を定数時間比較
 * 2. HMAC-SHA256 署名（method / path / body / timestamp / nonce を含む）を検証
 * 3. timestamp が {@link SIGNATURE_TTL_SECONDS} 以内であることを検証（有効期限）
 * 4. nonce を Firestore に一度だけ記録し、再送を拒否（replay 制御）
 *
 * 失敗時は NextResponse を throw するため、route 側は handleError で受けること。
 */
export async function enforceInternalAuthorization(request: Request): Promise<void> {
  const expectedToken = process.env[TOKEN_ENV_KEY];
  if (!expectedToken) {
    console.error(`${TOKEN_ENV_KEY} is not set`);
    throw configurationError();
  }

  const header = request.headers.get("authorization");
  if (!header || !matchesBearerToken(header, expectedToken)) {
    throw unauthorized("Unauthorized");
  }

  await enforceSignature(request, expectedToken);
}

async function enforceSignature(request: Request, token: string) {
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const nonce = request.headers.get(NONCE_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!timestamp && !nonce && !signature) {
    if (allowUnsigned()) {
      console.warn(
        `Unsigned internal API request accepted because ${ALLOW_UNSIGNED_ENV_KEY} is enabled`
      );
      return;
    }
    throw unauthorized("Missing request signature");
  }

  if (!timestamp || !nonce || !signature) {
    throw unauthorized("Incomplete request signature");
  }

  if (!NONCE_PATTERN.test(nonce)) {
    throw unauthorized("Invalid nonce");
  }

  const issuedAtSeconds = Number(timestamp);
  if (!Number.isInteger(issuedAtSeconds)) {
    throw unauthorized("Invalid signature timestamp");
  }

  const now = new Date();
  const skewSeconds = Math.abs(Math.floor(now.getTime() / 1000) - issuedAtSeconds);
  if (skewSeconds > SIGNATURE_TTL_SECONDS) {
    throw unauthorized("Signature expired");
  }

  const url = new URL(request.url);
  const canonical = buildCanonicalString({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    timestamp,
    nonce,
    // clone しないと route 側の request.json() が読めなくなる
    body: await request.clone().text(),
  });

  if (!signaturesMatch(signature, signCanonicalString(getSigningSecret(token), canonical))) {
    throw unauthorized("Invalid request signature");
  }

  let accepted: boolean;
  try {
    accepted = await consumeNonce(nonce, now);
  } catch (error) {
    console.error("Failed to record internal API nonce", error);
    throw configurationError();
  }

  if (!accepted) {
    throw unauthorized("Replayed request");
  }
}

function getSigningSecret(token: string) {
  return process.env[SIGNING_SECRET_ENV_KEY] || token;
}

function allowUnsigned() {
  return process.env[ALLOW_UNSIGNED_ENV_KEY] === "true";
}

function matchesBearerToken(header: string, expected: string) {
  const actual = Buffer.from(header, "utf8");
  const wanted = Buffer.from(`Bearer ${expected}`, "utf8");

  if (actual.length !== wanted.length) {
    return false;
  }

  return timingSafeEqual(actual, wanted);
}

function unauthorized(error: string) {
  return NextResponse.json<RealtimeApiErrorResponse>({ error }, { status: 401 });
}

function configurationError() {
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Server configuration error" },
    { status: 500 }
  );
}

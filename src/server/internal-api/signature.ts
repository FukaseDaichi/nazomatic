import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * 内部 API 署名の仕様 (v1)。
 *
 * canonical = "v1\n{METHOD}\n{PATH}\n{TIMESTAMP}\n{NONCE}\n{SHA256_HEX(body)}"
 * signature = "v1=" + HMAC-SHA256(secret, canonical) の hex
 *
 * PATH は query を含む pathname (`/api/internal/... ?a=b`)。
 * TIMESTAMP は UNIX 秒。NONCE は 16-64 文字の hex。
 *
 * この仕様は `scripts/internal-api/signing.mjs`（Node client）と
 * `scripts/internal-api/post.sh`（GitHub Actions client）と一致させること。
 */
export const SIGNATURE_VERSION = "v1";
export const TIMESTAMP_HEADER = "x-internal-timestamp";
export const NONCE_HEADER = "x-internal-nonce";
export const SIGNATURE_HEADER = "x-internal-signature";

/** 署名の有効期限（秒）。前後の clock skew に同じ幅を許容する。 */
export const SIGNATURE_TTL_SECONDS = 300;

export const NONCE_PATTERN = /^[0-9a-f]{16,64}$/;

export type CanonicalRequest = {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
};

export function buildCanonicalString({
  method,
  path,
  timestamp,
  nonce,
  body,
}: CanonicalRequest): string {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  return [
    SIGNATURE_VERSION,
    method.toUpperCase(),
    path,
    timestamp,
    nonce,
    bodyHash,
  ].join("\n");
}

export function signCanonicalString(secret: string, canonical: string): string {
  const digest = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
  return `${SIGNATURE_VERSION}=${digest}`;
}

export function signaturesMatch(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

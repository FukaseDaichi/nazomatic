import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * 内部 API 署名 v1 の client 実装。
 * 仕様は `src/server/internal-api/signature.ts` と一致させること。
 */
const SIGNATURE_VERSION = "v1";

export function buildCanonicalString({ method, path, timestamp, nonce, body }) {
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

/**
 * 署名 header を生成する。呼び出しごとに timestamp と nonce を作り直すため、
 * retry する場合も必ず再生成すること（同じ nonce は replay として拒否される）。
 */
export function buildSignedHeaders({ method, url, body, token, signingSecret }) {
  const target = new URL(url);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const canonical = buildCanonicalString({
    method,
    path: `${target.pathname}${target.search}`,
    timestamp,
    nonce,
    body,
  });
  const digest = createHmac("sha256", signingSecret || token)
    .update(canonical, "utf8")
    .digest("hex");

  return {
    Authorization: `Bearer ${token}`,
    "x-internal-timestamp": timestamp,
    "x-internal-nonce": nonce,
    "x-internal-signature": `${SIGNATURE_VERSION}=${digest}`,
  };
}

#!/usr/bin/env bash
# 内部 API へ署名付き POST を送る。GitHub Actions から利用する。
#
# 使い方:
#   BASE_URL=... API_TOKEN=... [INTERNAL_API_SIGNING_SECRET=...] [RESPONSE_FILE=...] \
#     scripts/internal-api/post.sh <path> <json-payload> [max_attempts] [retry_delay_seconds]
#
# 標準出力には HTTP status のみを出す。response body は RESPONSE_FILE（未指定なら標準エラー）へ。
# 終了コードは 2xx なら 0、それ以外は 1。
#
# 署名仕様は src/server/internal-api/signature.ts と一致させること。
# retry のたびに timestamp と nonce を作り直す（同じ nonce は replay として拒否される）。
set -euo pipefail

REQUEST_PATH="${1:?path is required}"
PAYLOAD="${2:?json payload is required}"
MAX_ATTEMPTS="${3:-3}"
RETRY_DELAY="${4:-5}"

: "${BASE_URL:?BASE_URL is required}"
: "${API_TOKEN:?API_TOKEN is required}"

BASE_URL="${BASE_URL%/}"
SIGNING_SECRET="${INTERNAL_API_SIGNING_SECRET:-$API_TOKEN}"
BODY_FILE="${RESPONSE_FILE:-$(mktemp)}"

hex_digest() {
  awk '{print $NF}'
}

attempt=1
status=000

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  timestamp="$(date -u +%s)"
  nonce="$(openssl rand -hex 16)"
  body_hash="$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hex | hex_digest)"
  canonical="$(printf 'v1\nPOST\n%s\n%s\n%s\n%s' "$REQUEST_PATH" "$timestamp" "$nonce" "$body_hash")"
  signature="$(printf '%s' "$canonical" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" -hex | hex_digest)"

  status="$(curl --silent --show-error \
    -w "%{http_code}" \
    -o "$BODY_FILE" \
    -X POST "${BASE_URL}${REQUEST_PATH}" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-internal-timestamp: $timestamp" \
    -H "x-internal-nonce: $nonce" \
    -H "x-internal-signature: v1=$signature" \
    -d "$PAYLOAD" || echo 000)"

  # 到達失敗と server error だけ retry する。4xx は署名や入力の問題なので再送しない。
  if [ "$status" = "000" ] || [ "$status" -ge 500 ]; then
    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      echo "Attempt ${attempt} failed (status ${status}). Retrying in ${RETRY_DELAY}s." >&2
      sleep "$RETRY_DELAY"
      attempt=$((attempt + 1))
      continue
    fi
  fi
  break
done

if [ -z "${RESPONSE_FILE:-}" ]; then
  cat "$BODY_FILE" >&2
fi

echo "$status"

if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
  exit 0
fi
exit 1

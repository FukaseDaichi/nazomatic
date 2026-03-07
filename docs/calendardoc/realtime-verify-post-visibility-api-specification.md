# Realtime Verify Post Visibility API 仕様書（実装準拠 / 2026-03-08）

## 1. 概要

- endpoint: `POST /api/internal/realtime/verify-post-visibility`
- runtime: `nodejs`
- 認証: `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>`
- 役割: Firestore `realtimeEvents` に対して X syndication を用いた存在確認を行い、削除済み Post を `isVisible=false` に更新する

## 2. リクエスト

```json
{
  "batchSize": 100,
  "maxConcurrency": 5,
  "bootstrapScanLimit": 500,
  "dryRun": false
}
```

### 2.1 バリデーション

- `batchSize`: 任意、既定 `100`
  - 受理範囲は `1..200`
- `maxConcurrency`: 任意、既定 `5`
  - 受理範囲は `1..10`
- `bootstrapScanLimit`: 任意、既定 `500`
  - 受理範囲は `1..2000`
- `dryRun`: 任意、既定 `false`

## 3. 候補選定

候補は 2 段階で集める。

### 3.1 scheduled candidates

- `syndicationNextCheckAt <= now`
- `syndicationNextCheckAt asc`
- 最大 `batchSize * 3` 件を見る
- `isVisible !== false` の doc だけを対象にする
- `postId` 重複は 1 件にまとめる

### 3.2 bootstrap candidates

scheduled candidates が `batchSize` に満たない場合のみ、既存データの初期化用候補を補充する。

- `eventTime >= now - 1 day`
- `eventTime asc`
- `bootstrapScanLimit` 件まで見る
- `syndicationCheckedAt == null` かつ `syndicationNextCheckAt == null`
- `isVisible !== false` の doc だけを対象にする
- `postId` 重複は 1 件にまとめる

## 4. syndication 判定

- `__typename === "Tweet"`: `available`
- `__typename === "TweetTombstone"`: `deleted`
- その他、HTTP 非 2xx、JSON 解析失敗、タイムアウト: `unknown`

## 5. 更新ルール

### 5.1 `available`

- `isVisible = true`
- `hiddenReason = null`
- `hiddenAt = null`
- `syndicationStatus = "available"`
- `syndicationCheckedAt = now`
- `syndicationErrorCount = 0`
- `syndicationNextCheckAt` は `eventTime` に応じて `12h / 24h / 72h` 後

### 5.2 `deleted`

- `isVisible = false`
- `hiddenReason = "syndication_deleted"`
- `hiddenAt = now`
- `syndicationStatus = "deleted"`
- `syndicationCheckedAt = now`
- `syndicationErrorCount = 0`
- `syndicationNextCheckAt = null`

### 5.3 `unknown`

- `isVisible` は維持する
- `syndicationStatus = "unknown"`
- `syndicationCheckedAt = now`
- `syndicationErrorCount += 1`
- `syndicationNextCheckAt` は backoff で `6h -> 12h -> 24h`

同一 `postId` の doc が複数ある場合は、すべて同時に更新する。

## 6. レスポンス

```json
{
  "dryRun": false,
  "processedPostIds": 87,
  "available": 82,
  "deleted": 3,
  "unknown": 2,
  "updatedDocs": 90,
  "bootstrapCandidates": 5
}
```

`dryRun=true` の場合、Firestore は更新せず `updatedDocs=0` になる。

## 7. 運用上の注意

- この API は `realtime-prune` の物理削除とは独立して動く
- 物理削除条件は引き続き `eventTime < cutoffDate`
- 削除済み Post も古くなれば `prune` で Firestore から物理削除される

# Realtime Register API 仕様（実装準拠 / 2026-03-07）

## 1. 概要

- endpoint: `POST /api/internal/realtime/register`
- runtime: `nodejs`
- 認証: `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>`
- 役割: Yahoo リアルタイム検索結果を正規化し、Firestore `realtimeEvents` へ登録する

## 2. リクエスト

```json
{
  "query": "#謎チケ売ります",
  "limit": 20,
  "sinceId": "1834567890123456789",
  "dryRun": false
}
```

### 2.1 バリデーション

- `query`: 必須、string
- `limit`: 任意、既定 `20`
  - 受理上限は `100`
  - 実際の Yahoo 取得件数は `min(limit, 40)`
- `sinceId`: 任意、数字文字列
- `dryRun`: 任意、既定 `false`

## 3. レスポンス

```json
{
  "query": "#謎チケ売ります",
  "processed": 18,
  "inserted": 12,
  "updated": 0,
  "skipped": [
    { "postId": "18345...", "reason": "already_exists" },
    { "postId": "18346...", "reason": "missing_event_time" }
  ],
  "events": [
    {
      "postId": "18345...",
      "eventTime": "2026-03-07T11:00:00.000Z",
      "confidence": 0.8,
      "needsReview": false
    }
  ]
}
```

注意:

- 現行実装では duplicate を更新しないため、`updated` は常に `0`
- `dryRun=true` の場合、Firestore には書き込まず `inserted=0`

## 4. スキップ理由

- `missing_event_time`
- `already_exists`
- `event_time_in_past`

## 5. 処理フロー

1. Bearer 認証を検証する
2. Yahoo リアルタイム検索を取得する
3. `sinceId` があればその ID より新しい投稿だけに絞る
4. `normalizePost` でイベントを正規化する
5. `eventTime` がない投稿、過去日時の投稿を `skipped` に積む
6. `dryRun=false` なら Firestore へ batch 書き込みする

## 6. Firestore 書き込み

- collection: `realtimeEvents`
- doc ID: `${postId}:${RULESET_VERSION}`
- `RULESET_VERSION`: `ruleset-v2025-11`
- duplicate 判定:
  - 書き込み前に既存 doc ID を取得
  - 既存なら `already_exists` で skip

## 7. 正規化結果

`normalizePost` は以下を埋める。

- `eventTime`
- `eventDateResolution`
- `ticketTitle`
- `category`
- `price`
- `quantity`
- `deliveryMethod`
- `location`
- `confidence`
- `needsReview`
- `notes`

`needsReview` は日時未解決、または `confidence < 0.6` のとき `true`。

## 8. 現状の制約

- duplicate の更新は未実装
- diagnostics はレスポンスに含めず、Firestore にも保存しない
- `sinceId` は取得結果に対する後段フィルタであり、Yahoo 側 API の条件ではない

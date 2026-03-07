# X Repost API 仕様（実装準拠 / 2026-03-07）

## 1. 概要

- endpoint: `POST /api/internal/x/repost/events`
- runtime: `nodejs`
- 認証: `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>`
- 役割: Firestore `realtimeEvents` から 1 件だけ候補を選び、X で repost する

## 2. リクエスト

```json
{
  "hashtag": "#謎チケ売ります",
  "dryRun": false
}
```

### 2.1 バリデーション

- `hashtag`: 必須、空文字不可
- `dryRun`: 任意、既定 `false`

## 3. 候補選定

候補は以下条件で抽出する。

- `capturedAt >= now - 24h`
- `lastReviewedAt == null`
- `hashtags` に `hashtag` もしくは `#` あり / なしの variant を含む
- `capturedAt desc`
- 各 variant ごとに最大 `50` 件を見る

最初に見つかった 1 件だけを対象にする。

## 4. レスポンス

### 4.1 成功

```json
{
  "pickedEventId": "18345...:ruleset-v2025-11",
  "tweetId": "1900000000000000000",
  "postId": "18345...",
  "postURL": "https://x.com/example/status/18345...",
  "hashtags": ["#謎チケ売ります"],
  "capturedAt": "2026-03-07T02:15:00.000Z",
  "postedAt": "2026-03-07T03:00:00.000Z",
  "dryRun": false
}
```

### 4.2 候補なし

- `204 No Content`
- header: `X-Repost-Reason: no_candidate`

## 5. 実行時の挙動

- `dryRun=true`
  - X API は呼ばない
  - `lastReviewedAt` も更新しない
- `dryRun=false`
  - `postId` または `postURL` から tweet ID を解決する
  - `POST https://api.twitter.com/2/users/{userId}/retweets` を叩く
  - 成功後に Firestore の `lastReviewedAt` を現在時刻で更新する

## 6. 必要な環境変数

- `REALTIME_INTERNAL_API_TOKEN`
- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_USER_ID`

## 7. 現状の制約

- 1 リクエストで repost するのは 1 件だけ
- 対象は `realtimeEvents` のみで、他ソース投稿は扱わない
- `lastReviewedAt` を更新するだけで、専用の repost 履歴コレクションは持たない
- GitHub Actions 側は 204 / 429 を成功扱いにし、その他の非 2xx も現状は失敗終了しない

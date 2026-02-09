# X Repost API 設計方針

## 1. 目的とスコープ

- サイト内の新規機能（例: `src/lib/json/features.json`）や Firebase `realtimeEvents` に保存された #謎チケ関連ポストを、公式 X アカウントで 1 回につき 1 件 Repost/投稿する内部 API を整備する。
- GitHub Actions から 90 分（1.5 時間）間隔で自動実行し、24 時間以内に `capturedAt` された最新イベントを順番に Repost することで 1 日あたり 17 件の上限を確実に下回る運用を実現する。
- register API で取り込んだイベントの Repost を第一段階とし、将来的には新機能紹介など他ソースからの投稿にも拡張できるよう API を共通化する。

## 2. 要求事項（今回追加・更新）

1. **実行間隔**: 90 分ごと（00:00, 01:30, 03:00, ...）に GitHub Actions が起動する。24 時間で 16 ランのみとなるため、X の 1 日 17 件制限を超えない。
2. **投稿件数**: 各ランで必ず 1 件のみ投稿（Repost or quote）。候補がゼロのときは 204 を返し、GitHub Actions で警告を残して終了。
3. **対象期間**: `capturedAt` が `now - 24h <= capturedAt < now` のイベントだけを検索。投稿後は Firestore に Repost 実績を記録し、再度選ばれないようにする。

## 3. GitHub Actions 自動実行

- **固定スケジュール**: 00:00 → 01:30 → 03:00 → 04:30 → 06:00 → 07:30 → 09:00 → 10:30 → 12:00 → 13:30 → 15:00 → 16:30 → 18:00 → 19:30 → 21:00 → 22:30 → （翌日 00:00）という 90 分刻みで 1 日 16 枠を回す。
- **ワークフロー構成**: 上記を実現するため、cron を 2 種類に分割して書き分ける。
  1. 「00 分」枠（1 日 8 回）: `schedule: cron: "0 0,3,6,9,12,15,18,21 * * *"` → 00:00/03:00/.../21:00。
  2. 「30 分」枠（1 日 8 回）: `schedule: cron: "30 1,4,7,10,13,16,19,22 * * *"` → 01:30/04:30/.../22:30。
- **代替案**: `workflow_dispatch` + `matrix` で 16 枠を展開し、`sleep slotIndex*90min` で遅延させてもよい（上記 cron と同じ順序になるようにする）。
- **呼び出し例**
  ```bash
  curl -X POST "$X_REPOST_EVENTS_ENDPOINT" \
    -H "Authorization: Bearer $X_REPOST_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"hashtag":"#謎チケ売ります","dryRun":false}'
  ```
- **失敗時**: HTTP 429/5xx は GitHub Actions を失敗扱いにし、手動再実行で同じ時間帯を再利用する。1 回のランでは 1 投稿のみを保証するため、再実行する際も 90 分サイクルを乱さないよう運用で管理。

## 4. 候補抽出と優先順位

1. Firestore `realtimeEvents` から以下条件で 50 件まで取得:
   - `capturedAt >= now - 24h`
   - `lastReviewedAt == null`
   - 引数の`hashtag`を`hashtags`に含む
2. 優先順位:
   - `capturedAt` 降順（最新優先）。
3. 完了時に `lastReviewedAt`を現在日時のタイムスタンプに更新。候補ゼロ時は 204 を返す。

## 6. API 設計

### 6.1 `POST /api/internal/x/repost/events`

- **認証**: `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>`。ここで使うトークンは register API（`/api/internal/realtime/register`）と同一の内部 API トークンを共有する。
- **リクエスト Body**

  ```jsonc
  {
    "hashtag": "#謎チケ売ります",
    "dryRun": false
  }
  ```

- **レスポンス (成功)**
  ```jsonc
  {
    "pickedEventId": "evt_123",
    "tweetId": "184999000",
    "postedAt": "2025-11-10T06:10:00Z",
    "dryRun": false
  }
  ```
- **レスポンス (候補なし)**: HTTP 204 + `X-Repost-Reason: no_candidate`。
- **制約**: 1 リクエストで投稿できるのは 1 件のみ。`dryRun=true` の場合は X API を呼ばずに候補情報だけ返し、Firestore も更新しない。

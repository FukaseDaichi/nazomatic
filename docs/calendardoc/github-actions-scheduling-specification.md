# GitHub Actions スケジューリング仕様書（Realtime / X, 実装準拠 / 2026-03-08）

## 1. 対象 workflow

- `.github/workflows/realtime-register.yml`
- `.github/workflows/realtime-register-transfer.yml`
- `.github/workflows/realtime-register-accompany.yml`
- `.github/workflows/realtime-verify-post-visibility.yml`
- `.github/workflows/realtime-prune.yml`
- `.github/workflows/x-repost-events.yml`

## 2. 利用 Secrets

- `REALTIME_API_BASE_URL`
- `REALTIME_API_TOKEN`

`REALTIME_API_TOKEN` はアプリ側の `REALTIME_INTERNAL_API_TOKEN` と同値を使う。

## 3. スケジュール

| Workflow | cron (UTC) | 実行内容 |
| --- | --- | --- |
| `realtime-register.yml` | `0 * * * *` | `#謎チケ売ります` を register |
| `realtime-register-transfer.yml` | `15 * * * *` | `#謎チケ譲ります` を register |
| `realtime-register-accompany.yml` | `30 * * * *` | `#謎解き同行者募集` を register |
| `realtime-verify-post-visibility.yml` | `45 * * * *` | syndication で削除済み Post を検知して非表示化 |
| `realtime-prune.yml` | `15 0 * * *` | `cutoffDays=1` で prune |
| `x-repost-events.yml` | `0 0,3,6,9,12,15,18,21 * * *` と `30 1,4,7,10,13,16,19,22 * * *` | 1 日 16 回 repost 候補を実行 |

## 4. Payload

### 4.1 register

register 系 3 workflow はすべて以下形式で `/api/internal/realtime/register` を呼ぶ。

```json
{
  "query": "#謎チケ売ります",
  "limit": 20,
  "dryRun": false
}
```

`query` のみ workflow ごとに差し替える。

### 4.2 prune

```json
{
  "cutoffDays": 1,
  "dryRun": false
}
```

### 4.3 verify post visibility

```json
{
  "batchSize": 100,
  "maxConcurrency": 5,
  "bootstrapScanLimit": 500,
  "dryRun": false
}
```

### 4.4 x repost

```json
{
  "hashtag": "#謎チケ売ります",
  "dryRun": false
}
```

## 5. 実装上の挙動

### 5.1 共通

- `workflow_dispatch` で手動実行できる
- 必須 Secrets が欠けると `exit 1`

### 5.2 register / prune / verify post visibility

- `curl --fail --silent --show-error` を使う
- `--retry` 付きで API を叩く
- API が失敗した場合は workflow 自体も失敗する

### 5.3 x repost

- 204 は候補なしとして成功扱い
- 429 は rate limit として成功扱い
- 現行 workflow はその他の非 2xx でもレスポンス本文を表示したうえで `exit 0` する

このため、`x-repost-events.yml` は現状「落ちない運用」を優先している。

## 6. 運用上の注意

- register の `limit` は workflow 上は `20` 固定
- verify post visibility は毎時 `100 postId` まで確認する
- prune は 1 日 1 回のみ
- x repost は 24 時間内の `lastReviewedAt == null` 候補から 1 件だけ選ぶ
- 非表示化しても doc の物理削除は止めず、`prune` が引き続き古いデータを削除する

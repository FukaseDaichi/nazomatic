# 定期処理と生成物

## GitHub Actions

| Workflow | 起動 | 呼び出す API |
|---|---|---|
| `realtime-register.yml` | 毎時 0 分 | register: `#謎チケ売ります` |
| `realtime-register-transfer.yml` | 毎時 15 分 | register: `#謎チケ譲ります` |
| `realtime-register-accompany.yml` | 毎時 30 分 | register: `#謎解き同行者募集` |
| `realtime-verify-post-visibility.yml` | 毎時 10 分・45 分 | verify visibility |
| `realtime-prune.yml` | 毎日 00:15 UTC | prune: cutoff 1 日 |
| `x-repost-events.yml` | 手動 | X API Repost |

Workflow は `REALTIME_API_BASE_URL` と `REALTIME_API_TOKEN` secrets を使います。token 値はアプリの `REALTIME_INTERNAL_API_TOKEN` と一致させます。

## ローカル X 自動化

リポジトリ外のスケジューラーで稼働中の登録枠と実行時の報告契約は [`x-browser-post-schedules.md`](./x-browser-post-schedules.md) を参照します。

| npm script | 処理 | 実行場所 |
|---|---|---|
| `x:browser-post` | 個別イベントのコメント付き投稿 | ログイン済みローカル PC |
| `x:browser-post:weekend-summary` | 週末土日別件数サマリ | ログイン済みローカル PC |
| `x:browser-post:trend-joke` | Yahoo 検索材料から短文投稿 | ログイン済みローカル PC |
| `x:growth-review` | 直近7日の X 運用集計と週次 Issue | ログイン済みローカル PC |
| `x:growth-improve` | 週次レビューから改善実験を提案し、実行時はドラフト PR を作成 | Codex / GitHub CLI が使えるローカル PC |
| `x:growth-maintain` | 投稿なしで計測回収と実験 activation 照合 | ログイン済み Chrome と GitHub CLI が使えるローカル PC |

実投稿は `--execute` を要求します。GitHub Actions はログイン済み browser profile を持たないため、ブラウザ投稿を実行しません。

3種類の投稿 CLI、週次改善PR作成、成長計測メンテナンスの実行ログは automation id ごとの `logs/{automationId}` に置きます。`X_BROWSER_POST_LOG_RETENTION_COUNT` の既定は70世代で、各 automation 内の古い `*.log` だけを削除します。週次改善レビューは専用 local log を作らず、投稿 CLI の log を集計して GitHub Issue へ出力します。投稿成功時の共通台帳は `local/x-browser-posting/post-ledger.json`、日次 follower snapshot は `local/x-browser-posting/follower-snapshots.json` に保存します。

週次改善レビューは毎週月曜11:30 JSTのローカル automation で実行し、`npm run x:growth-review -- --create-issue` が同一週・同一 account の GitHub Issue を作成または更新します。ログイン済み Chrome profile とローカル台帳が必要なため GitHub Actions へは移しません。

週次改善PR作成は毎週月曜12:30 JSTに `npm run x:growth-improve -- --execute` を実行し、実行ログを `logs/x-growth-improve/` に保存します。実験状態は GitHub の review Issue、PR、label、metadata marker が正本です。成長計測メンテナンスは毎日04:30 JSTに `npm run x:growth-maintain` を実行し、投稿せず metrics を回収して、successful production deployment を確認した merged PR を active 化します。いずれも Codex automation に ACTIVE で登録済みです。

## Shift Search 生成物

元成果物の metadata と Web 表示用 JSON は別 command で生成します。

```bash
npm run shift:report:meta
npm run shift:report:view-assets
```

### `shift:report:meta`

- `artifacts/shift-search/reports/{jp|en}/*.md` を読む。
- `shift-search-report-manifest.json` と `shift-search-report-index.md` を生成する。
- `shift-search-external-links.json` の外部 URL を統合する。

### `shift:report:view-assets`

- artifact manifest を読む。
- `src/generated/shift-search/view-manifest.json` を生成する。
- internal report の本文を `src/generated/shift-search/internal/*.json` に変換する。
- しきい値以上の external report 本文はアプリへ同梱しない。

artifacts を変更した commit では、両 command の出力を同期させます。

## Cache と更新性

| 対象 | 方針 |
|---|---|
| `/api/realtime` | CDN 60 秒 |
| `/api/calendar` | CDN 300 秒、stale 300 秒 |
| BLANK25 manifest | `no-store`、raw URL に timestamp を付ける |
| 辞書 | `SearchManager` がクライアント内 cache |
| Shift report | build 時に generated JSON を import |

## 検証境界

自動 test framework は設定されていません。通常の変更確認は `npm run lint` と、変更対象に応じた `npm run build`、API dry-run、ブラウザ手動確認です。X ブラウザ投稿は dry-run を既定とし、Shift Search artifact の更新は両生成 command の差分を確認します。

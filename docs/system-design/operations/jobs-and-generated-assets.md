# 定期処理と生成物

## GitHub Actions

| Workflow | 起動 | 処理 |
|---|---|---|
| `realtime-register.yml` | 毎時 0 分 | register: `#謎チケ売ります` |
| `realtime-register-transfer.yml` | 毎時 15 分 | register: `#謎チケ譲ります` |
| `realtime-register-accompany.yml` | 毎時 30 分 | register: `#謎解き同行者募集` |
| `realtime-verify-post-visibility.yml` | 毎時 10 分・45 分 | verify visibility |
| `realtime-prune.yml` | 毎日 00:15 UTC | prune: cutoff 1 日 |
| `dependabot-auto-merge.yml` | Security checks完了・毎時7/22/37/52分 UTC・手動 | 全チェック成功後にDependabot PRをマージ |

内部 API を呼ぶ定期実行 Workflow は `REALTIME_API_BASE_URL` と `REALTIME_API_TOKEN` secrets を使います。token 値はアプリの `REALTIME_INTERNAL_API_TOKEN` と一致させます。

## 依存PRの自動マージ

npmとGitHub ActionsのDependabot PRを、メジャー更新も含めて自動マージします。対象は `dependabot[bot]`（GitHub IDも照合）が同一リポジトリ内に作成した、`main` 向けのopen・非draft PRだけです。通常の開発は引き続き `future → main` で進めます。

`scripts/dependabot-auto-merge.mjs` は現在のhead SHAについて次のすべてを確認します。

- 現在の `main` を含むこと。遅れている場合はDependabotによるrebaseとCI再実行を待つ。
- `security-checks.yml` の最新の `pull_request` 実行成功（監査・認証/自動マージ回帰テスト・lint・build）。push実行や別workflowの成功だけでは許可しない。
- すべての最新check-runと各contextの最新commit statusが成功。失敗・実行中・skipped・neutral・情報不足は待機する。`Vercel` status自体の成功も必須。
- マージ直前にもhead/base SHAが一致し、PRがマージ可能であること。merge APIにも確認済みhead SHAを渡す。

判定workflowは信頼済みのdefault branchだけをcheckoutし、PRのコードや依存パッケージをmerge権限付きで実行しません。GitHub標準のauto-merge設定や管理権限には依存せず、Actionsのtokenでmerge APIを呼びます。branch protectionなどGitHub側の制限で拒否された場合は強制マージせずworkflowを失敗させます。管理者設定を取得する権限はなく、その保護を新規設定したという意味ではありません。

Vercel完了や再実行を拾うため定期的にも再確認します。手動起動の `dry_run` は既定でtrueです。停止する場合はこのworkflowを無効化します。`GITHUB_TOKEN` によるマージでは通常、追加のpush用Actionsは起動しないため、マージ前のPR用Security checksを必須にしています。本番デプロイ完了はこのworkflowのマージ条件とは別です。

## 廃止した X 自動化の外部登録

X 投稿・週次レビュー・成長計測・自動改善 PR の実装と専用 workflow は撤去しました。2026-10-23 のクラウド作業では、接続された automation 検索は0件で、手元 PC のローカル登録にはアクセスできず、登録の削除は未完了です。

削除対象は `~/.codex/automations/` 内の `nazomatic`（週末サマリ）、`nazomatic-x`、`nazomatic-x-2`、`nazomatic-x-3`、`nazomatic-x-4`、`nazomatic-x-5`、`nazomatic-x-6`、`nazomatic-x-pr` です。登録 ID と実際の内容を照合して削除し、無関係の `nazomatic-git-cleanup` は維持します。コード撤去だけで手元の登録が削除されたとは扱いません。

## Git cleanup

X 投稿と独立した `nazomatic-git-cleanup` は維持します。登録先は手元 PC の `~/.codex/automations/nazomatic-git-cleanup/automation.toml`、実行時刻は毎日 02:30 JST（`Asia/Tokyo`）、実行環境は local です。正確な状態・model・通知設定は Codex automation 側を正とし、現在のクラウド環境から登録状態は確認していません。

`sync-main-and-clean-worktrees` スキルに従い、最初に `.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh` を引数なしで dry-run します。成功した場合だけ同じスクリプトを `--execute` 付きで1回実行し、`future` と安全に更新できるローカル `main` を `origin/main` へ fast-forward した後、マージ済みの worktree・local branch・remote branch を整理します。

ローカル `main` が missing・diverged・dirty・locked・stale、または更新に失敗した場合は、`main` だけを skip して cleanup を続けます。target の `future` が dirty・non-fast-forward、または fetch・push・target ancestry check が失敗した場合は回避せず、その夜の実行を skip として報告します。変更候補がない no-op は正常終了です。手動 merge、reset、force-push、`git branch -D`、独自の削除、automation 層からの retry は行いません。通知は失敗時のみとし、結果は Codex automation の run 結果と `~/.codex/automations/nazomatic-git-cleanup/memory.md` で確認します。詳細な実行手順は [開発ガイド](../../development-guide.md) を参照します。

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

自動 test は `npm run test:security`（Node 標準 test runner、`scripts/security/*.test.mjs`）で Editor API の認証を確認します。変更対象に応じて検証を選びます。`npm run lint` はスキル構成とコードの静的検査、`npm run test:security` は Editor API 認証の回帰確認、`npm run build` はビルドへの影響の確認に使います。API・画面の挙動変更には対象の API dry-run・ブラウザ手動確認を使います。Shift Search artifact の更新は両生成 command の差分を確認します。

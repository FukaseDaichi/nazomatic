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
| `dependabot-auto-fix.yml` | 毎時47分 UTC・手動 | CIが落ちたDependabot PRをClaudeで修正し、修正済みPRを最新の `main` に追従させる |

内部 API を呼ぶ定期実行 Workflow は `REALTIME_API_BASE_URL` と `REALTIME_API_TOKEN` secrets を使います。token 値はアプリの `REALTIME_INTERNAL_API_TOKEN` と一致させます。

## 依存PRの自動マージ

npmとGitHub ActionsのDependabot PRを、メジャー更新も含めて自動マージします。対象は `dependabot[bot]`（GitHub IDも照合）が同一リポジトリ内に作成した、`main` 向けのopen・非draft PRで、`dependabot-needs-review` ラベルが付いていないものだけです。通常の開発は引き続き `future → main` で進めます。

`scripts/dependabot-auto-merge.mjs` は現在のhead SHAについて次のすべてを確認します。

- 現在の `main` を含むこと。遅れている場合はDependabotによるrebaseとCI再実行を待つ。
- `security-checks.yml` の最新の検証実行が成功（監査・認証/自動マージ/自動修正の回帰テスト・lint・build）。検証実行は `pull_request` 実行か、自動修正がPRブランチに対して起動した `workflow_dispatch` 実行に限る。push実行や別workflowの成功だけでは許可しない。
- すべての最新check-runと各contextの最新commit statusが成功。失敗・実行中・skipped・neutral・情報不足は待機する。`Vercel` status自体の成功も必須。
- マージ直前にもhead/base SHAが一致し、PRがマージ可能であること。merge APIにも確認済みhead SHAを渡す。

判定workflowは信頼済みのdefault branchだけをcheckoutし、PRのコードや依存パッケージをmerge権限付きで実行しません。GitHub標準のauto-merge設定や管理権限には依存せず、Actionsのtokenでmerge APIを呼びます。branch protectionなどGitHub側の制限で拒否された場合は強制マージせずworkflowを失敗させます。管理者設定を取得する権限はなく、その保護を新規設定したという意味ではありません。

Vercel完了や再実行を拾うため定期的にも再確認します。手動起動の `dry_run` は既定でtrueです。停止する場合はこのworkflowを無効化します。`GITHUB_TOKEN` によるマージでは通常、追加のpush用Actionsは起動しないため、マージ前のPR用Security checksを必須にしています。本番デプロイ完了はこのworkflowのマージ条件とは別です。

## 依存PRの自動修正

`dependabot-auto-fix.yml` は、Security checks が失敗したDependabot PRを Claude Code で修正し、push までを自動で行います。マージは上記の自動マージに任せます。対象の判定は自動マージと同じで、`main` に追いついていて、最新の検証実行が失敗しているPRを1回の実行で1件だけ扱います。

- 認証: Claude Code は Pro / Max サブスクリプションの OAuth トークンを repository secret `CLAUDE_CODE_OAUTH_TOKEN` から使う（`claude setup-token` で発行）。未設定の間は修正をスキップする。Anthropic API キーは使わない。
- 修正: 失敗したCIログだけを Claude に渡し、PR本文（外部のリリースノート）は渡さない。使えるツールは `Read`・`Grep`・`Glob`・`Edit` だけで、コマンド実行・Web取得・新規ファイル作成はできない。依存は `npm ci --ignore-scripts` で入れ、トークンと同じジョブで依存パッケージのコードを実行しない。
- 検証: 別ジョブ（secretなし）でパッチを当て、`test:security`・`lint`・`build` を実行する。
- 反映: さらに別ジョブで、信頼済みの `main` のスクリプトがパッチの範囲を確認してから push する。許可するのは `src/` 配下（`src/generated/` を除く）の既存ファイルの変更だけで、変更行数は合計150行まで。`GITHUB_TOKEN` のpushでは `pull_request` 実行が起動しないため、PRブランチに対して Security checks を `workflow_dispatch` で起動する。
- 結果: 試行ごとにPRへコメントする。試行はPRごとに2回まで。使い切ってもCIが通らないPRには `dependabot-needs-review` ラベルを付けて人に渡す。
- メジャー更新（`0.x` のマイナー更新とタイトルから判定できない更新を含む）は、修正を push する前にラベルを付け、自動マージの対象から外す。ラベルを付けられなければ push しない。差分を確認してラベルを外すと、自動処理に戻る。
- 追従: 修正コミットが入ったPRはDependabotがrebaseしなくなるため、`main` より遅れたら update-branch API で `main` を取り込む。競合などで取り込めないPRにはラベルを付けて人に渡し、他のPRの処理は続ける。現在のheadに検証実行がなければ Security checks を起動する。
- 対象外: Vercel だけが失敗したPRは、ログを取得できないため扱わない。`next`・`eslint-config-next`・`react`・`react-dom` とその型定義のメジャー更新は `.github/dependabot.yml` で除外し、計画的な移行として別途対応する。`typescript` 7 以降も同様に除外する。TypeScript 7 の `typescript` パッケージは JS コンパイラ API を持たず、`eslint-config-next` 経由の `typescript-eslint`（peer `<6.1.0`）と `scripts/security/*.test.mjs` の `ts.transpileModule` が動かないため、両者が対応するまで 6.0 系に留める。

停止する場合はこのworkflowを無効化します。

## 廃止した X 自動化の撤去確認

X 投稿・週次レビュー・成長計測・自動改善 PR の実装と専用 workflow は撤去済みです。2026-10-23 に手元 PC で、対象の automation 8件（`nazomatic`、`nazomatic-x`、`nazomatic-x-2`〜`nazomatic-x-6`、`nazomatic-x-pr`）がアプリとローカル設定ディレクトリの両方に存在しないことを確認しました。

投稿専用 Chrome を停止し、ローカルの実行ログ、投稿台帳・状態・計測データ・生成画像、専用 Chrome プロファイル、専用環境設定、旧実装の作業ログを削除しました。共用 `.env.local` からは廃止した X API 認証情報だけを削除し、Realtime の認証情報は維持しています。

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

# NAZOMATIC 開発ガイド

## 位置づけ

この文書は、開発時に必要なセットアップ、コマンド、環境変数、生成手順、検証方針をまとめます。システム構造は `docs/system-design.md`、サブシステム詳細は各設計書を参照します。

## セットアップ

```bash
npm install
npm run dev
```

開発サーバーは既定で `http://localhost:3000` です。

## コマンド

| コマンド | 用途 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | production build |
| `npm run start` | production server を起動 |
| `npm run lint` | ESLint |
| `npm run x:browser-post` | X API を使わないローカルブラウザ投稿 CLI |
| `npm run x:browser-post:weekend-summary` | `#謎チケ売ります` の週末土日別件数をローカルブラウザで投稿する CLI |
| `npm run shift:report:meta` | Shift Search レポート元成果物から manifest / index を生成 |
| `npm run shift:report:view-assets` | Shift Search レポート表示用 JSON を `src/generated/shift-search` に生成 |

テストフレームワークは未設定です。変更内容に応じて `npm run lint`、`npm run build`、ブラウザでの手動確認を使い分けます。

## 環境変数

### 共通

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | metadata、sitemap、JSON-LD の base URL | `https://nazomatic.vercel.app` |

### Firestore 設定

`src/server/firebase/admin.ts` は以下いずれかで Firebase Admin SDK を初期化します。

| 方式 | 変数 |
|---|---|
| サービスアカウント JSON | `FIREBASE_SERVICE_ACCOUNT` |
| 個別指定 | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

どちらも未設定の場合は `initializeApp()` の既定認証に委ねます。

### 内部 API

| 変数 | 用途 |
|---|---|
| `REALTIME_INTERNAL_API_TOKEN` | `/api/internal/realtime/*`、`/api/internal/x/repost/events`、`/api/internal/x/browser-post/*` の Bearer 認証 |

GitHub Actions では `REALTIME_API_TOKEN` secret として同じ値を渡します。

### X 再投稿

現行の `x-repost-events.yml` は X API を使う実装です。X API を使わずローカルのログイン済みブラウザセッションで投稿する実装は `npm run x:browser-post` から実行し、詳細は `docs/x-browser-posting/design.md` に置きます。

#### ローカルブラウザ投稿案

ローカルブラウザ投稿では、X の認証情報ではなく、投稿を許可するアカウント handle や確認モードだけを Git 管理外の `.env.x-browser-posting.local` に置きます。`storage state` や `user data dir` は認証済みセッション相当の秘密情報として扱います。

| 変数 | 用途 |
|---|---|
| `X_BROWSER_POST_ACCOUNT_HANDLE` | 投稿を許可する X handle。ログイン中アカウント照合に使う |
| `X_BROWSER_POST_STORAGE_STATE` | Playwright storage state path |
| `X_BROWSER_POST_USER_DATA_DIR` | Playwright persistent context の user data dir |
| `X_BROWSER_POST_CHROME_EXECUTABLE_PATH` | 通常 Chrome の実行ファイル path。`--login-only` ではこれを直接起動する |
| `X_BROWSER_POST_CDP_URL` | 起動済み通常 Chrome へ接続する DevTools URL |
| `X_BROWSER_POST_REMOTE_DEBUGGING_PORT` | `--login-only` で通常 Chrome を起動するときの remote debugging port |
| `X_BROWSER_POST_AUTO_START_CHROME` | CDP 接続できないときに通常 Chrome を自動起動するか。既定 `true` |
| `X_BROWSER_POST_CLEANUP_COMPOSE_TABS` | 実行開始時に古い X 投稿作成タブを閉じるか。既定 `true` |
| `X_BROWSER_POST_REQUIRE_CONFIRMATION` | 投稿前確認を要求するか。既定 `true` |
| `X_BROWSER_POST_ALLOW_UNATTENDED` | 互換用の確認なし投稿許可。既定 `false` |
| `X_BROWSER_POST_CONFIRMATION_MODE` | `interactive` または `auto`。既定 `interactive` |
| `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED` | `CONFIRMATION_MODE=auto` を有効にする二重ロック |
| `X_BROWSER_POST_COMMENT` | 静的テンプレートのランダム選択を使わず、固定コメントで上書きする場合の文面。空欄または空白だけなら静的テンプレートを使う |
| `X_BROWSER_POST_WEEKEND_SUMMARY_LINE` | 週末サマリ投稿の一言。空欄ならローカル候補文を使う |
| `X_BROWSER_POST_WEEKEND_SUMMARY_COPY_PATTERN` | 週末サマリ投稿の文案パターン固定。空欄ならランダム |
| `X_BROWSER_POST_WEEKEND_SUMMARY_POST_WHEN_ZERO` | `true` なら土日合計0件でも週末サマリを投稿候補にする |
| `X_BROWSER_POST_MAX_PER_RUN` | 1 実行あたりの投稿上限 |
| `X_BROWSER_POST_COOLDOWN_MINUTES` | cooldown 分数 |
| `X_BROWSER_POST_DAILY_LIMIT` | 1 日投稿上限 |

設定の雛形は `.env.x-browser-posting.example` です。dry-run は投稿ボタン押下と DB 更新をしません。フォローコメントは通常 `src/server/x-browser-posting/comment-patterns.json` の 50 パターンからランダム選択され、`--comment` または `X_BROWSER_POST_COMMENT` が空白除去後に空でない場合だけその文面で上書きします。

```bash
cp .env.x-browser-posting.example .env.x-browser-posting.local
npm run x:browser-post -- --login-only
npm run x:browser-post
npm run x:browser-post -- --execute
npm run x:browser-post:weekend-summary
npm run x:browser-post:weekend-summary -- --copy-pattern ai_self_deprecation --line "AIの私は現地に行けないので、今日も一人でXとにらめっこしています。"
```

`--login-only` は候補取得や内部 API 呼び出しをせず、`X_BROWSER_POST_CHROME_EXECUTABLE_PATH` の通常 Chrome を直接起動し、`X_BROWSER_POST_USER_DATA_DIR` の Chrome プロファイルで `https://x.com/login` を開きます。Chrome for Testing を避けたい初回ログイン用です。初回ログイン後は、通常投稿時に `X_BROWSER_POST_CDP_URL` へ接続し、接続できなければ `X_BROWSER_POST_AUTO_START_CHROME=true` で同じ専用 profile の通常 Chrome を自動起動します。

実投稿時は `--execute` を付けます。人間確認を省略するには `.env.x-browser-posting.local` で `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` を両方指定します。

週末サマリ投稿も実投稿時は `--execute` を付けます。`--line` または `X_BROWSER_POST_WEEKEND_SUMMARY_LINE` で一言を上書きできます。文案パターンを固定したい場合は `--copy-pattern` または `X_BROWSER_POST_WEEKEND_SUMMARY_COPY_PATTERN` を使います。指定しない場合は、prepare API が返すローカル候補文を使います。投稿結果は Firestore に保存せず、同一 PC の二重投稿防止用に `local/x-browser-posting/weekend-summary-state.json` へ最小限のキーだけ保存します。

#### 現行 X API 再投稿

| 変数 | 用途 |
|---|---|
| `X_API_KEY` | X API OAuth 1.0a consumer key |
| `X_API_SECRET` | X API OAuth 1.0a consumer secret |
| `X_ACCESS_TOKEN` | X API access token |
| `X_ACCESS_TOKEN_SECRET` | X API access token secret |
| `X_USER_ID` | 再投稿を行う X user id |

### BLANK25 Editor / storage 設定

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `BLANK25_EDITOR_USER` | Editor Basic 認証ユーザー | なし |
| `BLANK25_EDITOR_PASSWORD` | Editor Basic 認証パスワード | なし |
| `GITHUB_TOKEN` | `nazomatic-storage` へ commit する GitHub token | なし |
| `BLANK25_EDITOR_GITHUB_OWNER` | storage repo owner | なし |
| `BLANK25_EDITOR_GITHUB_REPO` | storage repo name | なし |
| `BLANK25_EDITOR_GITHUB_BRANCH` | storage repo branch | `main` |
| `NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE` | BLANK25 画像配信用 raw URL base | `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main` |

`BLANK25_EDITOR_GITHUB_REPO` は `nazomatic-storage` を指す前提です。

## GitHub Actions 運用

| Workflow | 起動 | 対象 API |
|---|---|---|
| `realtime-register.yml` | 毎時 0 分 | `POST /api/internal/realtime/register`、`#謎チケ売ります` |
| `realtime-register-transfer.yml` | 毎時 15 分 | `POST /api/internal/realtime/register`、`#謎チケ譲ります` |
| `realtime-register-accompany.yml` | 毎時 30 分 | `POST /api/internal/realtime/register`、`#謎解き同行者募集` |
| `realtime-verify-post-visibility.yml` | 毎時 45 分 | `POST /api/internal/realtime/verify-post-visibility` |
| `realtime-prune.yml` | 毎日 00:15 UTC | `POST /api/internal/realtime/prune` |
| `x-repost-events.yml` | 手動実行のみ | `POST /api/internal/x/repost/events` |

`x-repost-events.yml` の自動 schedule は、X 投稿 credits の都合でコメントアウトされています。

## Shift Search レポート更新

Shift Search のレポートは、元成果物と Next.js 表示用 assets が分かれています。

1. `artifacts/shift-search/reports/{jp|en}` に Markdown レポートを配置する。
2. 必要に応じて `artifacts/shift-search/reports/shift-search-external-links.json` を更新する。
3. `npm run shift:report:meta` を実行する。
4. `npm run shift:report:view-assets` を実行する。
5. `artifacts/shift-search/reports/*` と `src/generated/shift-search/*` の差分を確認する。

詳細は `docs/shift-search/design.md` を参照します。

## ドキュメント更新方針

- ドキュメントは日本語で書きます。
- `AGENTS.md` は例外的に英語の短いエージェント向け実行ルールとして管理します。
- 実装と矛盾した場合は、ソースコードを正としてドキュメントを修正します。
- サブシステムの詳細は以下に集約します。
  - BLANK25: `docs/blank25/design.md`
  - 謎チケカレンダー / Realtime: `docs/calendar-realtime/design.md`
  - Shift Search: `docs/shift-search/design.md`
- 新しい設計書を追加した場合は `docs/README.md` も更新します。

## 変更時チェック

- 新規公開ページをメイン導線に出す場合は `src/lib/json/features.json` を更新したか。
- `features.json` の順序変更時に JSON-LD の index 参照影響を確認したか。
- 外部取得をクライアントから直接行わず `/api/*` 側に置いたか。
- 内部 API の Bearer 認証、BLANK25 Editor の Basic 認証を維持したか。
- UI / フォーム変更時に `docs/ai-coding-rules.md` を満たしているか。
- Shift Search レポート更新時に `src/generated/shift-search/*` を同期したか。

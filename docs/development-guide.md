# NAZOMATIC 開発ガイド

## 位置づけ

この文書は、開発時に必要なセットアップ、コマンド、環境変数、生成手順、検証方針をまとめます。現行システム設計は `docs/system-design/README.md` を参照します。

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
| `npm run x:browser-post:trend-joke` | Yahoo!リアルタイム検索で拾ったイベント名を材料に短文ネタ投稿を行う CLI |
| `npm run x:growth-review` | 直近7日の X 運用を集計し、必要に応じて GitHub Issue を作る CLI |
| `npm run x:growth-improve` | 週次レビューから改善実験を1件提案し、`--execute` 時だけドラフト PR を作る CLI |
| `npm run shift:report:meta` | Shift Search レポート元成果物から manifest / index を生成 |
| `npm run shift:report:view-assets` | Shift Search レポート表示用 JSON を `src/generated/shift-search` に生成 |

テストフレームワークは未設定です。変更内容に応じて `npm run lint`、`npm run build`、ブラウザでの手動確認を使い分けます。

## 広告表示

公開メイン領域の Google Ad は `src/components/googleAd/google-ad-component.tsx` で表示します。localhost、PWA standalone、X アプリ内ブラウザまたは `x.com` / `twitter.com` / `t.co` 経由で開かれたセッションでは広告を表示しません。

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
| `INTERNAL_API_SIGNING_SECRET` | 内部 API 署名の HMAC key。未設定時は `REALTIME_INTERNAL_API_TOKEN` を使う |
| `INTERNAL_API_ALLOW_UNSIGNED` | `true` のとき署名なし request を受理する緊急用の逃げ道。通常は設定しない |

GitHub Actions では `REALTIME_API_TOKEN` secret として同じ値を渡します。`INTERNAL_API_SIGNING_SECRET` を設定する場合は、アプリと Actions secret の両方へ同じ値を入れます。

内部 API は Bearer token に加えて HMAC 署名を要求します。詳細は `docs/system-design/architecture/data-and-security.md` を参照します。client 実装は `scripts/internal-api/signing.mjs`（Node）と `scripts/internal-api/post.sh`（GitHub Actions）にあります。

### X 再投稿

`x-repost-events.yml` は X API を使う実装です。X API を使わずローカルのログイン済みブラウザセッションで投稿する実装は `npm run x:browser-post` から実行し、設計は `docs/system-design/subsystems/x-posting.md` を参照します。

#### ローカルブラウザ投稿

ローカルブラウザ投稿では、X の認証情報ではなく、投稿を許可するアカウント handle や確認モードだけを Git 管理外の `.env.x-browser-posting.local` に置きます。`storage state` や `user data dir` は認証済みセッション相当の秘密情報として扱います。

| 変数 | 用途 |
|---|---|
| `X_BROWSER_POST_ACCOUNT_HANDLE` | 投稿を許可する X handle。ログイン中アカウント照合に使う |
| `X_BROWSER_POST_HASHTAG` | 個別イベント引用投稿の対象 hashtag。未設定時は `#謎チケ売ります` |
| `X_BROWSER_POST_API_BASE_URL` | ローカル CLI が呼び出す API origin。未設定時は `REALTIME_API_BASE_URL`、`NEXT_PUBLIC_BASE_URL`、`http://localhost:3000` の順に使う |
| `X_BROWSER_POST_INTERNAL_TOKEN` | ローカル CLI が内部 API に送る Bearer token。未設定時は `REALTIME_INTERNAL_API_TOKEN` または `REALTIME_API_TOKEN` を使う |
| `X_BROWSER_POST_STORAGE_STATE` | Playwright storage state path |
| `X_BROWSER_POST_USER_DATA_DIR` | Playwright persistent context の user data dir |
| `X_BROWSER_POST_BROWSER_CHANNEL` | Playwright が使う browser channel。通常 Chrome を使う場合は `chrome` |
| `X_BROWSER_POST_CHROME_EXECUTABLE_PATH` | 通常 Chrome の実行ファイル path。`--login-only` ではこれを直接起動する |
| `X_BROWSER_POST_CDP_URL` | 起動済み通常 Chrome へ接続する DevTools URL |
| `X_BROWSER_POST_REMOTE_DEBUGGING_PORT` | `--login-only` で通常 Chrome を起動するときの remote debugging port |
| `X_BROWSER_POST_AUTO_START_CHROME` | CDP 接続できないときに通常 Chrome を自動起動するか。既定 `true` |
| `X_BROWSER_POST_CHROME_STARTUP_TIMEOUT_MS` | Chrome 自動起動後に CDP 接続を待つ最大時間。既定 `20000` |
| `X_BROWSER_POST_CLEANUP_COMPOSE_TABS` | 実行開始時に古い X 投稿作成タブを閉じるか。既定 `true` |
| `X_BROWSER_POST_BRING_TO_FRONT` | `false` なら focus emulation を使い、Chrome tab を前面化せず入力する。既定 `true` |
| `X_BROWSER_POST_HEADLESS` | 自動起動する CDP 用 Chrome を `--headless=new` で動かすか。`--login-only` には適用しない。既定 `false` |
| `X_BROWSER_POST_KEEP_OPEN` | 実行後にブラウザを開いたままにするか。既定 `false` |
| `X_BROWSER_POST_CAPTURE_TELEMETRY` | 投稿成功後に同じ CDP セッションでフォロワー数と過去投稿の公開数値を取得し台帳へ記録するか。既定 `true` |
| `X_BROWSER_POST_METRICS_MAX_PER_RUN` | 1 実行で公開数値を後追い取得する過去投稿の上限。既定 `8`。取得済みは再取得しない |
| `X_BROWSER_POST_RESERVED_BY` | Firestore lease の `reservedBy` に入れるローカル識別子。未設定時は `user@hostname` |
| `X_BROWSER_POST_REQUIRE_CONFIRMATION` | 投稿前確認を要求するか。既定 `true` |
| `X_BROWSER_POST_ALLOW_UNATTENDED` | 互換用の確認なし投稿許可。既定 `false` |
| `X_BROWSER_POST_CONFIRMATION_MODE` | `interactive` または `auto`。既定 `interactive` |
| `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED` | `CONFIRMATION_MODE=auto` を有効にする二重ロック |
| `X_BROWSER_POST_COMMENT` | 静的テンプレートのランダム選択を使わず、固定コメントで上書きする場合の文面。空欄または空白だけなら静的テンプレートを使う |
| `X_BROWSER_POST_WEEKEND_SUMMARY_LINE` | 週末サマリ投稿の一言。空欄ならローカル候補文を使う |
| `X_BROWSER_POST_WEEKEND_SUMMARY_COPY_PATTERN` | 週末サマリ投稿の文案パターン固定。空欄ならランダム |
| `X_BROWSER_POST_WEEKEND_SUMMARY_POST_WHEN_ZERO` | `true` なら土日合計0件でも週末サマリを投稿候補にする |
| `X_BROWSER_POST_TREND_JOKE_LINE` | 謎解き界隈トレンドのネタ投稿文。空欄なら provider またはローカル候補文を使う |
| `X_BROWSER_POST_TREND_JOKE_COPY_PROVIDER` | トレンドネタ投稿の文案生成 provider。`fallback` / `codex` / `command`。未設定時は `fallback` |
| `X_BROWSER_POST_TREND_JOKE_CODEX_MODEL` | `codex` provider で使うモデル。空欄なら Codex CLI の既定モデル |
| `X_BROWSER_POST_TREND_JOKE_PROVIDER_COMMAND` | `command` provider の shell command。stdin の JSON を読み、JSON または本文を stdout に返す |
| `X_BROWSER_POST_TREND_JOKE_PROVIDER_TIMEOUT_MS` | 文案生成 provider のタイムアウト。未設定時は `120000` |
| `X_BROWSER_POST_TREND_JOKE_PROVIDER_ATTEMPTS` | 文案生成 provider の試行回数。未設定時は `2`、最大 `3` |
| `X_BROWSER_POST_TREND_JOKE_PROVIDER_AUTO_APPROVE` | provider 生成文を `CONFIRMATION_MODE=auto` で投稿するための追加ロック。初期は `false` 推奨 |
| `X_BROWSER_POST_TREND_JOKE_TOPIC` | ネタ投稿の topic 固定。空欄なら検索結果からランダム |
| `X_BROWSER_POST_TREND_JOKE_QUERY_BUNDLE` | 検索 query bundle 固定。空欄ならランダム |
| `X_BROWSER_POST_TREND_JOKE_SEARCH_QUERIES` | カンマ区切りで検索 query を直接指定する |
| `X_BROWSER_POST_TREND_JOKE_MAX_SEARCH_QUERIES` | 1 prepare あたりの検索 query 数上限 |
| `X_BROWSER_POST_TREND_JOKE_MAX_POSTS_PER_QUERY` | 1 query あたりの取得 post 数上限 |
| `X_BROWSER_POST_TREND_JOKE_RUN_SLOT` | 1日複数回実行時のローカル二重投稿防止用実行枠。空欄なら CLI が日内連番で自動採番 |
| `X_BROWSER_POST_TREND_JOKE_ARCHETYPE` | 投稿型の固定。`monologue` / `question` / `one_liner` / `poll` / `tool_intro`。空欄なら直近履歴から順番にローテーション |
| `X_BROWSER_POST_TREND_JOKE_IMAGE_PATH` | `tool_intro` へ添付する画像 path。空欄なら `public/img/og-image.png` |
| `X_BROWSER_POST_LOG_RETENTION_COUNT` | 各ローカルブラウザ投稿 automation の実行ログを残す世代数。未設定時は `70` |
| `X_BROWSER_POST_MAX_PER_RUN` | 1 実行あたりの投稿上限 |
| `X_BROWSER_POST_COOLDOWN_MINUTES` | cooldown 分数 |
| `X_BROWSER_POST_DAILY_LIMIT` | 1 日投稿上限。既定 `6`、ローカル CLI の上限 `30` |

設定の雛形は `.env.x-browser-posting.example` です。dry-run は投稿ボタン押下と DB 更新をしません。フォローコメントは通常 `src/server/x-browser-posting/comment-patterns.json` の 50 パターンからランダム選択され、`--comment` または `X_BROWSER_POST_COMMENT` が空白除去後に空でない場合だけその文面で上書きします。

```bash
cp .env.x-browser-posting.example .env.x-browser-posting.local
npm run x:browser-post -- --login-only
npm run x:browser-post
npm run x:browser-post -- --execute
npm run x:browser-post:weekend-summary
npm run x:browser-post:weekend-summary -- --copy-pattern ai_self_deprecation --line "AIの私は現地に行けないので、今日も一人でXとにらめっこしています。"
npm run x:browser-post:trend-joke
npm run x:browser-post:trend-joke -- --query-bundle title_aruaru_words --print-prompt
npm run x:browser-post:trend-joke -- --copy-provider codex
npm run x:growth-review
npm run x:growth-review -- --create-issue
npm run x:growth-improve
npm run x:growth-improve -- --execute
```

`--login-only` は候補取得や内部 API 呼び出しをせず、`X_BROWSER_POST_CHROME_EXECUTABLE_PATH` の通常 Chrome を直接起動し、`X_BROWSER_POST_USER_DATA_DIR` の Chrome プロファイルで `https://x.com/login` を開きます。Chrome for Testing を避けたい初回ログイン用です。初回ログイン後は、通常投稿時に `X_BROWSER_POST_CDP_URL` へ接続し、接続できなければ `X_BROWSER_POST_AUTO_START_CHROME=true` で同じ専用 profile の通常 Chrome を自動起動します。

実投稿時は `--execute` を付けます。人間確認を省略するには `.env.x-browser-posting.local` で `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` を両方指定します。

週末サマリ投稿も実投稿時は `--execute` を付けます。`--line` または `X_BROWSER_POST_WEEKEND_SUMMARY_LINE` で一言を上書きできます。文案パターンを固定したい場合は `--copy-pattern` または `X_BROWSER_POST_WEEKEND_SUMMARY_COPY_PATTERN` を使います。指定しない場合は、prepare API が返すローカル候補文を使います。投稿結果は Firestore に保存せず、同一 PC の二重投稿防止用に `local/x-browser-posting/weekend-summary-state.json` へ最小限のキーだけ保存します。

トレンドネタ投稿も実投稿時は `--execute` を付けます。Firestore は読まず、prepare API が Yahoo!リアルタイム検索を少数回実行し、イベント名サンプルや頻出語から topic とローカル候補文を返します。文案生成 provider を使う場合は `--copy-provider codex` または `X_BROWSER_POST_TREND_JOKE_COPY_PROVIDER=codex` を指定します。provider 生成文は validator とローカル履歴ガードを通し、失敗時はローカル候補文へ戻ります。

投稿型は「独り言→質問→一言あるある→投票→ツール紹介」を直近履歴から自動ローテーションします。`--archetype` または `X_BROWSER_POST_TREND_JOKE_ARCHETYPE` は検証時にだけ固定します。自然な hashtag は最大1個、URL はツール紹介に指定された NAZOMATIC URL 1件だけを許可し、mention と emoji は禁止です。投票はネイティブ投票 UI、ツール紹介は既定で `public/img/og-image.png` を添付します。画像を変える場合は `--image-path` または `X_BROWSER_POST_TREND_JOKE_IMAGE_PATH` を使います。

文案を固定したい場合は `--line` または `X_BROWSER_POST_TREND_JOKE_LINE`、検索 bundle を固定したい場合は `--query-bundle` または `X_BROWSER_POST_TREND_JOKE_QUERY_BUNDLE` を使います。投稿結果は Firestore に保存せず、同一 PC の二重投稿防止用に `local/x-browser-posting/trend-joke-state.json` へ最小限のキーだけ保存します。`--run-slot` を指定しない場合は、CLI がローカル state を見て `slot-1`、`slot-2` のように日内連番で自動採番します。

Codex automation から provider 生成文を確認なしで実投稿する場合は、既存の `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` に加えて、`X_BROWSER_POST_TREND_JOKE_PROVIDER_AUTO_APPROVE=true` も必要です。初期は `interactive` で数回監視してから有効化します。

ローカルブラウザ投稿 CLI は、通常投稿、週末サマリ投稿、トレンドネタ投稿の実行ログを Git 管理外の `logs/{automationId}/` に保存します。ログには開始時刻、実行コマンド、標準出力、標準エラー、終了時刻、終了ステータスを残します。`X_BROWSER_POST_LOG_RETENTION_COUNT` で automation ごとの保持世代数を指定でき、未設定時は `70` 世代だけ残します。現行ローカル設定も70世代で、3時間ごとの通常投稿を含む7日分と余裕を確保します。

実投稿が成功すると、3種類の CLI は共通の `local/x-browser-posting/post-ledger.json` に投稿 URL と実験 metadata を保存します。`X_BROWSER_POST_CAPTURE_TELEMETRY=true`（既定）なら、続けて同じ CDP セッションでフォロワー数を `local/x-browser-posting/follower-snapshots.json` へ JST 日付単位で追記し、投稿から約24時間〜8日で未取得の過去投稿を最大 `X_BROWSER_POST_METRICS_MAX_PER_RUN` 件だけ開いて表示数・返信・リポスト・いいねを台帳の `metrics` に書き戻します。取得済みは `metrics.mature` で再取得しません。計測はベストエフォートで投稿処理を止めません。`npm run x:growth-review` は直近7日、実行 log、台帳の `metrics`、フォロワー snapshot を集計します。投稿別数値は台帳に無い投稿だけをログイン済み Chrome で追加確認します。`--create-issue` 付きでは `[X週次レビュー] YYYY-Www @account` の GitHub Issue を作り、同じ週の再実行は既存 Issue へのコメントになります。公開数値を取得できない場合は0とせず「取得不能」と出力します。

`npm run x:growth-improve` は最新の週次レビュー Issue 本文と直近7日の投稿台帳を読み、Codex CLI を read-only で呼んで allowlist 内の実験を1件提案します。Issue を取得できない場合は、その旨を示す代替文を入力にして続行します。dry-run には利用可能な `codex`、`--execute` には加えて認証済みの `gh` と Git remote が必要です。`--execute` を付けると、決定論的な Node.js 側が単一ファイル変更を検証し、branch・commit・ドラフト PR と `experiment-ledger.json` の open 実験を作成します。自動マージはしません。詳細は `docs/system-design/subsystems/x-growth-improve-agent.md` を参照します。

| Automation 名 | npm script | ログディレクトリ |
|---|---|---|
| NAZOMATIC X 投稿 | `x:browser-post` | `logs/x-browser-post/` |
| NAZOMATIC X トレンドジョーク投稿 | `x:browser-post:trend-joke` | `logs/x-browser-post-trend-joke/` |
| NAZOMATIC 週末謎チケサマリ投稿 | `x:browser-post:weekend-summary` | `logs/x-browser-post-weekend-summary/` |
| NAZOMATIC X 週次改善エージェント | `x:growth-improve` | `logs/x-growth-improve/` |

リポジトリ外のスケジューラーで稼働中の登録枠は `docs/system-design/operations/x-browser-post-schedules.md` を参照します。

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
| `realtime-verify-post-visibility.yml` | 毎時 10 分・45 分 | `POST /api/internal/realtime/verify-post-visibility` |
| `realtime-prune.yml` | 毎日 00:15 UTC | `POST /api/internal/realtime/prune` |
| `x-repost-events.yml` | 手動実行のみ | `POST /api/internal/x/repost/events` |

`x-repost-events.yml` の自動 schedule は、X 投稿 credits の都合でコメントアウトされています。

各 workflow は repo を checkout し、`scripts/internal-api/post.sh` 経由で署名付き request を送ります。curl の `--retry` は使いません。retry のたびに timestamp と nonce を作り直す必要があるため、retry は `post.sh` 側で行います。

## Shift Search レポート更新

Shift Search のレポートは、元成果物と Next.js 表示用 assets が分かれています。

1. `artifacts/shift-search/reports/{jp|en}` に Markdown レポートを配置する。
2. 必要に応じて `artifacts/shift-search/reports/shift-search-external-links.json` を更新する。
3. `npm run shift:report:meta` を実行する。
4. `npm run shift:report:view-assets` を実行する。
5. `artifacts/shift-search/reports/*` と `src/generated/shift-search/*` の差分を確認する。

詳細は `docs/system-design/subsystems/shift-search.md` を参照します。

## ドキュメント更新方針

- ドキュメントは日本語で書きます。
- `AGENTS.md` は例外的に英語の短いエージェント向け実行ルールとして管理します。
- 実装と矛盾した場合は、ソースコードを正としてドキュメントを修正します。
- サブシステムの詳細は `docs/system-design/subsystems/` に集約します。
- 新しい設計書を追加した場合は `docs/README.md` も更新します。

## 変更時チェック

- 新規公開ページをメイン導線に出す場合は `src/lib/json/features.json` を更新したか。
- `features.json` の順序変更時に JSON-LD の index 参照影響を確認したか。
- 外部取得をクライアントから直接行わず `/api/*` 側に置いたか。
- 内部 API の Bearer 認証、BLANK25 Editor の Basic 認証を維持したか。
- UI / フォーム変更時に `docs/ai-coding-rules.md` を満たしているか。
- Shift Search レポート更新時に `src/generated/shift-search/*` を同期したか。

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
| `npm run lint` | Agent Skill 参照スタブ検証後に ESLint を実行 |
| `npm run skills:sync` | `.agents/skills` の正本から `.claude/skills` の参照スタブを再生成 |
| `npm run skills:check` | Codex / Claude Code 共有 Agent Skill の構成、スタブ一致、パス規約を検証 |
| `npm run x:browser-post` | X API を使わないローカルブラウザ投稿 CLI |
| `npm run x:browser-post:weekend-summary` | `#謎チケ売ります` の週末土日別件数をローカルブラウザで投稿する CLI |
| `npm run x:browser-post:trend-joke` | Yahoo!リアルタイム検索で拾ったイベント名を材料に短文ネタ投稿を行う CLI |
| `npm run x:growth-review` | 直近7日の X 運用を集計し、必要に応じて GitHub Issue を作る CLI |
| `npm run x:growth-improve` | 週次レビューから改善実験を1件提案し、`--execute` 時だけドラフト PR を作る CLI |
| `npm run x:growth-maintain` | 投稿せず follower / metrics を回収し、実験の production activation と72時間後の自動 keep を照合する CLI |
| `npm run test:x-browser-posting` | `scripts/x-browser-posting/*.test.mjs` 全件の回帰テスト（X 文案 validator、proposal schema、patch 適用、review markdown、依存 bootstrap、成長メンテナンス） |
| `npm run shift:report:meta` | Shift Search レポート元成果物から manifest / index を生成 |
| `npm run shift:report:view-assets` | Shift Search レポート表示用 JSON を `src/generated/shift-search` に生成 |

汎用テストフレームワークは未設定です。X ブラウザ投稿の純粋ロジックには Node.js 標準 test runner を使います。変更内容に応じて `npm run test:x-browser-posting`、`npm run lint`、`npm run build`、ブラウザでの手動確認を使い分けます。

## Codex / Claude Code 共有 Agent Skill

### 正本と公開方法

リポジトリ固有スキルの唯一の編集元（正本）は `.agents/skills/<name>/` です。Codex はこのパスを直接探索し、`$<name>` または `/skills` で呼び出します。

Claude Code へは、`.claude/skills/<name>/SKILL.md` を**参照スタブ**としてコミットして公開します。スタブは次の条件を満たす通常ファイルです。

- frontmatter の `name` と `description` を正本と完全に一致させる。
- 本文には手順を書かず、正本 `.agents/skills/<name>/SKILL.md` を読ませる指示だけを書く。

Claude Code はディレクトリ名からコマンド名を決めるため、`.claude/skills/<name>/` に置けば `/<name>` で呼び出せます。スタブは `npm run skills:sync` が生成するので、手書きしません。

`CLAUDE.md` は `@AGENTS.md` を読み込み、`AGENTS.md` の "Shared Agent Skills" がこの節を参照します。したがって Codex と Claude Code のどちらでスキルを作成・インストール・更新しても同じ手順が適用されます。

### 参照スタブを採用する理由

手順の本体は正本にしか存在しないため、二重管理になるのは `description` の1行だけです。実体を読ませる方式なので、補助スクリプトや references も正本側から辿れます。OS、権限、Git 設定、チェックアウト方式に依存しないため、fresh clone、worktree 実行、クラウド実行、他 OS でも同じように登録されます。

次の方式は採用しません。過去に機能しなかったため、代替として提案し直さないでください。

- **symbolic link / junction**: Windows では Git の `core.symlinks=false` により、インデックスの mode が `120000` でも「リンク先パスが1行だけ書かれた通常ファイル」として checkout され、`SKILL.md` が存在しなくなります。junction は Git で可搬に表現できません。参照スタブに対する利点もありません。
- **ディレクトリ一式のコピー同期**: 参照スタブで実体を読ませれば足りるため不要で、二重管理とドリフトだけが増えます。
- **Claude Code 専用の Custom Prompt や `.claude/commands/`**: 共有スキルの代替にしません。

### 補助ファイルのパス規約

正本 `SKILL.md` からスクリプトや参照ファイルを指すパスは、必ずリポジトリルート相対で書きます。

```text
.agents/skills/<name>/scripts/foo.sh
```

スタブ経由で起動した場合、ホストが渡すスキルのベースディレクトリは `.claude/skills/<name>/` になります。`scripts/foo.sh` のようなスキルディレクトリ相対の書き方は解決できません。`npm run skills:check` はこの違反を検出して失敗します。

### 作成・インストール・更新・改名・削除の手順

1. `.agents/skills/<name>/` だけを編集する。フォルダ名と `SKILL.md` frontmatter の `name` を同じ kebab-case 名にする。
2. 補助スクリプト、references、assets、`agents/openai.yaml` を含め、スキルに必要なファイルをすべて正本側へ置く。`.claude/skills/` には置かない。
3. 外部からスキルをインストールする場合も、まず `.agents/skills/<name>/` へ展開し、`SKILL.md` 内の補助ファイル参照をリポジトリルート相対へ書き換える。
4. 改名・削除は正本側で行う。`npm run skills:sync` が不要になったスタブを削除する。
5. `npm run skills:sync` を実行し、`.claude/skills/` のスタブを再生成する。
6. `npm run skills:check` を実行する。差分があれば失敗するため、スタブを直接直さず正本を修正して再同期する。
7. `.agents/skills/` と `.claude/skills/` の差分を一緒に commit する。

`npm run lint` は `skills:check` を先に実行するため、通常の lint でも壊れた構成を検出できます。

### 検証

`npm run skills:check` は次を検証します。

- 正本の各エントリが実ディレクトリで、`SKILL.md` を持ち、フォルダ名と frontmatter `name` が一致すること。
- 正本の内部に非可搬な symbolic link が無いこと。
- 補助ファイル参照がリポジトリルート相対で書かれていること。
- スタブが実ディレクトリ配下の通常ファイルで、symbolic link でないこと。
- スタブの frontmatter が正本と一致し、本文が生成テンプレートと一致すること。
- スタブが frontmatter を持つこと（リンク先パスだけの壊れたファイルを検出）。
- スタブ配下に `SKILL.md` 以外のファイルが無いこと、正本に無いスタブが残っていないこと。
- `git ls-files -s -- .claude/skills/ .claude/commands/` に mode `120000` が現れないこと。

このリポジトリは `core.autocrlf=true` で `.gitattributes` を持たないため、fresh clone ではスタブが CRLF で checkout されます。検証は改行コードを正規化して比較し、内容が一致するスタブは書き換えません。

Windows で実体を確認する場合は次を使います。正常時は各 `<name>` が `Directory`、`LinkType` が空、`SKILL.md` が `True` で、Git インデックスには `100644` として現れます。

```powershell
Get-Item -Force .claude/skills/<name> |
  Format-List FullName,Attributes,LinkType,Target
git config --get core.symlinks
git ls-files -s -- .claude/skills/<name>
Test-Path .claude/skills/<name>/SKILL.md
npm run skills:check
```

Git インデックスの mode が `120000` でも、ワークツリー上では通常ファイルに展開されていることがあります。インデックスだけで symbolic link と断定せず、`Test-Path .claude/skills/<name>/SKILL.md` と内容が実際に読めることで判定します。また、ローカルで呼び出せることは共有できている証拠になりません。壊れたスタブでもモデルがパスを手繰って実行できてしまう場合があり、「ローカルでは動くがクラウド実行・worktree 実行では呼び出せない」はこの症状です。

symbolic link を実ファイルで上書きしただけでは Git の mode が `120000` のまま残ります。`core.symlinks=false` では作業ツリーもステータスも正常に見えますが、コミットすると symbolic link を復元する環境で本文全体がリンク先パスとして解釈され壊れます。次でモードごと登録し直し、`100644` になったことを確認します。

```powershell
git rm --cached .claude/skills/<name>/SKILL.md
git add .claude/skills/<name>/SKILL.md
git ls-tree -r $(git write-tree) -- .claude
```

Codex が更新を表示しない場合、または Claude Code のセッション開始時に `.claude/skills` 自体が存在しなかった場合は、同期後にセッションを再起動します。

### LEARNINGS.md ループ

各セッションの開始時にリポジトリ直下の `LEARNINGS.md` を読み、内容を1〜3行で要約します。セッション終了時は Claude Code では `/update-learnings`、Codex では `$update-learnings` または `/skills` から同スキルを実行し、再利用価値のある新しい洞察だけを日付付きで追記します。

週1回、または `Consolidated Principles` を除く生の観察が80〜100件に達したときは、Claude Code では `/consolidate-learnings`、Codex では `$consolidate-learnings` または `/skills` から同スキルを実行します。統合時に指示ファイルや別スキルへの転記が必要になった場合は、変更差分への承認を得てから適用します。

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
| `X_BROWSER_POST_TREND_JOKE_PROVIDER_COMMAND` | `command` provider の shell command。stdin の JSON を読み、JSON または本文を stdout に返す。prompt は子プロセスの環境変数 `X_BROWSER_POST_TREND_JOKE_COPY_PROMPT` でも渡される |
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
| `X_GROWTH_DEPENDENCY_CACHE_DIR` | X 週次改善の検証済み依存 cache の保存先。安全のため末尾は `x-growth-dependencies` 必須で symbolic link は不可。未設定時は OS の user cache 配下（macOS は `~/Library/Caches/nazomatic/x-growth-dependencies/`） |
| `X_BROWSER_POST_MAX_PER_RUN` | 1 実行あたりの投稿上限 |
| `X_BROWSER_POST_COOLDOWN_MINUTES` | cooldown 分数 |
| `X_BROWSER_POST_DAILY_LIMIT` | 1 日投稿上限。既定 `6`、システム上限 `30`。上限値の定義元は `src/server/x-browser-posting/post-limits.json` のみで、ローカル CLI（`scripts/x-browser-posting/config.mjs`）と内部 API（`src/server/x-browser-posting/candidate.ts`）が同じ値で判定します |

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
npm run x:growth-maintain
```

`--login-only` は候補取得や内部 API 呼び出しをせず、`X_BROWSER_POST_CHROME_EXECUTABLE_PATH` の通常 Chrome を直接起動し、`X_BROWSER_POST_USER_DATA_DIR` の Chrome プロファイルで `https://x.com/login` を開きます。Chrome for Testing を避けたい初回ログイン用です。初回ログイン後は、通常投稿時に `X_BROWSER_POST_CDP_URL` へ接続し、接続できなければ `X_BROWSER_POST_AUTO_START_CHROME=true` で同じ専用 profile の通常 Chrome を自動起動します。

実投稿時は `--execute` を付けます。人間確認を省略するには `.env.x-browser-posting.local` で `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` を両方指定します。

週末サマリ投稿も実投稿時は `--execute` を付けます。`--line` または `X_BROWSER_POST_WEEKEND_SUMMARY_LINE` で一言を上書きできます。文案パターンを固定したい場合は `--copy-pattern` または `X_BROWSER_POST_WEEKEND_SUMMARY_COPY_PATTERN` を使います。指定しない場合は、prepare API が返すローカル候補文を使います。投稿結果は Firestore に保存せず、同一 PC の二重投稿防止用に `local/x-browser-posting/weekend-summary-state.json` へ最小限のキーだけ保存します。

トレンドネタ投稿も実投稿時は `--execute` を付けます。Firestore は読まず、prepare API が Yahoo!リアルタイム検索を少数回実行し、イベント名サンプルや頻出語から topic とローカル候補文を返します。文案生成 provider を使う場合は `--copy-provider codex` または `X_BROWSER_POST_TREND_JOKE_COPY_PROVIDER=codex` を指定します。Codex の schema は JSON の構造だけを固定し、文字数や投票選択肢の規則はローカル validator で検査します。provider 生成文が不合格の場合はローカル候補文へ戻り、`provider_status`、`provider_error_code`、`fallback_reason` を log に残します。schema や認証 error は再試行せず、timeout、rate limit、生成文不合格など回復可能な error だけを設定回数まで再試行します。

投稿型は「独り言→質問→一言あるある→投票→ツール紹介」を直近履歴から自動ローテーションします。`--archetype` または `X_BROWSER_POST_TREND_JOKE_ARCHETYPE` は検証時にだけ固定します。自然な hashtag は最大1個、URL はツール紹介に指定された NAZOMATIC URL 1件だけを許可し、mention と emoji は禁止です。履歴類似判定では URL と末尾 hashtag を除外し、完全一致は全投稿型、意味類似は同じ投稿型を中心に検査します。投票はネイティブ投票 UI、ツール紹介は直近3回で使った tool path を候補が残る限り避け、既定で `public/img/og-image.png` を添付します。画像を変える場合は `--image-path` または `X_BROWSER_POST_TREND_JOKE_IMAGE_PATH` を使います。

文案を固定したい場合は `--line` または `X_BROWSER_POST_TREND_JOKE_LINE`、検索 bundle を固定したい場合は `--query-bundle` または `X_BROWSER_POST_TREND_JOKE_QUERY_BUNDLE` を使います。投稿結果は Firestore に保存せず、同一 PC の二重投稿防止用に `local/x-browser-posting/trend-joke-state.json` へ最小限のキーだけ保存します。`--run-slot` を指定しない場合は、CLI がローカル state を見て `slot-1`、`slot-2` のように日内連番で自動採番します。

Codex automation から provider 生成文を確認なしで実投稿する場合は、既存の `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` に加えて、`X_BROWSER_POST_TREND_JOKE_PROVIDER_AUTO_APPROVE=true` も必要です。初期は `interactive` で数回監視してから有効化します。

ローカルブラウザ投稿 CLI は、通常投稿、週末サマリ投稿、トレンドネタ投稿の実行ログを Git 管理外の `logs/{automationId}/` に保存します。ログには開始時刻、実行コマンド、標準出力、標準エラー、終了時刻、終了ステータスを残します。`X_BROWSER_POST_LOG_RETENTION_COUNT` で automation ごとの保持世代数を指定でき、未設定時は `70` 世代だけ残します。現行ローカル設定も70世代で、3時間ごとの通常投稿を含む7日分と余裕を確保します。

実投稿が成功すると、3種類の CLI は共通の `local/x-browser-posting/post-ledger.json` に投稿 URL と実験 metadata を保存します。`X_BROWSER_POST_CAPTURE_TELEMETRY=true`（既定）なら、続けて同じ CDP セッションでフォロワー数を `local/x-browser-posting/follower-snapshots.json` へ JST 日付単位で追記し、投稿から20時間〜8日で未取得の過去投稿を最大 `X_BROWSER_POST_METRICS_MAX_PER_RUN` 件だけ開いて表示数・返信・リポスト・いいねを台帳の `metrics` に書き戻します。`npm run x:growth-maintain` は投稿を行わず、この計測を日次で実行するための CLI です。成熟窓の終了が近い古い投稿から回収します。取得済みは `metrics.mature` で再取得しません。計測はベストエフォートで投稿処理を止めません。`npm run x:growth-review` は直近7日、実行 log、台帳の `metrics`、フォロワー snapshot を集計します。投稿別数値は台帳に無い投稿だけをログイン済み Chrome で追加確認します。`--create-issue` 付きでは `[X週次レビュー] YYYY-Www @account` の GitHub Issue を `x-growth-review` label 付きで作り、同じ週の再実行は既存 Issue へのコメントになります。公開数値を取得できない場合は0とせず「取得不能」と出力します。

`npm run x:growth-improve` は当週・account 固有の週次レビュー Issue 本文と直近14日の投稿台帳を読み、Codex CLI を read-only で呼んで allowlist 内の実験を1件提案します。提案は主要な仮説・targetKey・編集ファイルを各1件に保ちつつ、同一ファイル内で最大6件の局所 patch を使えるため、投稿生成戦略の複数行変更も可能です。Node 側は import、環境変数、外部 I/O、認証、投稿実行 guard、入力検証、各種上限を保護し、変更量も制限します。minimum sampleは5件、成熟時間は24時間、提案時のbaseline参照窓は14日に固定し、filterは0件または1件、選択metricで利用可能なsampleが5件以上あるfilterだけを提案候補にします。`--execute` は通常の開発 checkout とは分離した専用 automation checkout から起動し、テレメトリ成熟率が70%以上かつ5件以上であることを確認し、`origin/main` から作った一時 worktree 内だけで検証・commit・push・ドラフト PR 作成を行います。提案生成のCodex CLI timeoutは1200秒です。PR は `Closes #<review Issue>` と機械可読 metadata を持つため、PR が GitHub 上の実験の正本です。ローカルの実験台帳は作成しません。作成済みまたは進行中の実験、同じ targetKey の再提案、基底branchの検証失敗は PR を作りません。作成後は GitHub Actions が TypeScript、lint、X投稿回帰テスト、production build を再実行し、CI 成功・`x-growth-experiment` label・最新 commit の一致を確認できた PR を ready にして自動マージします。Production反映確認後は72時間のactive期間に入り、問題を示すlabelがなければ日次maintenanceが自動keepします。週次レビューは実験の勝敗を出力しません。`--execute` には認証済みの `gh`、Git remote、利用可能な `codex` が必要です。詳細は `docs/system-design/subsystems/x-growth-improve-agent.md` を参照します。

`--execute` の依存準備は package / lockfile と Node・npm・OS・CPU architecture を key にした検証済み `node_modules` cache を使います。cache miss だけ `npm ci` を実行し、timeout・process signal・一時的な network error では process group と不完全 worktree を破棄して新しい worktreeで1回だけ再試行します。決定的な install error、提案、guard、検証、GitHub 操作は再試行しません。失敗 log には両 attempt の exit code、signal、timeout、経過時間、stdout / stderr を残します。

| Automation 名 | npm script | ログディレクトリ |
|---|---|---|
| NAZOMATIC X 投稿 | `x:browser-post` | `logs/x-browser-post/` |
| NAZOMATIC X トレンドジョーク投稿 | `x:browser-post:trend-joke` | `logs/x-browser-post-trend-joke/` |
| NAZOMATIC 週末謎チケサマリ投稿 | `x:browser-post:weekend-summary` | `logs/x-browser-post-weekend-summary/` |
| NAZOMATIC X 週次改善レビュー | `x:growth-review` | GitHub の `x-growth-review` Issue。専用 local log なし |
| NAZOMATIC X 週次改善PR作成 | `x:growth-improve` | `logs/x-growth-improve/` |
| NAZOMATIC X 成長計測メンテナンス | `x:growth-maintain` | `logs/x-growth-maintain/` |

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
| `x-growth-pr-ci.yml` | `x-growth-experiment` PR の更新 | TypeScript、lint、X投稿回帰テスト、production build |
| `x-growth-auto-merge.yml` | `X Growth PR CI` 完了 | CI成功した対象 PR の自動マージ |

`x-repost-events.yml` の自動 schedule は、X 投稿 credits の都合でコメントアウトされています。

`x-growth-pr-ci.yml` は read-only token で `x-growth-experiment` PR のコードを検証します。`x-growth-auto-merge.yml` は書き込み権限を分離した `workflow_run` で動き、PR のコードを checkout しません。`verify` job が skip ではなく成功し、対象 PR が open、base が `main`、head SHA が CI 対象と一致し、`x-growth-experiment` label 付きである場合だけ、ドラフトを ready に変更して merge commit 方式でマージします。

内部 API を呼ぶ各定期実行 workflow は repo を checkout し、`scripts/internal-api/post.sh` 経由で署名付き request を送ります。curl の `--retry` は使いません。retry のたびに timestamp と nonce を作り直す必要があるため、retry は `post.sh` 側で行います。

### PR マージ後の `future` 同期と worktree 整理

自動処理用ブランチの PR を `main` へマージした後は、プロジェクトローカルの `$sync-main-and-clean-worktrees` スキルを使います。このスキルは `origin/main` を取得し、fast-forward 可能な場合だけ `future` を同期・pushします。`future` がまだ checkout されていない場合は、指定した `--repo`（省略時は現在の worktree）の clean な worktree へ checkout してから同期します。ローカル `main` が存在し、`origin/main` の祖先であれば `main` も fast-forward します。`main` が checkout 中なら worktree が存在し、ロックされておらず clean な場合だけ `merge --ff-only` を使い、未 checkout なら確認済みの旧 commit を条件にした atomic な ref 更新を使います。ローカル `main` が存在しない、分岐している、または checkout 先が dirty・locked・missing の場合は上書きせず skip します。その後、ロックされておらず、HEAD が `origin/main` に含まれる一時 worktree を、ignored・dirty・生成ファイルを含めて削除します。安全に worktree を整理できたブランチと、worktree を持たない merged ローカルブランチを `git branch -d` で削除し、同じ条件を満たす不要なリモートブランチも `git push origin --delete` で削除します。リポジトリ本体と `future` の worktree、`main`・`future`・`--keep-branch` で保護したローカル／リモートブランチは削除しません。

最初に dry-run で checkout、同期内容、worktree 削除、stale metadata の prune、ローカル／リモートブランチ削除の候補を確認します。dry-run でも fetch によってローカルの `origin/*` 参照は更新されますが、checkout・ブランチ更新・push・worktree削除・ブランチ削除は行いません。

```bash
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh
```

同期と安全な削除候補を実行する場合は `--execute` を付けます。`future` に未取り込みの commit がある場合、target worktree に未commit・未追跡ファイルがある場合、または fast-forward できない場合は停止し、merge や競合解決を自動実行しません。ignored ファイルだけなら target checkout を妨げません。ローカル base branch の安全条件を満たさない場合は、その branch の同期だけを skip して cleanup を続けます。別のブランチペアを対象にする場合は `--base NAME --target NAME` を指定できます。merged だが残したいローカル／リモートブランチは `--keep-branch NAME` で保護します。対応するローカルブランチが未merged・locked worktree で使用中の場合、そのリモートブランチも削除しません。

```bash
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --execute
```

この手順はCodexローカルautomation `nazomatic-git-cleanup` にACTIVE登録し、毎日02:30 JSTに実行します。automationは最初にdry-runを1回実行し、成功した場合だけ `--execute` を1回実行します。ローカルbase branchだけが同期できない場合はそのbranchをskipしてcleanupを続け、targetの `future` がdirty・non-fast-forwardなどでdry-runに失敗した場合は回避せず、その夜の処理をskipとして報告します。変更候補がないno-opは正常終了とし、失敗時だけ通知します。登録の正本は `~/.codex/automations/nazomatic-git-cleanup/automation.toml`、運用台帳は [`system-design/operations/x-browser-post-schedules.md`](./system-design/operations/x-browser-post-schedules.md) です。

## Shift Search レポート更新

Shift Search のレポートは、元成果物と Next.js 表示用 assets が分かれています。

1. `artifacts/shift-search/reports/{jp|en}` に Markdown レポートを配置する。全探索レポート本体は `node scripts/batch-shift-search-report.mjs` で生成できる（npm script 未登録）。
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

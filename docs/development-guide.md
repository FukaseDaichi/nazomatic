# NAZOMATIC 開発ガイド

## 位置づけ

この文書は、開発時に必要なセットアップ、コマンド、環境変数、生成手順、検証方針をまとめます。現行システム設計は `docs/system-design/README.md` を参照します。

## セットアップ

Node.js は 24.x を使います（`package.json` の `engines.node`）。Vercel のビルドと GitHub Actions もこの版に揃えています。

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
| `npm run test:security` | Editor APIの認証迂回・CSRFと依存PR自動マージ条件の回帰確認 |
| `npm run audit:production` | devを除いた依存監査（Moderate以上で失敗） |
| `npm run shift:report:meta` | Shift Search レポート元成果物から manifest / index を生成 |
| `npm run shift:report:view-assets` | Shift Search レポート表示用 JSON を `src/generated/shift-search` に生成 |

汎用テストフレームワークは未設定です。セキュリティ回帰確認には Node.js 標準 test runner を使います。Dependabot PRはメジャー更新を含め全チェック成功後に自動マージします。対象・成功条件・停止方法は[定期処理](system-design/operations/jobs-and-generated-assets.md#依存prの自動マージ)を参照してください。変更内容に応じて `npm run test:security`、`npm run lint`、`npm run build`、ブラウザでの手動確認を使い分けます。

## Tailwind CSSの設定

Tailwind CSS 4を`@tailwindcss/postcss`経由で使用します。設定の正本は`src/app/globals.css`です。`@import "tailwindcss" source("../")`で`src/`を探索し、`@theme`に既存の色・入場アニメーション、`@utility container`に共通幅を定義します。dark variantはOS設定ではなく`.dark`クラスで切り替わります。`tailwindcss-animate`は`@plugin`で読み込みます。旧`tailwind.config.ts`とautoprefixerの直接設定は使いません。

クラスを合成する`cn()`はv4対応の`tailwind-merge` 3を使います。新しいUIクラスはv4の構文で記述し、色・余白・行高は既存のデザインに揃えます。対応ブラウザの下限はSafari 16.4、Chrome 111、Firefox 128です。移行時の監査・画面検証は[検証記録](maintenance/tailwind4-verification-2026-10.md)を参照してください。

## Codex / Claude Code 共有 Agent Skill

### 正本と公開方法

リポジトリ固有スキルの唯一の編集元（正本）は `.agents/skills/<name>/` です。Codex はこのパスを直接探索し、`$<name>` または `/skills` で呼び出します。

Claude Code へは、`.claude/skills/<name>/SKILL.md` を**参照スタブ**としてコミットして公開します。スタブは次の条件を満たす通常ファイルです。

- frontmatter の `name` と `description` を正本と完全に一致させる。
- 本文には手順を書かず、正本 `.agents/skills/<name>/SKILL.md` を読ませる指示だけを書く。

Claude Code はディレクトリ名からコマンド名を決めるため、`.claude/skills/<name>/` に置けば `/<name>` で呼び出せます。スタブは `npm run skills:sync` が生成するので、手書きしません。

`CLAUDE.md` は `@AGENTS.md` を読み込み、`AGENTS.md` の「共有 Agent Skill」がこの節を参照します。したがって Codex と Claude Code のどちらでスキルを作成・インストール・更新しても同じ手順が適用されます。 リポジトリ内の指示の優先順位は、ユーザーの明示指示、`AGENTS.md`、スキルの運用指針の順です。文書同期スキルの編集対象制限は同期作業に適用し、学びの記録は learnings-loop プラグインが担います。

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

Claude Code では `.agents/skills/` 配下を Write / Edit すると、PostToolUse hook（`.claude/hooks/sync-agent-skills.sh`）が手順5の `npm run skills:sync` を自動実行します。Codex や手作業での編集には効かないため、手順5〜7は省略しません。

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

### 学びの記録（learnings-loop プラグイン）

リポジトリ直下の `LEARNINGS.md` への学びの記録は、user スコープで導入した Claude Code の learnings-loop プラグインが自動で行います。リポジトリ内に手動の記録スキルや Codex 向けの手順は置きません。

週1回、または `Consolidated Principles` を除く生の観察が80件程度に達したときは、`/learnings-loop:consolidate-learnings` で棚卸し・統合します。統合時に指示ファイルや別スキルへの転記が必要になった場合は、変更差分への承認を得てから適用します。

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
| `REALTIME_INTERNAL_API_TOKEN` | `/api/internal/realtime/*` の Bearer 認証 |
| `INTERNAL_API_SIGNING_SECRET` | 内部 API 署名の HMAC key。未設定時は `REALTIME_INTERNAL_API_TOKEN` を使う |
| `INTERNAL_API_ALLOW_UNSIGNED` | `true` のとき署名なし request を受理する緊急用の逃げ道。通常は設定しない |

GitHub Actions では `REALTIME_API_TOKEN` secret として同じ値を渡します。`INTERNAL_API_SIGNING_SECRET` を設定する場合は、アプリと Actions secret の両方へ同じ値を入れます。

内部 API は Bearer token に加えて HMAC 署名を要求します。詳細は `docs/system-design/architecture/data-and-security.md` を参照します。client 実装は `scripts/internal-api/signing.mjs`（Node）と `scripts/internal-api/post.sh`（GitHub Actions）にあります。

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

この手順はCodexローカルautomation `nazomatic-git-cleanup` にACTIVE登録し、毎日02:30 JSTに実行します。automationは最初にdry-runを1回実行し、成功した場合だけ `--execute` を1回実行します。ローカルbase branchだけが同期できない場合はそのbranchをskipしてcleanupを続け、targetの `future` がdirty・non-fast-forwardなどでdry-runに失敗した場合は回避せず、その夜の処理をskipとして報告します。変更候補がないno-opは正常終了とし、失敗時だけ通知します。登録の正本は `~/.codex/automations/nazomatic-git-cleanup/automation.toml`、実行契約は [`system-design/operations/jobs-and-generated-assets.md`](./system-design/operations/jobs-and-generated-assets.md) の Git cleanup 節です。

## Shift Search レポート更新

Shift Search のレポートは、元成果物と Next.js 表示用 assets が分かれています。

1. `artifacts/shift-search/reports/{jp|en}` に Markdown レポートを配置する。全探索レポート本体は `node scripts/batch-shift-search-report.mjs` で生成できる（npm script 未登録）。
2. 必要に応じて `artifacts/shift-search/reports/shift-search-external-links.json` を更新する。
3. `npm run shift:report:meta` を実行する。
4. `npm run shift:report:view-assets` を実行する。
5. `artifacts/shift-search/reports/*` と `src/generated/shift-search/*` の差分を確認する。

Claude Code では `artifacts/shift-search/reports/` 配下を Write / Edit すると、PostToolUse hook（`.claude/hooks/sync-shift-search-report.sh`）が手順3・4を自動実行します。スクリプトで生成したレポートや Codex での編集には効かないため、その場合は手順3・4を手で実行します。

詳細は `docs/system-design/subsystems/shift-search.md` を参照します。

## ドキュメント更新方針

- ドキュメントは日本語で書きます。
- `AGENTS.md` は日本語の短いエージェント向け実行ルールとして管理し、詳細な手順はこの文書と `docs/system-design/` に置きます。
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

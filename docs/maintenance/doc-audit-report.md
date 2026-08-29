# ドキュメント同期レポート（2026-08-28 第2回）

> 2026-08-29 追記: 下記監査で未着手・部分実装として残したリプライ観測と投稿時間帯実験は、その後実装済み。現行仕様は `docs/system-design/subsystems/x-posting.md` と `docs/system-design/operations/x-browser-post-schedules.md` へ統合し、`docs/ideas/x-growth-backlog.md` は削除した。以下は2026-08-28時点の監査記録として残す。

前回（同日・第1回）以降のコード変更は、週次観測ログ CLI と prepare API の追加、ゆる出題 CLI の追加、X 投稿の状態分離、X 運用再配分の反映、および `AGENTS.md` の日本語化が中心。運用文書（`x-posting.md`、`x-browser-post-schedules.md`、`jobs-and-generated-assets.md`）は追加機能に追従済みだったが、ルート表・開発ガイド側に取りこぼしが4件あった。`docs/README.md` と `docs/system-design/README.md` の索引は文書の増減がないため変更不要。

環境変数（`X_BROWSER_POST*` / `X_GROWTH*` 48件）はコードとドキュメントで完全一致、docs 内の相対 Markdown リンクとバッククォート付きパス参照も全件解決を確認した。

## 1. 自動修正したもの

- `docs/system-design/architecture/routes-and-apis.md:Realtime / X 内部 API`: `POST /api/internal/x/browser-post/observation-log/prepare` の行が欠落していた（実装は `src/app/api/internal/x/browser-post/observation-log/prepare/route.ts`）。→ 表へ追加。
- `docs/development-guide.md:ドキュメント更新方針`: 「`AGENTS.md` は例外的に**英語**の短いエージェント向け実行ルールとして管理します」→ `AGENTS.md` は d59089d で日本語化済みのため「日本語の短いエージェント向け実行ルールとして管理し、詳細な手順はこの文書と `docs/system-design/` に置きます」へ修正。
- `docs/development-guide.md:Codex / Claude Code 共有 Agent Skill`: 参照先の節名 `AGENTS.md` の "Shared Agent Skills" → 現行の「共有 Agent Skill」へ修正。
- `docs/development-guide.md:コマンド表`: `npm run test:x-browser-posting` の内訳に、新規追加された `casualPuzzle.test.mjs`（ゆる出題の語選定と denylist）と `observationLogImage.test.mjs`（観測ログ画像の検証）を追記。実ファイルは9件。
- `docs/system-design/subsystems/x-posting.md:ブラウザ投稿の共通構成`: 共通部品表に `growthTelemetry.mjs` を追加。5種類の投稿 CLI と `x-growth-maintain.mjs` の計6ファイルが import しており、`profileMetrics.mjs` / `followerSnapshots.mjs` を内部で使う共通部品であるにもかかわらず表に無かった。
- `docs/ideas/x-growth-backlog.md` の実装状況照合と蒸留（3節を個別に判定）:
  - 「投稿頻度を増やす実験は原則行わない」は方針として既にコードで強制済みのため、`docs/system-design/subsystems/x-growth-improve-agent.md:PR 作成の安全境界` へ折り込み、backlog から削除した。根拠は `scripts/x-growth/experimentAllowlist.mjs` の `DENY_PATH_PATTERNS`（`config.mjs` / `.env*` / `.github/` / `middleware.ts` / `package(-lock).json`）と `LEGACY_FORBIDDEN_TOKENS`（`max_daily` / `min_cooldown` / `--execute` / `confirmation_mode` / `auto_execute`）、および投稿時刻の正本がリポジトリ外の Codex automation にあること。
  - 「投稿時間帯の実験」は計測側のみ実装済み（`x-weekly-growth-review.mjs:402` の「時間帯別（JST）」表、`metricCandidates.mjs` の `jstHourBucket` filter）。枠の時刻をずらす操作は未実施のため backlog に残し、実装済み部分と未着手部分を区別する記述へ更新した。
  - 「リプライ観測」は未実装（会話ページ本文・相手 handle・reply URL の読み取りも、週次レビューの未返信候補出力も存在しない）。件数のみ `profileMetrics.mjs` が取得している旨を追記して backlog に残した。

## 2. 判断に迷った点

- `docs/ideas/x-growth-backlog.md` を丸ごと削除するか迷った。AGENTS.md のドキュメントライフサイクルは「実装完了と同じ PR で `ideas/` を削除」と定めるが、3節のうち完了しているのは方針1件のみで、リプライ観測は完全に未着手、時間帯実験は計測側だけの半分実装だった。完了分だけを system-design へ折り込み、残り2節は着手条件を明確化したうえで `ideas/` に残す判断をした。

- 観測ログ CLI の `--line` / `--run-date` フラグを開発ガイドへ書くか迷った。ドキュメントは `--no-image` だけを例示しているが、これは誤りではなく非網羅であり、他 CLI もフラグを全列挙していない（週末サマリの `--copy-pattern` / `--line` は例示済み）。列挙方針を変えると差分が依頼範囲を超えるため、今回は追記せず据え置いた。
- `docs/system-design/subsystems/x-growth-improve-agent.md:運用上の注意` の「`x:growth-review` と `x:growth-improve -- --execute` は週次で実行する」は修正しなかった。同文書の上部で `x:growth-improve` が 2026-08-28 から PAUSED であることを明記しているため矛盾ではないが、注意書きだけを読むと稼働中に見える。停止が恒久化する場合は書き換え候補。
- ゆる出題の投稿 URL（`scripts/x-browser-post-casual-puzzle.mjs` の `PUZZLE_TOOL_URL`）は `https://nazomatic.vercel.app` 直書きで、週末サマリ・トレンドネタが使う `src/app/config.ts` の `baseURL` 経由ではない。ドキュメントは「承認済み Shift Search URL」としか書いておらず誤りではないため文書は変更せず、コード側の非一貫として下記へ回した。

## 3. システム問題点

> 本レポート初版で挙げた2件（SKILL.md の英語前提の記述、ゆる出題 URL の直書き）は、同じ作業でオーナー指示により解消済み。経緯は末尾「本レポート後に実施した修正」を参照。

- **`docs/system-design/quality/known-concerns.md` の全項目は現状も有効**（コードで再確認済み）。
  - BLANK25 の `force: true` 更新は `src/server/blank25/github.ts:262` に現存。
  - `src/` 側のテストは0件、テストは `scripts/x-browser-posting/*.test.mjs` の9件のみ。
  - `src/generated/shift-search/view-manifest.json` の `delivery` は `{internal:17, external:4, unresolvedExternal:4}` で、external 4件（`jp-3`〜`jp-6`）は `externalUrl` / `internalDataFile` とも `null`。
  - `@react-spring/three`、`@use-gesture/react`、`shadcn-ui`（dependencies）、`@shadcn/ui`（devDependencies）は `src/` / `scripts/` から直接 import されず `package.json` に残存。
  - `scripts/x-browser-posting/browserSession.mjs:115,128` の日次キーは `toISOString().slice(0,10)` で UTC 日付のまま。
- **「成熟」を名乗る窓が依然2つある**（テレメトリ回収窓 `METRIC_MATURITY_MIN_MS=20時間`〜8日 / 提案ゲート `maturityHours=24`）。前回レポートでも指摘した誤記の温床で、コード側の定数名で区別を明示する余地が残る。
- **依存の脆弱性は現行メジャー内で解消不能な状態が継続**（picomatch 系 high は `tailwindcss` / `eslint-config-next` の孫依存、`@google-cloud/storage` 配下の moderate）。Next.js 14→15/16 移行とセットの話題で、コードから読み取れる設計上の弱点ではないため known-concerns への追記は今回も見送り。

## 4. AGENTS.md 推奨修正

- 指摘なし。コマンド表は `package.json` の scripts と、共有スキル表は `.agents/skills/`（6件）と一致し、参照先ドキュメントのパスもすべて実在する。日本語化後の分量も短く保たれている。

## 本レポート後に実施した修正（オーナー指示・スキルのスコープ外）

同期作業の後、オーナー指示で次の2件をコード・スキル正本側で修正した。いずれもこのスキルの編集スコープ外だったため、指示を受けてから実施している。

1. `.agents/skills/sync-docs-from-code/SKILL.md`: "Keep root `AGENTS.md` in English and unchanged" → "Leave root `AGENTS.md` unchanged" とし、Scope 側にも `AGENTS.md` が日本語である旨を明記。`npm run skills:sync` → `npm run skills:check` を実行し、スタブ6件の一致を確認した。
2. ゆる出題の投稿 URL を `baseURL` 経由へ変更。`scripts/x-browser-posting/config.mjs` に `publicBaseUrl` を追加し、`scripts/x-browser-post-casual-puzzle.mjs` の `PUZZLE_TOOL_URL` リテラルを `buildPuzzleToolUrl(config)` へ置き換えた。解決順は `--base-url` → `X_BROWSER_POST_API_BASE_URL` → `REALTIME_API_BASE_URL` → `NEXT_PUBLIC_BASE_URL` → production URL。
   - 当初は `src/app/config.ts` と同じく `NEXT_PUBLIC_BASE_URL` を最優先にしたが、ローカルの `.env.local` が `NEXT_PUBLIC_BASE_URL=http://localhost:3000`（dev サーバー用）を持つため、投稿 URL が localhost になる回帰を実測で検出し、解決順を API host 優先へ変更した。ほかの3種の URL は prepare API を持つ server が組み立てるため、API を持たないこの CLI は同じ host を公開 URL とみなすのが実装上の等価物になる。
   - 現行ローカル設定（`X_BROWSER_POST_API_BASE_URL=https://nazomatic.vercel.app`）で変更前と同一の URL になることを実行して確認済み。`npm run lint` と `npm run test:x-browser-posting`（74件）も通過。
   - 残る注意点: `X_BROWSER_POST_API_BASE_URL` を設定せず `.env.local` の localhost だけがある環境では、投稿 URL も localhost になる。ほかの3種も localhost の prepare API を使えば同じ結果になるため挙動としては一貫しているが、`--execute` を localhost 構成で使わない前提は変わらない。

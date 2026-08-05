# ドキュメント同期レポート（2026-08-05）

前回同期（2026-07-24）以降の実装コミットと docs 全体を突合した結果です。docs を同時更新していたコミット（SEO 整備、Core Web Vitals 改善、X 成長ループの structured proposal / 依存 bootstrap / metric candidate 化）は概ね docs と一致しており、修正は取り残しの微差が中心でした。

## 1. 自動修正したもの

- `docs/system-design/operations/jobs-and-generated-assets.md:検証境界`: 「自動 test framework は設定されていません」が残っていたため、`npm run test:x-browser-posting`（Node 標準 test runner）が存在し `src/` 側のみ test が無い、へ修正した（2026-07-25 の修正の取り残し）。
- `docs/system-design/subsystems/x-posting.md:投稿実行への計測相乗り`: 成熟窓の下限「約24時間」→「20時間」へ修正した（`scripts/x-browser-posting/growthTelemetry.mjs` の `METRIC_MATURITY_MIN_MS`。activation 判定の 24 時間しきい値とは別物）。
- `docs/system-design/operations/x-browser-post-schedules.md:成長計測メンテナンス`: 開始時のプロフィール明示 navigation、blocking state 検証、login account 一致検証（`scripts/x-growth-maintain.mjs` の `prepareGrowthMaintenancePage`）を追記し、照合日の記述を更新した。
- `docs/system-design/subsystems/x-growth-improve-agent.md:PR 作成の安全境界 / GitHub lifecycle`: 基底 verify が提案対象パスに関わらず `trend-joke-post.ts` 固定であること、評価予定週の算出式が PR 作成時 `windowDays + 1` 日後・activation 時 `windowDays` 日後で1日ずれることを明記した。
- `docs/system-design/architecture/overview.md` / `routes-and-apis.md`: `generateFeatureMetadata` の適用は「ツールページ 10 件」ではなく calendar（専用 metadata）を除く 9 件へ修正した。
- `docs/system-design/architecture/routes-and-apis.md:SEO`: 「page.tsx をサーバーコンポーネントに保つ」ルールの既存例外としてトップページ（`src/app/(main)/page.tsx` 自体が `"use client"`）を明記した。
- `docs/system-design/architecture/frontend-performance.md:ヘッダー`: `ArticleHeaderComponent` の直接利用は noindex の BLANK25 系ページも含むため「他の公開ページ」→「他のページ」へ修正した。
- `docs/system-design/architecture/data-and-security.md:認証境界`: middleware の Basic credential 比較が定数時間比較ではない事実を追記した（Bearer 側の `timingSafeEqual` と区別）。
- `docs/development-guide.md:コマンド・環境変数`: `test:x-browser-posting` の説明を実テスト6ファイル分（依存 bootstrap、成長メンテナンスを含む）へ拡張し、`command` provider へ prompt が環境変数 `X_BROWSER_POST_TREND_JOKE_COPY_PROMPT` でも渡される仕様を追記した。
- `docs/system-design/quality/known-concerns.md:優先度 高`: テストカバレッジの列挙を実ファイル6件に合わせて更新した。

## 2. 判断に迷った点

- コミット be58488（trend-joke の fallback / provider prompt を具体的な行動へ寄せた実験）は、docs が「一言型は改行なし」等の抽象度で規定しているため矛盾なしと判断し、文言レベルの変更は docs へ転記しなかった。
- 686d8cd で削除された 4 パッケージ（`@heroicons/react` ほか）への言及は docs に元々無く、修正不要だった。
- `~/.codex/automations/` の登録時刻・model はリポジトリ外のため今回照合していない。台帳の automation 登録情報は 2026-07-24 照合のまま、CLI 挙動の記述のみ 2026-08-05 に照合した。

## 3. システム問題点

- 評価予定週の算出式が PR 作成時（`scripts/x-growth-improve.mjs`: `windowDays + 1` 日後）と activation 時（`scripts/x-growth-maintain.mjs`: `windowDays` 日後）で異なり、activation のタイミング次第で評価週が1週前倒しになり得る。
- 基底 verify が `trend-joke-post.ts` 固定のため、`comment-patterns.json` など別ファイルを狙う提案でも同一のフルパイプラインが走る。動作上の問題はないが、対象ファイルの基底健全性は検証していない。
- middleware の Basic credential 比較が定数時間比較ではない（内部 API の Bearer 側は `timingSafeEqual` 済み）。

## 4. AGENTS.md 推奨修正

- 推奨修正なし。コマンド、正本データ、認証境界、X ローカル運用の参照先は現行実装・docs と一致している。

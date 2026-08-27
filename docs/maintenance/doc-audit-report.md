# ドキュメント同期レポート（2026-08-28）

前回（2026-08-17）以降のコード変更は、Agent Skill 共有の参照スタブ方式への移行、依存パッケージ更新（firebase-admin 14 系など）、X 成長実験の自動 keep 化が中心で、いずれも既存ドキュメントへ反映済みだった。今回の全数照合で確認できた不一致は軽微な2点（テレメトリ回収窓の時間表記、Shift Search 元レポート生成スクリプトの未記載）のみで、`docs/README.md` と `docs/system-design/README.md` の索引は変更不要だった。

## 1. 自動修正したもの

- `docs/development-guide.md:ローカルブラウザ投稿`: 投稿後テレメトリの回収窓「投稿から約24時間〜8日」→「投稿から20時間〜8日」。コードの正本は `scripts/x-browser-posting/growthTelemetry.mjs` の `METRIC_MATURITY_MIN_MS = 20 * 60 * 60 * 1000` で、`x-posting.md` と `x-browser-post-schedules.md` は既に20時間表記だった。
- `docs/development-guide.md:Shift Search レポート更新`: 手順1に、元 Markdown レポート本体を `node scripts/batch-shift-search-report.mjs` で生成できること（npm script 未登録）を追記。
- `docs/system-design/subsystems/shift-search.md:レポート配信`: 元 Markdown の行に生成元スクリプト `scripts/batch-shift-search-report.mjs` を追記。

## 2. 判断に迷った点

- `docs/system-design/subsystems/x-growth-improve-agent.md` の「24時間以上8日以内の投稿の metrics 成熟率」は修正しなかった。改善提案ゲートは `maturityHours=24`（`xGrowthProposalSchema` 系）が正本で、テレメトリ回収窓の20時間とは別の定数。表記は正しいが、同じ「成熟」という語で2つの窓が存在するため、今回のような誤記が再発しやすい（→ システム問題点3参照）。
- `scripts/batch-shift-search-report.mjs` を文書化するか迷った。npm script 未登録の単発生成ツールだが、`artifacts/shift-search/reports/{jp|en}` の Markdown がどこから来るかの説明が欠けていたため、参照1行だけを2文書へ追加し、CLI 引数（`--dictionary` / `--out-dir`）の詳細仕様までは書かないことにした。

## 3. システム問題点

- `docs/system-design/quality/known-concerns.md` の全項目は現状も有効。`view-manifest.json` の `unresolvedExternalCount` は4のまま、`@react-spring/three` / `@use-gesture/react` / `shadcn-ui`（dependencies）/ `@shadcn/ui`（devDependencies）も `package.json` に残存していることを確認した。
- 依存更新（2026-08-28、firebase-admin 13→14）後も、picomatch 系の high 脆弱性（tailwindcss / eslint-config-next の孫依存）と `@google-cloud/storage` 配下の moderate 脆弱性は現行メジャー内で解消不能。Next.js 14→15/16 移行と絡む話題であり、恒久化するなら known-concerns への追記候補（今回はコードから確認できる設計上の弱点ではなく依存供給側の問題のため見送り）。
- metrics の「成熟」に2定数がある（テレメトリ回収窓 20h〜8日、提案ゲート `maturityHours=24`）。ドキュメント誤記の温床になっており、実際に development-guide が24時間と誤記していた。コード側でどちらかに寄せるか、定数名で区別を明確にする余地がある。

## 4. AGENTS.md 推奨修正

- 指摘なし。コマンド一覧は `package.json` の scripts と、共有スキル表は `.agents/skills/`（6件）と一致しており、参照先ドキュメントのパスもすべて実在する。

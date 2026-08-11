# ドキュメント同期レポート（2026-08-12）

`x-growth-experiment` label 付き PR の GitHub Actions 自動マージ追加に合わせ、実装・workflow・docs を突合した。今回の対象外の実装仕様、ルート、環境変数、Shift Search 生成物に取り残しは見つからなかった。docs の相対リンクも確認し、リンク切れはなかった。

## 1. 自動修正したもの

- `docs/development-guide.md:GitHub Actions 運用`: `x-growth-pr-ci.yml` と `x-growth-auto-merge.yml` を追加し、read-only の CI、`verify` job の成功確認、最新 head SHA・`main` 宛て・`x-growth-experiment` label の再確認、ドラフトの ready 化と merge commit 方式の自動マージを記載した。
- `docs/system-design/architecture/overview.md:GitHub Actions / ローカル PC`: X 成長実験 PR の検証と CI 成功後の自動マージを実行境界へ反映した。
- `docs/system-design/operations/jobs-and-generated-assets.md:GitHub Actions`: 新しい2 workflow の起動条件と処理契約を追加し、内部 API を呼ぶ定期実行 workflow の説明と区別した。
- `docs/system-design/operations/x-browser-post-schedules.md:共通の実行契約 / 週次改善PR`: 週次改善 PR 作成後に `X Growth PR CI` と `X Growth Auto Merge` が実行される契約へ更新した。
- `docs/system-design/subsystems/x-growth-improve-agent.md:目的 / PR 作成の安全境界 / GitHub lifecycle`: これまでの「ドラフト PR 作成まで・自動マージなし」の記述を、CI 成功時だけ自動マージする現行フローへ更新した。自動マージ job が PR コードを checkout しないことも明記した。
- `docs/README.md`、`docs/system-design/README.md`: 新規ドキュメントファイルはなく、既存の索引・文書構成の修正は不要と判断した。

## 2. 判断に迷った点

- 既存の X 成長改善 CLI はドラフト PR を作成するため、workflow 側でドラフトを ready にしてからマージする設計にした。ユーザー要件の「CI が通ったら必ずマージ」を優先し、人手レビューを自動マージの条件には残していない。
- 既存の対象 PR が merge commit 方式でマージされていたため、`gh pr merge --merge` を採用した。squash 方式へ変更する理由はなく、既存の lifecycle と整合させた。
- CI は外部 Vercel status ではなく、リポジトリ内の `X Growth PR CI`（TypeScript、lint、X 投稿テスト、production build）の成功を自動マージ条件にした。Vercel の status を追加条件にするかは運用上の判断が必要なため、今回の仕様では範囲を広げていない。

## 3. システム問題点

- `main` は現在ブランチ保護されておらず、リポジトリの `allow_auto_merge` も無効である。今回の workflow は GitHub API の書き込み権限で直接マージするため動作するが、リポジトリ権限ポリシーや保護ルールが変わると `ready` 化・マージが失敗する可能性がある。
- `workflow_run` は対象 workflow が default branch に存在してから発火する。自動マージ workflow を含む変更自身は自動マージの対象にならず、最初の反映だけは手動マージが必要である。
- workflow と docs は現在の作業ツリーに追加された状態であり、`main` へ取り込まれるまでは GitHub 上の自動マージは有効にならない。

## 4. AGENTS.md 推奨修正

- 推奨修正なし。今回の workflow 契約は既存の「外部 API は Actions から内部 API 経由」「X 成長実験の正本は GitHub」というルールと整合している。`AGENTS.md` は変更していない。

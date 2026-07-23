# ドキュメント同期レポート（2026-07-24）

## 1. 自動修正したもの

- `docs/system-design/operations/x-browser-post-schedules.md:文書全体`: 「4件稼働・改善エージェント未登録」→「6件すべて ACTIVE」へ修正した。週次改善PR作成を月曜12:30、成長計測メンテナンスを毎日04:30として追加し、automation ID、RRULEの解釈、model / reasoning effort / 通知、秘密値を除く現行ローカル設定、実行契約、ログと状態の保存先を実登録どおり記載した。
- `docs/system-design/operations/jobs-and-generated-assets.md:ローカル X 自動化`: 「改善枠は月曜12:00想定で未登録」→「改善PR作成は月曜12:30、メンテナンスは毎日04:30にACTIVE登録済み」へ修正した。専用 local log を持たない週次レビューと、`runWithLocalLog` を使う5 CLIの境界も分離した。
- `docs/development-guide.md:コマンド・Automation一覧`: `package.json` に存在する `x:growth-maintain` がコマンド表に無かったため追加した。登録名を「週次改善PR作成」に合わせ、週次レビューがGitHub Issueを出力して専用 local logを作らないことを追記した。
- `docs/system-design/subsystems/x-growth-improve-agent.md:登録・GitHub lifecycle`: 登録済みの11:30 / 12:30 / 04:30枠、PR提案時の `proposalBaseline`、production activation、評価週の完全一致条件、`x-growth:needs-attention` からの手動復旧を実装どおり明記した。
- `docs/system-design/subsystems/x-posting.md:週次レビュー・ローカルファイル`: 「開始時 baseline」→「PR提案時 baseline」へ修正し、lock、改善PR作成log、メンテナンスlogを追加した。
- `docs/system-design/architecture/overview.md:ローカルPC`: 「ドラフトPRとローカル実験台帳」→「一時worktreeからドラフトPR、実験状態はGitHub正本」へ修正し、日次計測とactivationを追加した。
- `docs/system-design/architecture/data-and-security.md:正本・外部サービス・秘密情報`: X改善実験状態のGitHub正本、X成長ループがGitHub CLI / APIでIssue、PR、label、metadata、Production deploymentを扱う境界、認証済み`gh`を使う秘密情報の扱いを追加した。
- `docs/system-design/README.md` / `docs/README.md`: X運用スケジュール文書の説明を、投稿・週次レビューだけから改善PR・成長計測まで含む表現へ更新した。全体図にも週次改善と日次計測を追加した。
- `docs/ideas/x-growth-pr-automation-final-spec.md:位置づけ`: 「実装目標仕様」→「実装前仕様の記録」へ変更し、本文中の予定時刻や未実装表現を現行運用に使わないことと、現行正本へのリンクを明記した。
- `docs/system-design/quality/known-concerns.md:優先度 中`: 一時worktree・明示push実装後も残っていた旧PR作成懸念を削除し、baselineの時点差、評価週の取りこぼし、`needs-attention`後の自動再評価停止を現行コードに合わせて追加した。

## 2. 判断に迷った点

- `nazomatic-x` は3時間間隔のRRULEに`BYHOUR`と`TZID`が無い。特定の実行時刻列を推測せず、「3時間間隔（実行分は00分）」としてRRULEの事実だけを記載した。
- `.env.x-browser-posting.local` には運用上重要な安全switchがあるが、token、CDP URL、profile pathを文書へ転記すると秘密情報や端末依存情報を固定化する。今回はaccountと非秘密の有効値だけを運用台帳へ反映した。
- `docs/ideas/x-growth-pr-automation-final-spec.md` には月曜12:00など実装前の値が残る。履歴文書を現行仕様へ全面改稿せず、冒頭を実装前記録へ変更して現行設計・運用台帳へ誘導した。

## 3. システム問題点

- 週次レビューの同一週再実行は既存 Issue のコメントへ結果を追記する一方、`scripts/x-growth-improve.mjs` は Issue 本文だけを入力にする。改善提案が最新レビューを見ない可能性がある。
- PR作成時の`proposalBaseline`をproduction activation時にも流用しており、レビュー・マージ待ちの期間が長いと実験開始直前のbaselineにならない。
- 週次レビューは`plannedEvaluateWeek === currentWeek`の完全一致だけを評価するため、該当週のautomation失敗を翌週に回収できない。
- テレメトリ不足で`x-growth:needs-attention`を付けたPRはmaintenanceの対象外になる。後から計測が揃ってもlabelを人間が外すまでactivationを再試行しない。
- `scripts/x-weekly-growth-review.mjs` の生成配列に `## サマリ` が2回連続で入り、週次Issueに重複見出しが出る。

## 4. AGENTS.md 推奨修正

- 今回の同期範囲では推奨修正なし。コマンド、正本データ、認証境界、Xローカル運用の参照先は現行実装・docsと一致している。

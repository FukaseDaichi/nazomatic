# ドキュメント同期レポート（2026-07-19）

## 1. 自動修正したもの

- `docs/system-design/operations/x-browser-post-schedules.md`: 依頼者から稼働中と共有された X ブラウザ投稿 3 枠を、通常投稿 1 枠と週末サマリ 2 枠に分けて運用台帳化した。
- `docs/system-design/operations/x-browser-post-schedules.md:実行契約`: `package.json`、`scripts/x-browser-post-*.mjs`、`scripts/x-browser-posting/{config,runLog}.mjs` に合わせ、1 起動 1 実行、auto 投稿の二重 lock、CLI による log 保存・世代管理、停止条件、実行後の報告項目を記載した。
- `docs/system-design/README.md`、`docs/system-design/operations/jobs-and-generated-assets.md`、`docs/README.md`、`docs/development-guide.md`: 新しい運用台帳への導線を追加した。

## 2. 判断に迷った点

- 週末サマリの同一実行指示が 2 件共有された。異なる日時に発火する独立枠の可能性があるため統合せず、「週末サマリ A/B」の 2 枠として記録した。
- 外部スケジューラーの ID、曜日、時刻、timezone は repository 内に存在せず、依頼内容にも含まれていない。推測では補完せず、正確な cadence と有効・無効の最終状態は外部スケジューラーを正とした。
- 「稼働中」は 2026-07-19 時点の依頼者共有情報として記録した。直近実行の成否とは分け、成否は CLI の最新 log で確認する運用にした。

## 3. システム問題点

- 週末サマリ A/B は同じ automation ID と `logs/x-browser-post-weekend-summary/` を共有するため、repository 内の log だけでは生成元の登録枠を識別できない。

## 4. AGENTS.md 推奨修正

- 今回の同期範囲では推奨修正なし。

# ドキュメント同期レポート（2026-07-22）

## 1. 自動修正したもの

- `docs/superpowers/plans/2026-07-22-x-growth-loop-phase2-4.md:文書全体`: Phase 2〜4 の実装と恒久設計書が揃った実装計画を削除した。未着手だった追加案は現行仕様と混同しないよう `docs/ideas/x-growth-backlog.md` へ分離した。
- `docs/README.md:設計外の検討メモ`: 未着手バックログへの索引を追加し、「ideas / strategy / research は変更しない」という旧方針から、現行仕様と分離して管理する方針へ更新した。
- `docs/development-guide.md:コマンド・ローカルブラウザ投稿`: `x:growth-improve` が未記載だったため、dry-run / `--execute`、`gh` / `codex` の利用条件、branch・commit・ドラフト PR・実験台帳、ログ保存先を追記した。
- `docs/system-design/architecture/overview.md:ローカル PC`: ローカル実行境界を「ブラウザ投稿のみ」から、週次レビューと read-only Codex 提案 + Node.js 検証による改善エージェントまで含む記述へ更新した。
- `docs/system-design/operations/jobs-and-generated-assets.md:ローカル X 自動化`: `x:growth-improve` のコマンド、実行場所、ログ、実験台帳、automation 未登録状態を追加した。
- `docs/system-design/operations/x-browser-post-schedules.md:位置づけ・ログと確認先`: Codex automation 4件の ACTIVE 状態と時刻を再照合し、照合日を 2026-07-20 から 2026-07-22 へ更新した。未登録の週次改善エージェントについてログと実験台帳を追記した。
- `docs/system-design/subsystems/x-growth-improve-agent.md:安全設計・実験台帳・失敗時`: 検証失敗時の復元方法を「常に git checkout」から「保持した適用前内容を書き戻し、内容がない場合のみ git checkout」へ修正した。週次レビュー Issue のコメントを読まないこと、自動勝敗判定をしないこと、`resolveExperiment` 専用 CLI がないことも実装どおり明記した。
- `docs/system-design/quality/known-concerns.md:優先度 中・低`: 改善エージェントの PR 作成 / 復旧、Issue コメント未取得、実験解決 CLI 不在、Realtime prune dry-run の同一 batch 再読込を既知の懸念として追加した。

## 2. 判断に迷った点

- X 成長ループの Codex automation 枠は未登録だが、Phase 2〜4 のコードと恒久設計書は実装済みである。未登録状態は運用台帳に明記されているため、「実装計画は完了済み、automation 登録は現行運用の未完了項目」と分け、計画書は削除した。
- 削除対象の計画書末尾に、Phase 2〜4 とは独立した未着手案が3件あった。これらまで完了済みとして捨てず、実装計画の手順・完了履歴を除いた短いバックログへ移した。
- `docs/system-design/operations/x-browser-post-schedules.md` はリポジトリ外の Codex automation を正本とする。今回は `/Users/fukasedaichi/.codex/automations/*/automation.toml` と照合し、登録内容自体は変更していない。

## 3. システム問題点

- `scripts/x-growth/applyProposal.mjs` は branch 作成・commit 後に `gh pr create --draft` を呼ぶが、明示的な push と clean worktree 確認がない。環境次第で PR を作れず branch / commit だけが残ることや、対象ファイルの既存変更を実験 commit に含めることがある。
- 週次レビューの同一週再実行は既存 Issue のコメントへ結果を追記する一方、`scripts/x-growth-improve.mjs` は Issue 本文だけを入力にする。改善提案が最新レビューを見ない可能性がある。
- `resolveExperiment()` はモジュール API だけで、npm script / CLI がない。実験が `open` のまま蓄積しやすく、「検証 → kept / reverted 記録」の運用が完結していない。
- Realtime prune の dry-run は cursor を進めず削除もしないため、対象があると同じ batch を最大20回読み、`checked` / `batches` を過大計上する。
- モバイル 16px ルール違反の疑いは継続している。`graph-paper-component.tsx` の行・列 number input と BLANK25 Editor の link name / answers は `text-sm` のままである。

## 4. AGENTS.md 推奨修正

- 今回の同期範囲では推奨修正なし。コマンド、正本データ、認証境界、UI 必須ルール、Shift Search 生成物同期の要点は現行実装・docs と一致している。

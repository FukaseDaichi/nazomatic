# ドキュメント同期レポート（2026-08-17）

X 成長実験を production activation 後72時間の安全確認と自動 keep に変更し、週次レビューの「実験の勝敗」を廃止した実装に合わせて、関連する設計・運用ドキュメントを同期した。新規・削除したドキュメントはなく、`docs/README.md` と `docs/system-design/README.md` の索引変更は不要だった。

## 1. 自動修正したもの

- `docs/system-design/subsystems/x-growth-improve-agent.md:目的と正本 / 計測ゲート / GitHub lifecycle / 運用上の注意`: `activeAt` から72時間後の `autoKeepAt`、問題labelがない場合の自動 keep、手動 revert、既存active PRの移行、週次勝敗レポート廃止へ更新した。
- `docs/system-design/operations/x-browser-post-schedules.md:登録一覧 / 週次改善レビューと改善 PR / 成長計測メンテナンス`: 毎日04:30の maintenance が activation に加えて自動 keep を行うこと、日次実行のため実際のkeepが72〜96時間後になることを反映した。
- `docs/system-design/subsystems/x-posting.md:週次改善レビュー`: 個別実験の勝敗判定を削除し、週次集計は次回改善提案の入力として維持する現行動作へ修正した。
- `docs/development-guide.md:コマンド / ローカルブラウザ投稿`: `x:growth-maintain` の自動keep責務を追加し、14日を提案時baseline参照窓、72時間をproduction反映後の安全確認期間として区別した。
- `docs/system-design/architecture/overview.md:ローカル PC`: 成長計測メンテナンスの実行境界へ72時間後の自動keepを追加した。
- `docs/system-design/quality/known-concerns.md:X 成長実験`: 旧来の評価週取りこぼし懸念を削除し、自動keepが改善効果を判定せず、問題labelの入力に依存する懸念へ置き換えた。
- `docs/README.md`、`docs/system-design/README.md`: 文書の追加・削除・移動がないため変更不要と判断した。

## 2. 判断に迷った点

- 「レポートは不要」は、次回の改善PR生成に必要な週次レビュー全体ではなく、「実験の勝敗」節を不要とする指示として扱った。投稿集計、改善候補、GitHub review Issue は維持した。
- 3日は暦日境界ではなく、Production deployment の成功時刻から連続72時間として実装・記載した。maintenance は日次実行なので、label変更は72時間経過後の次回実行、通常72〜96時間後になる。
- 既存の `x-growth:active` PR は過去のactivation時刻をPR metadataに持たない。merge時刻を代用して確認期間を短縮せず、更新後の初回maintenanceから新たに72時間を確保する扱いにした。
- metric の `windowDays=14` は実験継続判断には使わなくなったが、提案時の投稿・baseline参照条件としてコードに残るため、ドキュメントでも「baseline参照窓」として維持した。

## 3. システム問題点

- 自動keepは表示数・反応・フォロワー増加などの改善効果を検証しない。「問題が報告されなかった」ことだけを根拠にするため、効果がない変更もkeepされる。
- 不具合や品質低下を見つけても `x-growth:revert` または `x-growth:needs-attention` が72時間以内に付かなければ自動keepされる。監視結果をGitHub labelへ反映する運用が必要である。
- activation前のテレメトリ不足で `x-growth:needs-attention` になったPRは、テレメトリが後から十分になっても自動再評価されず、人間がlabelを外すまで保留される現行仕様のままである。

## 4. AGENTS.md 推奨修正

- 推奨修正なし。今回の変更は既存のX成長実験運用の内部状態遷移であり、短い横断ルールである `AGENTS.md` に追加する必要はない。`AGENTS.md` は変更していない。

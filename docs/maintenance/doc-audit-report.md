# ドキュメント同期レポート（2026-07-20）

## 1. 自動修正したもの

- `docs/x-browser-posting/schedules.md`: Codex automation の実登録と照合し、誤っていた「週末サマリ A/B」を削除した。通常投稿（3時間ごと）、トレンド投稿（毎日09:30・15:30・21:30）、週末サマリ（毎日18:30）、週次改善レビュー（毎週月曜11:30）を現行台帳へ反映した。
- `docs/x-browser-posting/design.md`、`docs/x-browser-posting/trend-joke-post.md`: トレンド投稿の5型ローテーション、直近5件のモチーフ上限、hashtag・URLの新しい許可範囲、画像・ネイティブ投票、共通投稿台帳、週次 GitHub Issue の仕様を実装に合わせた。
- `docs/development-guide.md`、`.env.x-browser-posting.example`: 新しい CLI、環境変数、ローカルファイル、70世代のログ保持を反映した。
- `docs/README.md`: ローカル週次レビューと運用台帳への導線を追加した。

## 2. 判断に迷った点

- GitHub Actions ではログイン済み Chrome profile、Git 管理外の投稿台帳、ローカル log を参照できないため、週次レビューは Codex のローカル automation に置いた。
- 週次レビューが提案した内容をそのままコードへ自動反映すると複数要因の同時変更や品質低下を招くため、Issue は分析と改善候補までとし、採用判断後に変更する境界を残した。
- X の公開数値は DOM や公開 HTML の変更で取得できない場合がある。取得不能を0件として誤評価せず、Issue に明示する仕様とした。

## 3. システム問題点

- 共通投稿台帳は導入後の成功投稿から蓄積され、過去投稿は自動 backfill しない。初回の型別・投稿別レビューはデータが少ない。
- ネイティブ投票と画像添付、投稿 URL 検出、公開指標取得は X の UI selector に依存する。UI 変更時は安全側に停止するが、定期的な selector 確認が必要。
- 初回週次レビューには比較元の follower snapshot がないため、前週差は2回目以降に表示される。

## 4. AGENTS.md 推奨修正

- 今回の同期範囲では、`AGENTS.md` の推奨修正はなし。短い英語の実行ルールとして維持できており、詳細は docs 側に置かれている。

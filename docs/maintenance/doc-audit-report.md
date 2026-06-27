# ドキュメント同期レポート（2026-06-27）

## 1. 自動修正したもの

- `README.md:機能`: `src/lib/json/features.json` と公開ルートに合わせ、文字拾い検索を機能一覧へ追加した。
- `README.md:コマンド`: `package.json` の scripts に合わせ、`x:browser-post`、`x:browser-post:weekend-summary`、`x:browser-post:trend-joke` を追加した。
- `docs/README.md:設計書`: `docs/x-browser-posting/trend-joke-post.md` の説明を、設計案ではなく現行実装を含む文書として更新した。
- `docs/README.md:ディレクトリと生成物`: `docs/maintenance/doc-audit-report.md` をドキュメント同期レポートとして追加した。
- `docs/development-guide.md:X 再投稿`: ローカルブラウザ投稿を「案」から現行機能へ直し、`scripts/x-browser-posting/config.mjs` で読まれる `X_BROWSER_POST_HASHTAG`、`X_BROWSER_POST_API_BASE_URL`、`X_BROWSER_POST_INTERNAL_TOKEN`、`X_BROWSER_POST_BROWSER_CHANNEL`、`X_BROWSER_POST_CHROME_STARTUP_TIMEOUT_MS`、`X_BROWSER_POST_HEADLESS`、`X_BROWSER_POST_KEEP_OPEN`、`X_BROWSER_POST_RESERVED_BY` を環境変数表に追加した。
- `docs/development-guide.md:GitHub Actions 運用`: `.github/workflows/realtime-verify-post-visibility.yml` に合わせ、可視性検証 workflow の起動時刻を毎時 10 分・45 分に修正した。
- `docs/calendar-realtime/design.md:内部 API`: 実装済みの `POST /api/internal/x/browser-post/trend-joke/prepare` を内部 API 表へ追加した。
- `docs/calendar-realtime/design.md:可視性検証 API`: `src/app/api/internal/realtime/verify-post-visibility/route.ts` に合わせ、`batchSize`、`maxConcurrency`、`bootstrapScanLimit` の既定値・最大値を修正した。
- `docs/calendar-realtime/design.md:GitHub Actions 運用`: 可視性検証 workflow の payload を実際の `batchSize=10`、`maxConcurrency=5`、`bootstrapScanLimit=50` に合わせた。
- `docs/system-design.md:関連設計書`: トレンドネタ投稿を「初期設計」ではなく現行実装として記述した。
- `docs/character-pick-search/design.md:実装方針`: `src/lib/character-pick-search.ts` の `CHARACTER_PICK_RESULT_MAXCOUNT = 200` を反映し、結果上限を明示した。
- `docs/x-browser-posting/design.md`: 実装状況に合わせて「基本実装済み」とし、個別イベント引用投稿の直近投稿文類似度チェックが未実装であること、トレンドネタ投稿には別途ローカル履歴ガードがあることを明記した。
- `docs/x-browser-posting/design.md:外部設定`: `scripts/x-browser-posting/config.mjs` と同期し、ローカルブラウザ投稿の環境変数表を補完した。
- `docs/x-browser-posting/trend-joke-post.md`: 「配置案」「追加する環境変数案」「将来の CLI」などの古い表現を、現行 CLI と環境変数に合わせて更新した。
- `docs/x-browser-posting/trend-joke-post.md:運用フェーズ`: Phase 1 / Phase 2 を実装済みの状態に合わせ、prepare API と fallback 候補が存在する前提へ更新した。

## 2. 判断に迷った点

- `README.md:プルリクエストの作成` の `gh pr create --base main --head future --fill` は、コード上に対応する正本がないため変更しなかった。固定 branch 名 `future` が現行運用として正しいかは人間判断が必要。
- `docs/x-browser-posting/design.md` の安全要件 `S-4` は要件として残し、実装状況側で未実装と明記した。要件から落とすべきか、実装予定として維持するべきかは人間判断が必要。

## 3. システム問題点

- 個別イベント引用投稿の `scripts/x-browser-post-events.mjs` / `src/server/x-browser-posting/candidate.ts` には、`docs/x-browser-posting/design.md` の安全要件 `S-4` に相当する直近投稿文との類似度チェックが見当たらない。トレンドネタ投稿には `local/x-browser-posting/trend-joke-history.json` による履歴ガードがあるため、個別イベント引用投稿にも同等のガードを入れるか判断したい。

## 4. AGENTS.md 推奨修正

- 今回の同期範囲では、`AGENTS.md` の自動修正推奨はなし。短い英語の実行ルールとして維持できており、docs 側へ置くべき詳細も今回追加していない。

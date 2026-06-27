# ドキュメント同期レポート（2026-06-27）

## 1. 自動修正したもの

- `docs/system-design.md:技術スタック`: `package.json` と import 実態に合わせ、UI 補助ライブラリ、BLANK25 の画像 crop / confetti、`chrono-node`、ローカル Playwright / Chrome DevTools Protocol を追記した。
- `docs/system-design.md:features.json の扱い`: JSON-LD の `Article` が各ページの hard-coded index から `features.json` を参照する実装であることを明記し、順序変更時の確認点を追加した。
- `docs/system-design.md:生成物設計`: Shift Search レポートの `EXTERNAL_THRESHOLD=3000`、`internal` / `external` の分岐、外部 URL または raw GitHub Markdown ダウンロードへの導線を追記した。

## 2. 判断に迷った点

- `package.json` には `@heroicons/react`、`@radix-ui/react-icons`、`@react-spring/three`、`@use-gesture/react`、`html2canvas`、`react-share` など、今回の `src/` / `scripts/` grep では実使用を確認できなかった依存がある。全体設計の技術スタックには実使用が確認できたものだけ反映した。
- `README.md:プルリクエストの作成` の `gh pr create --base main --head future --fill` は、コード上に対応する正本がないため変更しなかった。固定 branch 名 `future` が現行運用として正しいかは人間判断が必要。

## 3. システム問題点

- `src/lib/json/features.json` では index 3 が `/prefectures`、index 4 が `/graphpaper` だが、`src/app/(main)/graphpaper/page.tsx:9` は `Article index={3}`、`src/app/(main)/prefectures/page.tsx:9` は `Article index={4}` になっている。都道府県検索と方眼紙の JSON-LD が入れ替わっている疑いがある。

## 4. AGENTS.md 推奨修正

- 今回の同期範囲では、`AGENTS.md` の推奨修正はなし。短い英語の実行ルールとして維持できており、詳細は docs 側に置かれている。

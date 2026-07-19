# ナゾマティック（NAZOMATIC）

謎解き・パズル支援ツールとイベント補助ツールをまとめた Next.js アプリです。

## ドキュメント

- ドキュメント索引: [`docs/README.md`](./docs/README.md)
- システム設計書: [`docs/system-design/README.md`](./docs/system-design/README.md)
- 開発ガイド: [`docs/development-guide.md`](./docs/development-guide.md)
- AI 実装ルール: [`docs/ai-coding-rules.md`](./docs/ai-coding-rules.md)
- 既知の懸念点: [`docs/system-design/quality/known-concerns.md`](./docs/system-design/quality/known-concerns.md)

設計書は `src/` と設定ファイルを正として、現行の実装だけを記述します。

## 主な機能

- しりとり、サイコロ、文字変換、辞書・星座・都道府県検索、方眼紙
- シフト検索、文字拾い検索、Shift Search レポート
- 謎チケカレンダー、Realtime 収集、X 投稿支援
- BLANK25 ゲーム、Editor、パーティ得点表示

## セットアップ

```bash
npm install
npm run dev
```

利用可能なコマンドと環境変数は [`docs/development-guide.md`](./docs/development-guide.md) を参照してください。

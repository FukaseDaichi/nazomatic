# ナゾマティック（NAZOMATIC）

謎解き・パズル支援ツールとイベント補助ツールをまとめた Next.js アプリです。

## ドキュメント

- ドキュメント入口: [`docs/README.md`](./docs/README.md)
- 全体設計: [`docs/system-design.md`](./docs/system-design.md)
- 開発ガイド: [`docs/development-guide.md`](./docs/development-guide.md)
- AI 実装ルール: [`docs/ai-coding-rules.md`](./docs/ai-coding-rules.md)

ドキュメントはソースコードを正として更新します。実装と矛盾した場合は、ソースコードを確認してドキュメント側を修正します。

## 機能

- しりとり最長連鎖探索
- サイコロ展開図 + 3D 表示
- アルファベット変換 / 都道府県検索 / 方眼紙
- 辞書検索（アナグラム / クロスワード / 正規表現）
- 謎チケカレンダー（Firestore 連携）
- 星座検索
- シフト検索 + 全探索レポート表示
- BLANK25（25パネル推理ゲーム）

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いて確認できます。

## コマンド

```bash
npm run dev                       # 開発サーバー
npm run build                     # production build
npm run start                     # production server
npm run lint                      # ESLint
npm run shift:report:meta         # Shift Search レポート manifest / index 生成
npm run shift:report:view-assets  # Shift Search 表示用 generated assets 生成
```

## 環境変数

環境変数の一覧と用途は [`docs/development-guide.md`](./docs/development-guide.md) を参照してください。

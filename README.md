# ナゾマティック（NAZOMATIC）

謎解きお助けツールをまとめた Next.js アプリです。

- 要件定義書: [`./.codex/specification.md`](./.codex/specification.md)

## 主な機能

- しりとり最長連鎖探索
- サイコロ展開図 + 3D表示
- アルファベット変換 / 都道府県検索 / 方眼紙
- 辞書検索（アナグラム / クロスワード / 正規表現）
- 謎チケカレンダー（Firestore連携）
- 星座検索
- シフト検索 + 全探索レポート表示
- BLANK25（25パネル推理ゲーム）

## ルーティング構成

- メイン機能: `src/app/(main)`
- BLANK25: `src/app/(blank25)`
- シークレット機能: `src/app/(secret)`
- API: `src/app/api`

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いて確認できます。

## 主なスクリプト

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run shift:report:meta
npm run shift:report:view-assets
```

## 環境変数

最低限、以下の用途で環境変数を利用します（詳細は要件定義書参照）。

- `NEXT_PUBLIC_BASE_URL`
- Firestore 接続情報（`FIREBASE_*`）
- 内部 API 認可（`REALTIME_INTERNAL_API_TOKEN`）
- X 再投稿連携（`X_*`）

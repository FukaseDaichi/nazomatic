# BLANK25 アセット規約（実装準拠 v1.0 / 2026-03-03）

## 1. 配置

- 問題画像: `public/img/blank25/`
- 問題定義 JSON: `public/data/blank25/problems.json`

## 2. 命名ルール

- `problems.json` の `imageFile` と実ファイル名を一致させる。
- 既存レガシー画像（`1.png` など）は互換のため維持する。
- Editor で新規追加する画像は `blank25-###.webp` を標準とする。
- 拡張子は `.png` / `.jpg` / `.webp` を許容する。

## 3. 画像仕様（推奨）

- 正方形（1:1）
- 例: 512x512 / 768x768 / 1024x1024
- Editor の切り出し出力は `1024x1024 webp`（標準）

## 4. 追加・更新手順

1. `/blank25/editor` で新規作成または既存編集を選択
2. 画像をトリミングし、`linkName` と `answers` を入力
3. 公開して GitHub 反映（`problems.json` + 画像）
4. `/blank25` で表示確認

## 5. `problems.json` 形式（例）

```json
{
  "version": 2,
  "categories": [
    {
      "id": "tutorial",
      "name": "チュートリアル",
      "description": "まずはここから",
      "color": "#10b981",
      "problems": [
        {
          "id": "blank25-001",
          "linkName": "第0問",
          "imageFile": "1.png",
          "answers": ["かき"]
        }
      ]
    }
  ]
}
```

## 6. 運用チェック

- `problem.id` が全カテゴリで重複していないこと。
- `imageFile` の実ファイルが存在すること。
- `answers` が 1 件以上あること。
- 画像参照漏れ / 未使用画像が発生していないこと。

## 7. 現状メモ（2026-03-03）

- `manifest.version`: 2
- カテゴリ数: 2
- 問題数: 23
- 画像参照数: 23（欠損 0）
- 画像命名は `1.png`〜`22.png` + `blank25-023.webp` の混在状態

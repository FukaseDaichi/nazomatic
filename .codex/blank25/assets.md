# BLANK25 アセット規約（v0.2 / 2026-02-09）

## 1. 配置

- 問題画像: `public/img/blank25/`
- 問題定義 JSON: `public/data/blank25/problems.json`

## 2. 命名

- 推奨: `1.jpg`〜`25.jpg`（または `.png/.webp`）
- 将来的に複数セットを扱う場合は `set-01/1.jpg` のようなサブディレクトリ化を検討する。

## 3. 画像仕様（推奨）

- 正方形（1:1）
- 例: 512×512 / 768×768 / 1024×1024
- 文字が多い場合は 2x 以上の解像度推奨（モーダル拡大時の可読性のため）

## 4. 追加手順

1. `public/img/blank25/` に画像を追加
2. `public/data/blank25/problems.json` に問題定義を追加（`imageFile`, `linkName`, `answers`）
3. `/blank25` を開いて反映を確認

## 5. `problems.json` 形式（例）

```json
{
  "version": 1,
  "problems": [
    {
      "id": "blank25-001",
      "linkName": "第1問",
      "imageFile": "1.jpg",
      "answers": ["たぬき", "タヌキ"]
    }
  ]
}
```

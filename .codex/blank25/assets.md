# BLANK25 アセット規約（実装準拠 v0.3 / 2026-02-27）

## 1. 配置

- 問題画像: `public/img/blank25/`
- 問題定義 JSON: `public/data/blank25/problems.json`

## 2. 命名

- 画像ファイル名は `problems.json` の `imageFile` と一致させる。
- 拡張子は `.png` / `.jpg` / `.webp` を許容する。
- 連番命名（例: `1.png`）でも、意味名命名（例: `tutorial-001.png`）でもよい。

## 3. 画像仕様（推奨）

- 正方形（1:1）
- 例: 512×512 / 768×768 / 1024×1024
- 文字が多い画像は高解像度を推奨する。

## 4. 追加手順

1. `public/img/blank25/` に画像を追加
2. `public/data/blank25/problems.json` のカテゴリを選び、`problems` に問題を追加（`id`, `linkName`, `imageFile`, `answers`）
3. `/blank25` を開いて反映を確認

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

## 6. 運用チェック項目

- `problem.id` が全カテゴリを通して重複していないこと。
- `imageFile` の実ファイルが `public/img/blank25/` に存在すること。
- `answers` は 1 件以上入っていること。

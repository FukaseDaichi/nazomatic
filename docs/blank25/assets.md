# BLANK25 アセット規約（実装準拠 v1.1 / 2026-03-04）

## 1. 配置

- 問題画像: `nazomatic-storage` リポジトリの `img/` 以下
- 問題定義 JSON: `nazomatic-storage` リポジトリの `problems.json`（ルート直下）

いずれも `BLANK25_EDITOR_GITHUB_BRANCH` ブランチで管理し、`raw.githubusercontent.com` 経由で配信する。

## 2. 命名ルール

- `problems.json` の `imageFile` と実ファイル名を一致させる。
- Editor で新規追加する画像は `blank25-###.webp` を標準とする。
- 拡張子は `.png` / `.jpg` / `.webp` を許容する。

## 3. 画像仕様（推奨）

- 正方形（1:1）
- 例: 512x512 / 768x768 / 1024x1024
- Editor の切り出し出力は `1024x1024 webp`（標準）

## 4. 追加・更新手順

1. `/blank25/editor` で新規作成または既存編集を選択
2. 画像をトリミングし、`linkName` と `answers` を入力
3. 公開して `nazomatic-storage` へ反映（`problems.json` + 画像を同一コミット）
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
          "imageFile": "blank25-001.webp",
          "answers": ["かき"]
        }
      ]
    }
  ]
}
```

## 6. 運用チェック

- `problem.id` が全カテゴリで重複していないこと。
- `imageFile` の実ファイルが `nazomatic-storage/img/` に存在すること。
- `answers` が 1 件以上あること。
- 画像参照漏れ / 未使用画像が発生していないこと（孤立ファイルの自動削除は未対応）。

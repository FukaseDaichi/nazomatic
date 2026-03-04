# nazomatic-storage

`nazomatic-storage` は、NAZOMATIC の BLANK25 で使うマニフェスト（`problems.json`）と問題画像（`img/*`）を配信する専用リポジトリです。  
`nazomatic` 本体の Editor publish API から更新されることを前提にしています。

## 目的

- `problems.json` と画像を同一コミットで反映し、参照不整合を防ぐ
- `nazomatic` 本体の再デプロイなしでコンテンツを反映する
- 追加インフラなし（GitHub のみ）で運用する

## リポジトリ構成

```text
.
├── problems.json
└── img/
    ├── blank25-001.webp
    ├── blank25-002.webp
    └── ...
```

## 配信 URL（GitHub raw）

- マニフェスト:
  `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main/problems.json?v={timestamp}`
- 画像:
  `https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main/img/{imageFile}`

`timestamp` は publish 完了時刻（Unix ms）を利用し、`problems.json` のキャッシュを回避します。  
画像はクエリを付けず、CDN キャッシュ（最大約 5 分）を許容します。

## `problems.json` 仕様（抜粋）

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

### ルール

- `problem.id` は全カテゴリで一意
- `imageFile` は `img/` 配下の実ファイルと一致
- `answers` は 1 件以上の文字列配列

## 更新フロー（nazomatic 側 publish API）

1. Editor が manifest の変更内容と画像を送信
2. API が Git Trees API で `blob -> tree -> commit` を作成
3. `main` の ref を更新（force push を許容する構成）
4. `publishedAt` を返却し、クライアントは `problems.json?v={publishedAt}` を再取得

> 競合解決は `last write wins` 前提です。複数人同時編集の運用には向きません。

## 初期セットアップ

1. `nazomatic-storage` を **public** リポジトリとして作成
2. `main` ブランチを作成
3. `problems.json` と `img/` を初期投入
4. Branch protection は無効化（force push を許可）
5. `nazomatic` 側に必要な環境変数を設定
   - `GITHUB_TOKEN`
   - `BLANK25_EDITOR_GITHUB_OWNER`
   - `BLANK25_STORAGE_GITHUB_REPO`（v0.5 設計）
   - `BLANK25_EDITOR_GITHUB_BRANCH`（既定: `main`）
   - `NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE`（任意）

## 運用ルール

- 手動編集は原則禁止（Editor publish API 経由を優先）
- 手動修正が必要な場合は `problems.json` と関連画像を同一コミットで更新
- 不要画像（孤立ファイル）は定期的に整理
- 秘密情報・未公開素材は置かない（public リポジトリ前提）

## 既知の制約

- `raw.githubusercontent.com` の画像は短時間キャッシュされる
- GitHub raw は大規模 CDN ではないため、高トラフィック時に制限がかかる可能性がある
- アクセス増加時は Cloud Storage + CDN への移行を検討する

# BLANK25 アップロード編集機能 仕様書（実装準拠 v1.1 / 2026-03-04）

## 1. 目的

`/blank25/editor` から、BLANK25 問題の新規作成・既存更新・削除を行う。

- 画像アップロード
- 1:1 トリミング
- 回答入力
- `nazomatic-storage` リポジトリへの `problems.json` / 画像反映

## 2. 前提

- 編集機能は管理者向け（Basic 認証必須）。
- `(blank25)` 領域の noindex は維持する。
- プレイ画面の参照元は `nazomatic-storage` の raw URL（`/api/blank25/manifest` 経由）。
- 既存 `problemId` と localStorage 互換は維持する。

## 3. デザインルール

```md
# ルール
- メインデザイン`bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント`purple-400`
```

## 4. 画面要件

### 4.1 ルート

- 管理画面: `/blank25/editor`

### 4.2 主要 UI

- 新規作成 / 既存編集モード切替
- 編集対象の問題選択（update 時）
- 問題削除（update 時）
- 入力項目
  - `categoryId`
  - `linkName`
  - `answers`（改行 or カンマ区切り）
  - `image`（create 必須 / update 任意）
- 画像プレビュー
- 公開結果（`problemId`, `imageFile`, `commitSha`）表示

## 5. トリミング仕様

- ライブラリ: `react-easy-crop`
- トリミング比率: `1:1` 固定
- ズーム: `1.0 - 3.0`
- 回転: 未対応（0 度固定）
- 5x5 ルーラーを重ねて表示
  - 20% 間隔グリッド
  - 番号（1-25）の ON/OFF 切替
- 出力
  - `1024x1024`
  - `image/webp`
  - ルーラーは焼き込まない

## 6. 入力・データ仕様

### 6.1 画像入力制約

- MIME: `image/png|image/jpeg|image/webp`
- サイズ上限: 5MB

### 6.2 回答制約

- 1 件以上必須
- 空文字（trim 後）は除外
- **trim 後の完全一致**で重複除外（ひらがな/カタカナ等の表記ゆれは重複とみなさない）
- 表記ゆれの正規化はゲーム実行時の判定で行う

### 6.3 ID / 画像命名

- 新規問題 ID: `blank25-###`（最大番号 + 1）
- create 時の画像名: `${problemId}.webp`
- update で画像更新時も `${problemId}.webp` を基本とする

## 7. API 仕様

### 7.1 `GET /api/internal/blank25/editor/manifest`

- 役割: `nazomatic-storage` の raw URL（タイムスタンプ付き）から `problems.json` を取得
- 応答（成功）
  - `ok: true`
  - `manifest`

### 7.2 `POST /api/internal/blank25/editor/publish`

- 役割: create/update/delete の反映
- 入力
  - `mode: create | update | delete`
  - `problemId`（update/delete 必須）
  - `categoryId`（create/update 必須）
  - `linkName`（create/update 必須）
  - `answers: string[]`（create/update 必須）
  - `image?: { base64, contentType }`（create 必須 / update 任意）
- 応答（成功）
  - `ok: true`
  - `mode`, `problemId`, `imageFile`, `commitSha`
  - `manifest`（更新後の完全なマニフェスト）

### 7.3 競合制御

- 競合検知なし（`force: true` で push = last write wins）。

## 8. サーバー反映フロー

1. Basic 認証済みリクエストを受信
2. `nazomatic-storage` の raw URL（タイムスタンプ付き）から最新 `problems.json` を取得
3. create/update/delete 入力を検証してマニフェストを更新
4. 画像（必要時）と `problems.json` を Git Trees API で同一コミットとして生成
5. ブランチを `force: true` で更新
6. 更新後の `manifest` オブジェクトをレスポンスに含めて返す

## 9. セキュリティ

- `middleware.ts` で以下を保護
  - `/blank25/editor/:path*`
  - `/api/internal/blank25/editor/:path*`
- 認証: Basic（`BLANK25_EDITOR_USER` / `BLANK25_EDITOR_PASSWORD`）
- 更新系 API は `Origin` が異なる場合 `403`
- GitHub 資格情報はサーバー環境変数で保持

## 10. 現状制約

- 古い画像ファイルの自動クリーンアップは未対応
- 一般導線（`features.json`）から editor へは遷移できない

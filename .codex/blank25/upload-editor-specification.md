# BLANK25 アップロード編集機能 仕様書（ドラフト v0.2 / 2026-03-02）

## 1. 目的

BLANK25 に、`画像アップロード + 回答入力` から問題を追加・更新できる編集機能を追加する。  
加えて、アップロード画像を管理画面でトリミングし、BLANK25 の 5x5（25マス）を意識したルーラーを重ねて作問できるようにする。

## 2. 前提・制約

- 維持コストは原則 0 円（新規の有料SaaS/DB/ストレージを導入しない）。
- 既存プレイ画面のデータ読込方式は変更しない（`fetch("/data/blank25/problems.json")` を継続）。
- 既存問題の `problemId` は不変（既存リンクと localStorage 互換維持）。
- 編集機能は管理者向けで、一般導線には出さない（`(blank25)` 領域の noindex 維持）。

## 3. 採用方針（推奨）

### 3.1 全体方針

- ストレージは引き続き **GitHub リポジトリ本体**を利用する（= 実データは Git 管理）。
- 編集UIは NAZOMATIC 内に実装し、公開処理は内部 API から GitHub API でコミットする。
- デプロイは既存の GitHub 連携（Vercel 自動デプロイ）に乗せる。

### 3.2 採用決定

- 画像トリミングUIは `react-easy-crop` を採用。
- 25分割ルーラーはライブラリ追加せず、CSS/SVGオーバーレイで独自実装。
- これにより、追加コスト0・依存最小・要件充足を両立する。

## 4. 対象スコープ

### 4.1 対象

- 問題の新規作成
  - 画像アップロード
  - トリミング（正方形固定）
  - 25分割ルーラー表示
  - 回答入力（複数）
  - カテゴリ選択
  - `linkName` 入力
- 既存問題の編集
  - `linkName` / `answers` / `category` の更新
  - 画像差し替え（差し替え時は再トリミング可）

### 4.2 対象外（初期リリース）

- 問題削除（事故防止のため初期は非対応）
- ユーザー単位認証（OAuth等）
- 高機能画像編集（フィルタ、手書き、レイヤー）

## 5. 画面要件

### 5.1 ルート

- 管理画面: `/blank25/editor`
- noindex 維持（`(blank25)` 配下）
- 一般ナビ（`features.json`）には追加しない

### 5.2 主要UI

- 問題一覧（カテゴリ別）
- `新規作成` ボタン
- `編集` ボタン（各問題）
- 入力フォーム
  - `categoryId`（既存カテゴリから選択）
  - `linkName`
  - `answers`（1件以上、改行またはタグ入力）
  - `image`（新規時必須、編集時任意）
- 画像プレビュー
- バリデーションエラー表示
- 公開結果（commit SHA / 反映先 problemId）表示

### 5.3 トリミングダイアログ要件

- 画像選択後にトリミングダイアログを開く。
- トリミング領域は `1:1` 固定（BLANK25 の正方形盤面前提）。
- 操作:
  - ドラッグで位置調整
  - スライダーでズーム調整（例: 1.0〜3.0）
  - 回転は初期リリースでは 0 度固定（将来拡張）
- 表示:
  - 25分割ルーラー（5x5）をトリミング枠に重ねて表示
  - 罫線は 20% 間隔
  - 番号（1〜25）を薄く表示可能（ON/OFFトグル）
- 確定時:
  - ルーラー自体は画像に焼き込まない
  - 切り出し結果のみを保存対象とする

## 6. データ仕様

### 6.1 既存マニフェスト互換（維持）

`public/data/blank25/problems.json` の構造は現行維持。

```json
{
  "version": 2,
  "categories": [
    {
      "id": "tutorial",
      "name": "チュートリアル",
      "description": "...",
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

### 6.2 ID/ファイル命名ルール

- 問題ID: `blank25-###`（3桁ゼロ埋め）を継続。
- 新規追加時は全問題の最大番号 +1 を採番。
- 新規画像ファイル名は `blank25-###.webp` を標準とする。
- 既存の連番画像（`1.png` など）はレガシー扱いで当面維持。

### 6.3 回答ルール

- `answers` は 1件以上必須。
- 空文字・空白のみは除外。
- 重複は `normalizeBlank25Answer` 適用後に除外。

## 7. 公開処理（内部API）

### 7.1 API

- `POST /api/internal/blank25/editor/publish`
- 認証（最低限）: HTTP Basic 認証（`BLANK25_EDITOR_USER` / `BLANK25_EDITOR_PASSWORD`）

### 7.2 入力（概略）

- `mode`: `create | update`
- `problemId`（update時必須）
- `categoryId`
- `linkName`
- `answers[]`
- `image`（新規必須 / 編集時任意）
- `baseManifestSha`（競合検知用、任意）

### 7.3 サーバー処理

1. トークン検証
2. GitHub API で最新 `problems.json` と SHA を取得
3. 入力バリデーション
4. マニフェスト更新（create/update）
5. 画像ファイル追加（必要時）
6. `problems.json` と画像を同一コミットで push
7. 結果（`problemId`, `commitSha`）を返却

### 7.4 競合制御

- `baseManifestSha` が最新と不一致なら `409 Conflict` を返す。
- UI は再読込して再実行を促す。

## 8. 画像処理方針（トリミング対応）

- トリミングUIは `react-easy-crop` を使用する。
- 入力制約:
  - MIME: `image/png|image/jpeg|image/webp`
  - 上限サイズ: 5MB
- 切り出し:
  - クライアント側 Canvas で実施
  - 出力サイズは正方形（例: 1024x1024）
  - 形式は `webp` を標準（必要時 `png` フォールバック）
- 25分割ルーラー:
  - エディタ表示専用オーバーレイ
  - 最終画像には非焼き込み

## 9. セキュリティ

- `/blank25/editor` と `/api/internal/blank25/editor/*` は middleware で Basic 認証必須。
- 認証情報は `BLANK25_EDITOR_USER` / `BLANK25_EDITOR_PASSWORD` を環境変数で管理。
- 更新系 API は `Origin` 不一致を `403` とし、最低限の CSRF 対策を行う。
- GitHub 反映用の `GITHUB_TOKEN` はサーバー環境変数で管理。
- 反映先リポジトリ情報は `BLANK25_EDITOR_GITHUB_OWNER` / `BLANK25_EDITOR_GITHUB_REPO` / `BLANK25_EDITOR_GITHUB_BRANCH` で指定する。
- `/blank25/editor` は noindex + 非公開導線。
- 監査は Git 履歴で担保（誰が何を追加したかをコミットで追跡）。

## 10. 現行データ移行計画

### 10.1 現状ベースライン（2026-03-02 時点）

- `manifest.version`: 2
- カテゴリ数: 2
- 問題数: 22
- 画像数: 22
- 欠損画像: 0
- 未参照画像: 0
- 重複ID: 0

### 10.2 移行方針

- **データ構造移行は行わない**（現行 `problems.json` をそのまま起点にする）。
- 既存22問は「編集対象として読み込むだけ」にし、IDやURLは変更しない。
- 新規作成分のみ新命名規則（`blank25-###.webp`）を適用する。
- 既存画像は再トリミングを強制しない（必要時のみ編集画面で差し替え）。

### 10.3 段階移行

1. `Phase 0`（準備）

- 既存 `problems.json` のバックアップコミット作成
- 整合性チェック script 追加（ID重複、画像存在、answers件数）

2. `Phase 1`（読み取り）

- `/blank25/editor` を read-only でリリース
- 現行22問を一覧表示し、トリミングUI表示のみ検証

3. `Phase 2`（新規作成解放）

- create の publish を解放
- 新規問題を 1件追加して本番反映を確認（トリミング + 25ルーラー含む）

4. `Phase 3`（編集解放）

- update を解放
- 既存問題の回答修正/画像差し替えを可能化

5. `Phase 4`（任意の整理）

- 旧画像命名（`1.png` など）を ID命名へ寄せるバッチを任意実施
- このフェーズは必須ではない（コスト最小化のため後回し可）

### 10.4 ロールバック

- 1公開=1コミットで運用し、問題時は該当コミットを revert する。
- 画像差し替え時は旧ファイルを即削除しない（1リリース遅延でクリーンアップ）。

## 11. 受け入れ条件

1. 管理画面から画像+回答入力で問題新規追加ができる。
2. トリミング時に 5x5（25分割）ルーラーが表示される。
3. 追加後、`/blank25` と `/blank25/[problemId]` で問題がプレイできる。
4. 既存22問のURL・プレイ動作が変わらない。
5. 追加インフラ費用なしで運用できる。
6. 競合更新時に破壊的上書きせず `409` で保護できる。

## 12. 実装タスク（推奨順）

1. `react-easy-crop` を導入し、`Blank25ImageCropper` コンポーネントを作成
2. 5x5ルーラーオーバーレイ（CSS/SVG）を実装
3. クライアント側Canvas切り出し（1024x1024 WebP化）を実装
4. `blank25` マニフェスト編集ユーティリティ（create/update/validate）を `src/server/blank25` に追加
5. GitHub API クライアント（`problems.json` + 画像の同一コミット反映）実装
6. `POST /api/internal/blank25/editor/publish` 実装
7. `/blank25/editor` UI 実装（フォーム/プレビュー/エラー表示）
8. 整合性チェック script 追加（CIまたはローカル実行）
9. 運用手順を `.codex/blank25/assets.md` に追記

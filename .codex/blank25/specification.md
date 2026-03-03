# BLANK25 要件定義（実装準拠 v1.0 / 2026-03-03）

## 1. 目的

NAZOMATIC 内で、1 枚画像に重なった 5x5（25 枚）の盤面を使う推理ゲーム BLANK25 を提供する。

## 2. スコープ

### 2.1 対象

- 問題一覧画面: `/blank25`
- ゲーム画面: `/blank25/[problemId]`
  - 通常モード
  - 作問モード（`?mode=sakumon`）
- 管理画面: `/blank25/editor`
- 問題データ: `public/data/blank25/problems.json`
- 問題画像: `public/img/blank25/*`

### 2.2 対象外

- 別端末同期
- ユーザー認証（プレイヤー向け）
- ランキング
- SNS 共有（Web Share API / クリップボード共有）

## 3. デザインルール

```md
# ルール
- メインデザイン`bg-gradient-to-b from-gray-900 to-gray-800 text-white`
- アクセント`purple-400`
```

## 4. ゲーム仕様

### 4.1 通常モード

- 盤面は固定 5x5（25 枚）で、パネル番号は 1〜25。
- 未開封パネルを押すと開封済みになり透明化。
- 開封済みパネルは再クリック不可。
- 正解時スコアは `25 - 開封数`。
- 正解後は未開封パネルを半透明表示して終了状態を明示。

### 4.2 作問モード（`?mode=sakumon`）

- 初期は `draft`（作問中）で、各マスを「隠す/表示」に切り替え可能。
- `ロック` 操作で `draft -> locked`。
- `locked` 以降で回答入力・判定が有効。
- 正解で `solved` に遷移し、スコアは `表示数` で確定。
- `ロック解除` で `draft` に戻せる。

## 5. 問題データ要件

### 5.1 マニフェスト構造

`problems.json` はカテゴリ階層を持つ。

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

### 5.2 バリデーション

- `version` は number。
- `categories` は配列。
- category は `id`, `name`, `description`, `color`, `problems` を必須とする。
- problem は `id`, `linkName`, `imageFile`, `answers` を必須とする。
- `answers` は string 配列。
- 問題 ID はマニフェスト全体で一意。

## 6. 画面要件

### 6.1 `/blank25`（問題一覧）

- カテゴリ単位で問題カードを表示。
- 問題名 / ID / カテゴリ名で絞り込み。
- `全問題をリセット` で `blank25:v` と `blank25:sakumon:v` の保存データを削除。

### 6.2 `/blank25/[problemId]`（ゲーム）

- タイトル、問題 ID、モード切替、`一覧へ` を表示。
- 通常モード時は `リセット` を表示。
- 回答入力は Enter 判定に対応。
- 正解時はクリアダイアログ + 紙吹雪を表示。

### 6.3 `/blank25/editor`（管理画面）

- Basic 認証で保護。
- 新規作成 / 既存編集の切替。
- 画像トリミング（1:1）と 5x5 ルーラー表示。
- 公開時は `problems.json` と画像を同一コミットで反映。

## 7. 判定・正規化

- 入力回答と `answers` を同一ロジックで正規化して比較する。
- 正規化内容:
  - Unicode 正規化 `NFKC`
  - カタカナ（半角含む）をひらがなへ統一
  - 空白除去
  - 英字小文字化

## 8. 状態管理・永続化

### 8.1 クライアント状態

- 通常モード: `openedPanels`, `openedHistory`, `judgeStatus`, `score` など
- 作問モード: `hiddenPanels`, `sakumonPhase`, `lockedAt`, `judgeStatus`, `score` など

### 8.2 localStorage

- 通常: `blank25:v1:<manifestVersion>:<problemId>`
- 作問: `blank25:sakumon:v1:<manifestVersion>:<problemId>`
- 破損データは復元せず初期状態で開始。

## 9. 非機能要件

- モバイル優先で 5x5 盤面を維持する。
- パネルは `button` 要素で実装する。
- `src/app/(blank25)/layout.tsx` で `robots.index=false` を設定する。

## 10. 受け入れ条件

1. `/blank25` でカテゴリ付き問題一覧が表示される。
2. `/blank25/[problemId]` で通常 / 作問モードの切替ができる。
3. 作問モードは `draft -> locked -> solved` の状態遷移で動作する。
4. 回答判定で正誤表示でき、正解時にスコアが確定する。
5. 正解時にクリアダイアログと紙吹雪が表示される。
6. リロード後に通常 / 作問の進行状態が復元される。
7. `/blank25/editor` から問題の作成・更新ができる。

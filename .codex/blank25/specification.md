# BLANK25 要件定義（実装準拠 v0.3 / 2026-02-27）

## 1. 目的

NAZOMATIC 内で、1枚画像に重なった 25 枚パネルを開きながら推理し、回答判定でスコアを競うゲーム BLANK25 を提供する。

## 2. スコープ

### 2.1 対象

- 問題一覧画面: `/blank25`
- ゲーム画面: `/blank25/[problemId]`
- 問題データ: `public/data/blank25/problems.json`
- 問題画像: `public/img/blank25/*`

### 2.2 対象外

- 作問モード（`sakumon-mode-requirements.md`）
- 別端末同期、ユーザー認証、ランキング
- SNS 共有（Web Share API / クリップボード共有）

## 3. ゲーム仕様（通常モード）

- 盤面は固定 5x5（25 枚）で、パネル番号は 1〜25。
- 未開封パネルを押すと、そのパネルは開封済みになり透明化する。
- 開封済みパネルは再クリック不可。
- 正解時スコアは `残りパネル数` で確定する。
- 正解後は盤面編集を止め、未開封パネルを半透明表示して終了状態を明示する。

## 4. 問題データ要件

### 4.1 マニフェスト構造（現行）

現行の `problems.json` はカテゴリ階層を持つ。単純な `problems[]` 直下構造ではない。

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

### 4.2 バリデーション要件

- `version` は number。
- `categories` は配列。
- category は `id`, `name`, `description`, `color`, `problems` を必須とする。
- problem は `id`, `linkName`, `imageFile`, `answers` を必須とする。
- `answers` は string 配列。
- 問題 ID はマニフェスト全体で一意であること（重複時はエラー）。

## 5. 画面要件

### 5.1 `/blank25`（問題一覧）

- マニフェスト取得中は「読み込み中」カードを表示する。
- 取得失敗時はエラーカードを表示する。
- カテゴリごとに見出し、説明、問題カードを表示する。
- 問題カード押下で `/blank25/[problemId]` へ遷移する。
- `全問題をリセット` ボタンで `localStorage` の `blank25:v` プレフィックスキーを全削除する。

### 5.2 `/blank25/[problemId]`（ゲーム）

- タイトル、問題 ID、`リセット`、`一覧へ` を表示する。
- 正方形画像の上に 5x5 パネルをオーバーレイ表示する。
- ステータスとして `残り n / 25` と `開封 n` を表示する。
- 回答入力欄と `判定` ボタンを表示し、Enter キー判定に対応する。
- 判定結果は `空入力` `不正解` `正解` を表示する。
- 正解時はクリアダイアログと紙吹雪演出を表示する。
- 開封履歴（開けた番号一覧）を表示する。

## 6. 判定・正規化要件（現行実装）

- 入力回答と `answers` を同一ロジックで正規化し比較する。
- 正規化内容:
  - Unicode 正規化 `NFKC`（全角/半角の差を吸収）
  - カタカナ（半角含む）をひらがなへ変換
  - 前後トリム + 英字小文字化（`toLowerCase`）
  - 半角/全角スペースを含む空白除去（語中空白も除去）
- 正規化対象外（現行）:
  - 同義語変換（例: `羽` と `はね` の同一視）
  - 記号バリエーションの独自辞書変換

## 7. 状態管理・永続化要件

### 7.1 クライアント状態

- `openedPanels: boolean[25]`
- `openedHistory: number[]`
- `answerInput: string`
- `judgeStatus: idle | empty | wrong | correct`
- `startedAt`, `solvedAt`, `score`, `isCorrect`
- `problem`, `manifestVersion`, `error`

### 7.2 localStorage

- 保存キー: `blank25:v1:<manifestVersion>:<problemId>`
- 保存値:
  - `version`
  - `openedPanels`
  - `openedHistory`
  - `startedAt`
  - `solvedAt`
  - `isCorrect`
  - `score`
- 保存データ破損時は復元せず初期状態で開始する。

## 8. 非機能要件

- モバイル表示を優先し、5x5 パネルを崩さない。
- パネルは `button` 要素で実装する。
- 問題取得失敗・ID 不正時にエラーを画面表示する。
- `src/app/(blank25)/layout.tsx` で `robots.index = false`（noindex）を設定する。

## 10. 受け入れ条件（現行）

- `/blank25` でカテゴリ付き問題一覧が表示され、問題選択で遷移できる。
- `/blank25/[problemId]` で画像 + 1〜25 の 5x5 パネルが表示される。
- パネル押下で該当マスが開封され、開封履歴に追加される。
- 回答判定で正誤表示でき、正解時にスコアが確定する。
- 正解時にクリアダイアログが表示される。
- `リセット` で当該問題の状態が初期化される。
- リロード後に問題進行状態が復元される。

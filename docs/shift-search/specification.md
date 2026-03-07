# NAZOMATIC シフト検索 仕様書（実装準拠 / 2026-03-07）

## 1. 概要

- 公開ルートは `/shift-search`。
- 入力単語を文字シフトし、辞書に存在する単語を検索する。
- `/anagram` とは独立した機能として提供する。
- 全探索済みレポートへの導線として `/shift-search/reports` を持つ。

## 2. 入力と辞書

- 初期辞書は `buta`。
- 辞書一覧は `SearchManager` の `DICTIONARIES` を利用する。
- シフト検索が扱う辞書タイプは `jp` / `en` のみ。
- 入力は `trim()` 後に空文字ならエラーとする。
- 辞書切替時は以下を実行する。
  - `SearchManager.create(dictionaryKey)` で辞書を再読み込みする
  - 既存の検索結果、エラー、上限到達フラグをクリアする

## 3. 正規化とシフト仕様

### 3.1 共通正規化

- 入力は `toLowerCase()`、`NFKC`、`normalizeKana` を適用する。
- 日本語小文字は通常文字へ正規化する。
  - `ぁ=>あ`, `ぃ=>い`, `ぅ=>う`, `ぇ=>え`, `ぉ=>お`
  - `ゃ=>や`, `ゅ=>ゆ`, `ょ=>よ`, `っ=>つ`, `ゎ=>わ`

### 3.2 英語

- 文字集合は `abcdefghijklmnopqrstuvwxyz`。
- シフト幅は `1..25`。
- `z + 1 => a` の巡回シフトとする。
- `a-z` 以外を含む入力はエラーとする。

### 3.3 日本語

- 対象文字集合は 46 文字のひらがな基本配列。
- シフト幅は `1..45`。
- 濁点・半濁点は保持したまま処理する。
  1. 入力文字を `ベース文字 + 修飾種別` に分解する
  2. ベース文字のみをシフトする
  3. シフト後に同じ修飾種別を再付与する
  4. 再付与不能な文字では修飾なし文字を採用する
- ひらがな以外を含む入力はエラーとする。

## 4. 検索仕様

- 各 `shift` ごとにシフト後文字列 `sourceWord` を生成する。
- `findExactWordAsync(sourceWord)` は常に実行する。
- `includeAnagram = true` の場合のみ `findAnagramsAsync(sourceWord)` を実行する。
- アナグラム結果のうち `sourceWord` と同一語は除外する。
- 結果項目は以下を持つ。
  - `resultWord`
  - `shift`
  - `matchType`（`exact` / `anagram`）
  - `sourceWord`
- 重複判定キーは `resultWord + shift + matchType`。
- 並び順は `shift` 昇順 → `matchType`（exact 優先）→ `resultWord` 昇順。

## 5. 上限仕様

- シフト検索専用上限を持ち、既存アナグラム検索の `ANAGRAM_RESULT_MAXCOUNT` とは分離する。
- 現行定数:
  - `SHIFT_EXACT_RESULT_MAXCOUNT = 1000`
  - `SHIFT_ANAGRAM_RESULT_MAXCOUNT = 3000`
  - `SHIFT_TOTAL_RESULT_MAXCOUNT = 5000`
- いずれかの上限に達した場合は `limitReached = true` を返す。
- UI は exact / anagram / total の各上限値をメッセージに表示する。

## 6. UI 仕様

### 6.1 検索条件カード

- 入力欄
- 辞書選択
- トグル: `アナグラム検索を含める`
- 検索ボタン
- Help tooltip
  - シフト検索の説明
  - アナグラム検索の説明
  - `/shift-search/reports` へのリンク

### 6.2 操作制約

- 検索ボタンは以下条件で無効化する。
  - 辞書未ロード
  - 検索実行中
  - 入力が空
- Enter キーで検索を実行できる。

### 6.3 結果カード

- 見出しに `検索結果` と件数を表示する。
- 正規化済み入力を表示する。
- `limitReached` 時は上限到達メッセージを表示する。
- 状態表示:
  - 検索中: `検索中...`
  - エラー: エラーメッセージ
  - 0 件: `結果がありません。`
- 各結果行は以下を表示する。
  - `resultWord`
  - `shift +N`
  - 一致種別バッジ（`完全一致` / `アナグラム`）
  - `生成語: {sourceWord}`

## 7. 実装境界

- ページ: `src/app/(main)/shift-search/page.tsx`
- UI: `src/components/shift-search/shift-search.tsx`
- 検索ロジック: `src/lib/shift-search.ts`
- 辞書管理: `src/class/SearchManager.ts`
- レポート表示仕様: `docs/shift-search/shift-search-results-view-specification.md`

## 8. 受け入れ条件

1. `/shift-search` が独立ページとして動作する。
2. 日本語辞書では `1..45`、英語辞書では `1..25` を探索する。
3. 検索結果に shift 値・一致種別・生成語が表示される。
4. アナグラムトグル OFF では exact のみ、ON では anagram も追加表示される。
5. 上限到達時に部分表示であることが UI 上で分かる。
6. 日本語小文字、濁点、半濁点を含む入力が仕様どおり正規化・再付与される。

# shift-search レポート生成仕様書（実装準拠 / 2026-03-07）

## 1. 概要

- Shift Search の全探索結果を Markdown レポートとして出力する。
- 生成物は `artifacts/shift-search/reports` に置く。
- 生成後に manifest / index と Next.js 用 view assets を更新する。

## 2. 対象範囲

- 日本語（`buta.dic`）: 3 / 4 / 5 / 6 / 7 / 8 文字
- 英語（`CEFR-J.dic`）: 3 文字以上

## 3. 出力仕様

### 3.1 出力先

- 日本語: `artifacts/shift-search/reports/jp/shift-search-jp-len-{N}.md`
- 英語: `artifacts/shift-search/reports/en/shift-search-en-len-{N}.md`
- index: `artifacts/shift-search/reports/shift-search-report-index.md`
- manifest: `artifacts/shift-search/reports/shift-search-report-manifest.json`

### 3.2 Markdown 形式

- ヘッダ:
  - `dictionary`
  - `length`
  - `targetWordCount`
  - `executedWordCount`
  - `totalHitRows`
  - `startedAt`
  - `generatedAt`
- テーブル列:
  - `inputWord`
  - `shift`
  - `shiftedWord`
  - `matchType`
  - 必要に応じて `matchedWords`

### 3.3 出力ルール

- `shift = 0` は通常アナグラムを表す
- 無ヒット shift は出力しない
- `inputWord = shiftedWord` は出力しない
- 完全一致とアナグラムが両立する場合は別行にする
- skip 理由や skip 単語一覧は出力しない

## 4. 生成スクリプト

- 本体:
  - `scripts/batch-shift-search-report.mjs`
- メタ生成:
  - `scripts/build-shift-search-report-meta.mjs`
- view assets 生成:
  - `scripts/build-shift-search-view-assets.mjs`

### 4.1 引数

- `--dictionary buta|cefr`
- `--length N`
- `--out-dir <path>`
- `--out <path>`
- `--limit <N>`

## 5. 運用手順

1. 対象長ごとに Markdown レポートを生成する
2. `npm run shift:report:meta` を実行する
3. `npm run shift:report:view-assets` を実行する
4. 必要なら `shift-search-external-links.json` を更新する

## 6. 関連仕様

- 一覧 / 詳細表示: `docs/shift-search/shift-search-results-view-specification.md`
- 本体検索仕様: `docs/shift-search/specification.md`

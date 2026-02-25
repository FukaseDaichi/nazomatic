# shift-search 拡張計画（軽量版）

## 前提
- ここでは実行手順と出力仕様を定義する。
- 出力MDはそのまま画面表示で使う前提。
- `shift-search` の結果一覧に近い形で表示する。

## 対象範囲
- 日本語（`buta.dic`）: 3 / 4 / 5 / 6 / 7 / 8 文字
- 英語（`CEFR-J.dic`）: 3文字以上

## 出力ファイル方針
- 1条件1ファイルで分離:
  - 日本語: `codex/reports/jp/shift-search-jp-len-{N}.md`
  - 英語: `codex/reports/en/shift-search-en-len-{N}.md`
- 付帯:
  - 目次: `codex/reports/shift-search-report-index.md`
  - メタ: `codex/reports/shift-search-report-manifest.json`

## MDフォーマット（軽量）
- ヘッダ:
  - 辞書名
  - 長さ条件
  - 対象語数
  - 実行語数
  - 総ヒット行数
  - 実行日時
- メイン結果テーブル（ヒット行ベース）:
  - `inputWord`（元単語）
  - `shift`（+N）
  - `shiftedWord`（変換後単語）
  - `matchType`（`完全一致` または `アナグラム`）

例:
```md
| inputWord | shift | shiftedWord | matchType |
|---|---:|---|---|
| ことば | 0 | ばこと | アナグラム |
| ことば | 7 | さとび | 完全一致 |
| ことば | 7 | さとび | アナグラム |
| ことば | 22 | のひる | アナグラム |
```

- 補足:
  - `shift = 0` では「シフトなし」の通常アナグラムを判定し、入力語と異なるアナグラム語がある場合のみ出力する。
  - 行はヒットしたときだけ出力する（無ヒットshiftは出さない）。
  - 同一ワード変換（`inputWord = shiftedWord`）は出力しない。
  - 同じ `inputWord` / `shift` / `shiftedWord` で完全一致とアナグラムが両方ある場合は、`matchType` ごとに2行出力する。
  - これで表示は軽く保ちつつ、「どの単語が何シフトで何になるか」は追える。

## 除外する情報
- skip理由は出力しない。
- skipした単語一覧は出力しない。
- 個別アナグラム単語の全列挙（`resultWord`の大量行）はMDに出さない。

## 実装方針（スクリプト）
- 新規:
  - `scripts/batch-shift-search-report.mjs`
  - `scripts/build-shift-search-report-meta.mjs`
- 引数:
  - `--dictionary buta|cefr`
  - `--length N`
  - `--out-dir <path>`
  - `--out <path>`
  - `--limit <N>`（試験実行）
- 処理は既存`shift-search`互換ロジック。
- 出力はストリームで逐次書き込み。
- 各単語について `shift 0` と通常シフト（JP: `+1..+45`, EN: `+1..+25`）を評価し、ヒットしたshiftのみを1行ずつ出力する。
- すべてのMD生成後に `scripts/build-shift-search-report-meta.mjs` を実行し、index / manifest を再生成する。

## 実行順（本実行時）
1. `--limit 20` で試験実行（JP5 / EN5）。
2. UI (`/shift-search`) と代表語を突合。
3. 日本語6ファイル（3,4,5,6,7,8）を生成。
4. 英語3文字以上を長さ別で生成。
5. index / manifest を生成。

## 調査ページ化
- ページはMDをそのまま読む（またはmanifest経由で表示対象を切替）。
- UIは最小構成:
  - 辞書切替
  - 長さ切替
  - 単語検索
  - 結果テーブル

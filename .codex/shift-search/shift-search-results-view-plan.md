# shift-search 結果ビュー 実装方針

## 目的

- 既存の `/shift-search` から、事前生成したレポートMDを閲覧できる導線を追加する。
- 「結果一覧画面」に遷移し、そこから `日本語5文字` や `英語10文字` などを選択して詳細表示できるようにする。

## 画面フロー

1. `/shift-search`
2. `/shift-search/reports`（結果一覧）
3. `/shift-search/reports/[lang]/[length]`（選択したレポートの詳細）

## ルーティング設計

- 追加ページ:
  - `src/app/(main)/shift-search/reports/page.tsx`
  - `src/app/(main)/shift-search/reports/[lang]/[length]/page.tsx`
- 既存ページ修正:
  - `src/components/shift-search/shift-search.tsx`
    - 「結果一覧を見る」ボタン（`/shift-search/reports` へのリンク）を追加

## データソース

- 既存生成物を利用:
  - `.codex/shift-search/reports/shift-search-report-manifest.json`
  - `.codex/shift-search/reports/jp/shift-search-jp-len-*.md`
  - `.codex/shift-search/reports/en/shift-search-en-len-*.md`

## 一覧ページ仕様（`/shift-search/reports`）

- 目的:
  - 閲覧可能なレポートを俯瞰して選べるようにする。
- 表示内容:
  - 全体サマリー（JP/ENのreport数、hitRows合計）
  - レポート一覧テーブル
    - `lang`
    - `length`
    - `targetWordCount`
    - `totalHitRows`
    - `generatedAt`
    - 「開く」リンク
- 遷移先:
  - 例: `/shift-search/reports/jp/5`, `/shift-search/reports/en/10`

## 詳細ページ仕様（`/shift-search/reports/[lang]/[length]`）

- 目的:
  - 選択したMD内容を見やすく表示する。
- 表示内容:
  - ヘッダ情報（dictionary / length / executedWordCount / totalHitRows / generatedAt）
  - 結果テーブル（`inputWord / shift / shiftedWord / matchType`）
- UI:
  - 一覧ページへ戻るリンク
  - 1ページあたり件数を絞るページング（例: 200行）
  - `page` クエリで切り替え（`?page=1`）

## MDパース方針

- 追加ユーティリティ（server-only）:
  - `src/lib/shift-report.ts`（案）
- 処理:
  1. manifestを読み込み、`lang + length` で該当MDパスを解決
  2. MD先頭の `- key: value` をヘッダとして抽出
  3. テーブル行（`| ... |`）を配列へ変換
- 依存追加は行わず、シンプルな独自パースで対応する。

## パフォーマンス方針

- 大きいMD（特にJP5）でも表示負荷を抑えるため:
  - DOMへ一度に全行を出さない（ページング）
  - サーバー側で該当ページ分のみ描画
- 初期実装では検索フィルタは入れず、まず安定表示を優先する。

## 実装ステップ

1. `shift-search` 画面に「結果一覧を見る」導線を追加
2. manifest読み込みユーティリティを作成
3. `/shift-search/reports` 一覧ページを作成
4. MD読み込み + パースユーティリティを作成
5. `/shift-search/reports/[lang]/[length]` 詳細ページを作成
6. ページング（`page`クエリ）を追加

## 受け入れ条件

- `/shift-search` から結果一覧へ遷移できる。
- 一覧から任意の `lang/length` を選んで詳細へ遷移できる。
- 詳細ページでMD由来の結果テーブルが表示される。
- JP5のような大きいレポートでもページが固まらず表示できる（ページング有効）。

## 補足

- 現時点では `.codex/shift-search/reports` を直接参照する前提。
- 将来、公開環境向けに `public` 配下へ同期する構成に切り替える余地は残す。

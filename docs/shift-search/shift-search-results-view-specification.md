# shift-search 結果ビュー仕様書（実装準拠 / 2026-03-07）

## 1. 概要

- `/shift-search/reports` に一覧ページを持つ。
- `/shift-search/reports/[lang]/[length]` に詳細ページを持つ。
- 大きいレポートは表レンダリングせず、ダウンロード導線へ切り替える。

## 2. しきい値

- しきい値: `EXTERNAL_THRESHOLD = 3000`
- 判定基準: `totalHitRows >= 3000`

分類:

- `internal`
  - `src/generated/shift-search/internal/{lang}-{length}.json` を読み込み、ページ内に全件表示する。
- `external`
  - `externalUrl` が設定されていれば一覧から外部リンクへ遷移する。
  - `externalUrl` が未設定なら詳細ページを生成し、raw Markdown のダウンロードボタンを表示する。

## 3. データ構成

### 3.1 元成果物

- `artifacts/shift-search/reports/shift-search-report-manifest.json`
- `artifacts/shift-search/reports/shift-search-report-index.md`
- `artifacts/shift-search/reports/{jp|en}/shift-search-*-len-*.md`
- `artifacts/shift-search/reports/shift-search-external-links.json`

### 3.2 Next.js 用生成物

- `src/generated/shift-search/view-manifest.json`
- `src/generated/shift-search/internal/{lang}-{length}.json`

`view-manifest.json` には以下を持つ。

- `externalRowThreshold`
- `reportCount`
- `delivery.internalCount`
- `delivery.externalCount`
- `delivery.unresolvedExternalCount`
- `reports[]`

## 4. 画面仕様

### 4.1 `/shift-search/reports`

- 一覧ヘッダにしきい値説明を表示する。
- PC はテーブル、モバイルはカード UI を出し分ける。
- 表示項目:
  - 言語
  - 文字数
  - 辞書
  - 対象語数
  - ヒット件数
  - 生成日時
  - 表示先（内部 / 外部）
- `totalHitRows === 0` のレポートはリンクを無効化する。

### 4.2 `/shift-search/reports/[lang]/[length]`

- `generateStaticParams` は manifest 上の全レポートを対象にする。
- `dynamicParams = false`
- `internal` の場合:
  - 生成済み JSON を読み込み、行テーブルを全件表示する。
- `external` の場合:
  - ページ内に案内文とダウンロードリンクを表示する。
  - ダウンロード先は GitHub raw の `artifacts/shift-search/reports/...` を指す。

## 5. 実装ファイル

- 一覧ページ: `src/app/(main)/shift-search/reports/page.tsx`
- 詳細ページ: `src/app/(main)/shift-search/reports/[lang]/[length]/page.tsx`
- 一覧 UI: `src/components/shift-search/shift-search-report-list.tsx`
- データ読み込み: `src/lib/shift-search-report-view.ts`
- 生成スクリプト:
  - `scripts/build-shift-search-report-meta.mjs`
  - `scripts/build-shift-search-view-assets.mjs`

## 6. 更新フロー

1. `artifacts/shift-search/reports/{jp|en}` に Markdown レポートを生成する。
2. `npm run shift:report:meta` を実行して manifest / index を更新する。
3. `npm run shift:report:view-assets` を実行して `src/generated/shift-search/*` を更新する。
4. `externalUrl` を使う場合は `shift-search-external-links.json` を更新する。

## 7. 現状の制約

- `externalUrl` 未設定の external レポートは、一覧から外部直遷移せず詳細ページ経由になる。
- raw Markdown は GitHub raw を直接参照する。

# shift-search 結果ビュー 実装方針（改訂）

## 結論（採用案）

- `totalHitRows > 10000` のレポートは Next.js から完全分離し、外部静的ホストに配置して外部リンクで開く。
- `totalHitRows <= 10000` のレポートは Next.js 内で SSG 生成した詳細ページを提供する。
- 詳細ページはページングなしで全件表示する。
- 生成は「一度作って公開する」前提で、内部用データと外部用データをビルド時に分割する。

## 改訂理由

- 現行案は詳細ページでページング前提だが、要件は「ページング不要」。
- 巨大レポートを Next.js 無料枠に載せるとビルド成果物と配信負荷が重い。
- 本件は更新頻度が低いため、SSG + 外部分離の静的運用が最もシンプル。

## しきい値と分類

- しきい値: `EXTERNAL_ROW_THRESHOLD = 10000`（判定は `totalHitRows`）
- 2026-02-26 生成manifest時点の分類:
  - 外部: `jp/3 (222762)`, `jp/4 (140159)`, `jp/5 (17266)`
  - 内部: `jp/6 (5054)`, `jp/7 (2124)`, `jp/8 (975)`, EN全件

## 画面フロー

1. `/shift-search`
2. `/shift-search/reports`（一覧）
3. 内部対象: `/shift-search/reports/[lang]/[length]`（SSG詳細）
4. 外部対象: 外部URLへ遷移（新規タブ）

## ルーティング設計

- 追加:
  - `src/app/(main)/shift-search/reports/page.tsx`（静的一覧）
  - `src/app/(main)/shift-search/reports/[lang]/[length]/page.tsx`（内部対象のみSSG）
- 既存修正:
  - `src/components/shift-search/shift-search.tsx`
    - 「結果一覧を見る」導線を追加
- 詳細ページ:
  - `generateStaticParams` で内部対象のみ生成
  - `dynamicParams = false`
  - ページングは実装しない（全行表示）

## データ構成

- 既存ソース:
  - `.codex/shift-search/reports/shift-search-report-manifest.json`
  - `.codex/shift-search/reports/{jp|en}/shift-search-*-len-*.md`
- 追加生成物（Next.jsが読む公開用）:
  - `src/generated/shift-search/view-manifest.json`
  - `src/generated/shift-search/internal/{lang}-{length}.json`（内部対象のみ）
- 外部リンク定義:
  - `.codex/shift-search/reports/shift-search-external-links.json`
  - 例: `{ "jp-3": "https://.../shift-search-jp-len-3.html" }`

## 生成・公開フロー（1回実行前提）

1. 既存スクリプトでMDを生成
2. メタ生成時に `EXTERNAL_ROW_THRESHOLD` で `internal/external` を分類
3. 内部対象だけJSON化して `src/generated/shift-search/internal` に出力
4. 外部対象はHTML/MDを外部ホストへアップロードし、URLを `shift-search-external-links.json` に反映
5. `view-manifest.json` を確定してNext.jsをデプロイ

## 外部ホスト方針（推奨）

- 一度生成して固定公開する要件なので、専用静的ホスト（例: GitHub Pages / Cloudflare R2+CDN）を採用する。
- この計画では「URLが固定で配布しやすい」ことを優先し、運用は手動公開でよい。

## 実装ステップ

1. `shift-search` 画面に結果一覧導線を追加
2. `build-shift-search-report-meta.mjs` を拡張し、分類情報を持つmanifestを生成
3. 内部対象のみJSON化するスクリプトを追加（`scripts/build-shift-search-view-assets.mjs`）
4. `/shift-search/reports` 一覧ページをSSGで作成（内部/外部リンク出し分け）
5. `/shift-search/reports/[lang]/[length]` をSSGで作成（内部対象のみ、全件表示）
6. 外部対象のアップロード手順をREADMEまたは運用メモに追記

## 受け入れ条件

- `/shift-search` から一覧ページへ遷移できる。
- 一覧で内部/外部が判別でき、リンクが正しく動作する。
- 内部対象はページングなしで全件表示される。
- `totalHitRows > 10000` のデータはNext.jsデプロイ成果物に含まれない。
- 外部URL切れ時は一覧で判別できる（「外部未設定」表示など）。

# NAZOMATIC Docs Index

この `docs/` 配下は、人間向けの仕様書・設計書・補助資料をまとめる領域です。実装と生成物は分けて管理します。

## 現在の正本

- 全体仕様: `docs/specification.md`
- AI 実装ルール: `docs/ai-coding-rules.md`
- BLANK25: `docs/blank25/specification.md`
- BLANK25 Editor: `docs/blank25/upload-editor-specification.md`
- BLANK25 Editor 保存方式: `docs/blank25/editor-storage-design.md`
- Shift Search: `docs/shift-search/specification.md`
- Shift Search レポート生成: `docs/shift-search/shift-search-report-generation-specification.md`
- Shift Search 結果ビュー: `docs/shift-search/shift-search-results-view-specification.md`
- Calendar UI: `docs/calendardoc/calendar-ui-specification.md`
- Calendar / Realtime API: `docs/calendardoc/firebase-registration-api-specification.md`
- Calendar Post visibility verify API: `docs/calendardoc/realtime-verify-post-visibility-api-specification.md`
- GitHub Actions 運用: `docs/calendardoc/github-actions-scheduling-specification.md`
- X repost: `docs/calendardoc/x-repost-api-specification.md`

## 設計・計画メモ

- Calendar 削除済み Post 非表示化計画: `docs/calendardoc/calendar-deleted-post-syndication-plan.md`

## ディレクトリ

- `docs/`
  - 全体仕様と AI 向け共通ルール。
- `docs/blank25`
  - BLANK25 本体、Editor、storage 連携の仕様書・設計書・補助資料。
- `docs/calendardoc`
  - Calendar / realtime 系の仕様書・設計書・スキーマ。
- `docs/shift-search`
  - Shift Search 本体とレポート生成 / 表示まわりの仕様書。

## 生成物との境界

- Shift Search のレポート成果物: `artifacts/shift-search/reports`
- Next.js が読む生成済み view assets: `src/generated/shift-search`

## 文書の見方

- `specification` / `実装準拠`: 現在コードと揃える前提の文書。
- `design`: 構成、責務分離、保存方式などの設計文書。
- `schema` / `readme` / `規約`: データ定義や外部リポジトリ運用の補助文書。
- `ai-coding-rules`: AI が必ず守る共通実装ルール。
- 例:
  - `docs/calendardoc/realtime-search-system-design.md` は初期構想を含む設計書
  - `docs/shift-search/shift-search-report-generation-specification.md` はレポート生成仕様書

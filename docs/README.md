# NAZOMATIC Docs Index

この `docs/` 配下は、人間向けの設計書と運用メモをまとめる領域です。実装と生成物は分けて管理します。

## 現在の正本

- 全体仕様: `docs/specification.md`
- BLANK25: `docs/blank25/specification.md`
- BLANK25 Editor: `docs/blank25/upload-editor-specification.md`
- Shift Search: `docs/shift-search/specification.md`
- Calendar / Realtime API: `docs/calendardoc/firebase-registration-api.md`
- GitHub Actions 運用: `docs/calendardoc/github-actions-scheduling-plan.md`
- X repost: `docs/calendardoc/x-repost-api-plan.md`

## ディレクトリ

- `docs/blank25`
  - BLANK25 本体、Editor、storage 連携の仕様と運用メモ。
- `docs/calendardoc`
  - Calendar / realtime 系の仕様、API、運用メモ。
- `docs/shift-search`
  - Shift Search 本体とレポート表示まわりの仕様。

## 生成物との境界

- Shift Search のレポート成果物: `artifacts/shift-search/reports`
- Next.js が読む生成済み view assets: `src/generated/shift-search`

## 文書の見方

- `specification` / `実装準拠`: 現在コードと揃える前提の文書。
- `plan` / `方針` / `再設計`: 設計メモや履歴を含む文書。現行実装と差分がある場合は、上の「現在の正本」を優先。
- 例:
  - `docs/calendardoc/realtime-search-api-plan.md` は初期構想メモ
  - `docs/shift-search/shift-search-expansion-plan.md` はレポート生成の計画メモ

# NAZOMATIC ドキュメント索引

この `docs/` 配下は、NAZOMATIC の設計書と運用上の判断材料をまとめる領域です。ソースコードを正とし、ドキュメントは実装に追従します。

## AGENTS.md との役割分担

- `AGENTS.md` は、AI エージェントが作業開始時に読む短い英語の実行ルールとして管理します。
- 詳細な仕様、設計、環境変数、バッチ運用、サブシステム固有の判断材料は、この `docs/` 配下の日本語ドキュメントに置きます。
- AI 向けの必須実装ルールは `docs/ai-coding-rules.md` を正本とします。
- 仕様や運用ルールを変更した場合は、該当ドキュメントとこの索引の更新要否を確認します。

## 読む順番

1. 全体像を知る: `docs/system-design.md`
2. 開発・環境変数・生成手順を確認する: `docs/development-guide.md`
3. サブシステムを変更する: 対象ディレクトリの設計書を読む
4. AI が UI やフォームを触る: `docs/ai-coding-rules.md` を必ず守る

## 設計書

| 文書 | 内容 |
|---|---|
| `docs/system-design.md` | 全体アーキテクチャ、ルート、API、データ境界、SEO、認証境界 |
| `docs/development-guide.md` | セットアップ、コマンド、環境変数、検証、ドキュメント運用 |
| `docs/public-tools/design.md` | しりとり、サイコロ、アルファベット、都道府県、方眼紙、辞書検索、星座検索 |
| `docs/blank25/design.md` | BLANK25 本体、作問モード、パーティ得点表示、Editor、外部 storage 連携 |
| `docs/calendar-realtime/design.md` | 謎チケカレンダー、Realtime 取得、Firestore、内部 API、GitHub Actions、X 再投稿 |
| `docs/x-browser-posting/design.md` | X API を使わないローカルブラウザ投稿自動化の要件、実装、運用リスク |
| `docs/x-browser-posting/schedules.md` | 稼働中の X 投稿・週次改善レビューのスケジュールと実行契約 |
| `docs/x-browser-posting/posting-persona.md` | X 投稿自動化で使う共通の投稿人格 |
| `docs/x-browser-posting/weekend-ticket-summary.md` | `#謎チケ売ります` の週末土日別件数サマリ投稿、AI文案生成、ローカル投稿自動化 |
| `docs/x-browser-posting/trend-joke-post.md` | Yahoo!リアルタイム検索で拾ったイベント名を材料にした短文ネタ投稿自動化の設計と現行実装 |
| `docs/shift-search/design.md` | シフト検索、辞書検索連携、レポート成果物、表示用生成 assets |
| `docs/character-pick-search/design.md` | 文字拾い検索の仕様、登録語、文字幅指定、検索判定 |
| `docs/ai-coding-rules.md` | AI 実装時の必須ルール |

## ディレクトリと生成物

| パス | 役割 |
|---|---|
| `docs/` | 日本語の設計書と運用資料 |
| `docs/maintenance/doc-audit-report.md` | ドキュメント同期時の自動修正・判断点・システム問題点レポート |
| `src/` | 実装の正本 |
| `src/generated/shift-search/` | Next.js が読む Shift Search 表示用生成 assets |
| `artifacts/shift-search/reports/` | Shift Search レポート元成果物 |
| `scripts/` | レポート生成・同期などの補助スクリプト |

## 保守ルール

- ドキュメントは日本語で書く。
- 実装と矛盾した場合は、ソースコードを正としてドキュメントを直す。
- 新しい設計判断を追加するときは、最も近い設計書へ追記する。
- 新しい設計書を追加したときは、この索引も更新する。
- 古い実装計画や重複した仕様書は、現行設計書へ統合して残さない。

# BLANK25 TODO / 未確定事項（実装準拠 2026-02-27）

## 1. 実装済み（通常モード）

1. 問題マニフェスト（`version` + `categories[]` + `problems[]`）の読み込みと検証
2. `/blank25` 問題一覧（カテゴリ表示、問題カード遷移）
3. `/blank25/[problemId]` ゲーム画面（5x5 パネル、回答判定）
4. 回答正規化（`NFKC`、かな統一、空白除去、小文字化）
5. クリアダイアログ + 紙吹雪演出
6. `localStorage` 永続化と復元
7. 一覧画面からの全問題リセット

## 3. 将来機能（別要件で管理）

1. 作問モード（`sakumon-mode-requirements.md`）
2. 共有機能（Web Share API / クリップボード）

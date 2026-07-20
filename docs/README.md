# NAZOMATIC ドキュメント索引

`src/`、設定ファイル、実行スクリプトを実装の正本とし、ここには現行システムの設計と運用だけを置きます。過去の計画、実装経緯、完了済みフェーズは設計書に残しません。

## 読む順番

1. 全体像: [`system-design/README.md`](./system-design/README.md)
2. 開発・検証・環境変数: [`development-guide.md`](./development-guide.md)
3. 対象サブシステム: [`system-design/subsystems/`](./system-design/subsystems/)
4. 既知の懸念点: [`system-design/quality/known-concerns.md`](./system-design/quality/known-concerns.md)

## 現行ドキュメント

| 文書 | 役割 |
|---|---|
| [`system-design/README.md`](./system-design/README.md) | システム設計書の正本と読み順 |
| [`system-design/architecture/`](./system-design/architecture/) | 全体構成、ルート/API、データ、セキュリティ |
| [`system-design/subsystems/`](./system-design/subsystems/) | 機能別の現行設計 |
| [`system-design/operations/`](./system-design/operations/) | 定期処理、生成物、ローカル自動化 |
| [`system-design/operations/x-browser-post-schedules.md`](./system-design/operations/x-browser-post-schedules.md) | 稼働中の X 投稿・週次改善レビューのスケジュールと実行契約 |
| [`system-design/quality/`](./system-design/quality/) | コードから確認できる既知の懸念点 |
| [`development-guide.md`](./development-guide.md) | セットアップ、コマンド、環境変数、変更時確認 |
| [`ai-coding-rules.md`](./ai-coding-rules.md) | AI がコードや UI を変更するときの必須ルール |
| [`maintenance/doc-audit-report.md`](./maintenance/doc-audit-report.md) | 直近のドキュメント同期結果 |

`ideas`、`strategy`、`research` はシステム設計書の管理対象外です。存在する場合も、設計書整理では変更・削除しません。

## 保守ルール

- ドキュメントは日本語で書く。
- 実装と矛盾した場合はコードを正として直す。
- 設計判断は最も近い文書へ一度だけ記載し、重複させない。
- 新規・削除・移動時は、この索引と `system-design/README.md` のリンクを更新する。
- 一時的な計画、検討メモ、完了履歴は設計書へ追加しない。

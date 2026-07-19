# X ブラウザ投稿の稼働スケジュール

## 位置づけ

この文書は、リポジトリ外のスケジューラーから起動している X ブラウザ投稿タスクの運用台帳です。2026-07-19 時点で、依頼者から稼働中と共有された登録内容を記録しています。

スケジューラー固有の ID、実行曜日、実行時刻、timezone はリポジトリに保存されていません。正確な cadence と有効・無効の最終状態は外部スケジューラー側を正とし、この文書では実行内容と登録枠数を管理します。

## 稼働中の登録枠

| 登録枠 | 状態 | 処理 | 1 回の起動で実行するコマンド |
|---|---|---|---|
| 週末サマリ A | 稼働中 | `#謎チケ売ります` の対象週末を土日別に集計して投稿 | `npm run x:browser-post:weekend-summary -- --execute` |
| 通常投稿 | 稼働中 | 投稿候補 1 件へコメントを付けて投稿 | `npm run x:browser-post -- --execute` |
| 週末サマリ B | 稼働中 | `#謎チケ売ります` の対象週末を土日別に集計して投稿 | `npm run x:browser-post:weekend-summary -- --execute` |

週末サマリ A/B は、同じコマンドと実行指示を持つ独立した 2 枠です。各枠の発火日時が異なる可能性があるため、この台帳では 1 枠へ統合しません。同日かつ同じ対象週末への再投稿は CLI のローカル重複防止で停止します。

## 共通の実行契約

- リポジトリルートで、指定コマンドを各起動につき 1 回だけ実行する。
- 設定は Git 管理外の `.env.x-browser-posting.local` から読み込む。
- 実投稿には `--execute` が必要。無人実行では `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` の両方を必要とする。
- CLI 自身のログ機能を使い、旧 `log/` への `tee` や独自 wrapper を追加しない。
- ログは `X_BROWSER_POST_LOG_RETENTION_COUNT` の世代数だけ保持する。未設定時は 10 世代。
- 失敗時は自動 retry しない。X の login、account 不一致、rate limit、UI 変更、CAPTCHA、2FA などを無理に回避しない。
- 実行後は「成功」「候補なし」「失敗」のいずれかと、対象ディレクトリ内の最新 log の絶対 path を短く報告する。

## 通常投稿の実行内容

`npm run x:browser-post -- --execute` は 1 回の起動で候補を最大 1 件処理し、実行ログを `logs/x-browser-post/` に保存します。

報告には次を含めます。

- 成功時: 投稿済みか、投稿 URL が出力されたか。
- 候補なし: 投稿候補がなかったこと。
- 失敗時: 終了 code、関連する stdout / stderr、出力された error screenshot や pending confirm file の path。

## 週末サマリの実行内容

`npm run x:browser-post:weekend-summary -- --execute` は、`Asia/Tokyo` の実行日から対象週末を決め、`#謎チケ売ります` の表示可能イベントを土日別に集計します。本文の一言はローカル候補文から選び、実行ログを `logs/x-browser-post-weekend-summary/` に保存します。

報告には次を含めます。

- 成功時: 対象週末、土曜件数、日曜件数、投稿 URL が出力されたか。
- 候補なし: 土日合計 0 件など、投稿対象がなかったこと。
- 失敗時: 同日・同対象週末の重複、rate limit、login account 不一致、X UI、CAPTCHA、2FA など、停止理由として判明した内容。

週末サマリの投稿結果は Firestore に保存しません。同日・同対象週末の重複防止状態は `local/x-browser-posting/weekend-summary-state.json` に保存します。

## 稼働確認

この文書の「稼働中」はスケジュールが有効であることを表し、直近実行の成功を保証するものではありません。実行結果は次の最新 log で確認します。

- 通常投稿: `logs/x-browser-post/`
- 週末サマリ A/B: `logs/x-browser-post-weekend-summary/`

週末サマリ A/B は同じ automation ID と log directory を共有するため、どちらの登録枠が生成した log かを repository 内の log だけで識別することはできません。

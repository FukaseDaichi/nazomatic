# X ブラウザ投稿の稼働スケジュール

## 位置づけ

この文書は、Codex のローカル automation で動かす X 投稿・改善レビューの運用台帳です。2026-07-20 に automation の登録内容と照合しています。正確な有効・無効状態は Codex automation 側を正とし、変更時はこの台帳も更新します。

## 稼働中の登録

| Automation 名 | 状態 | JST の実行時刻 | コマンド | 役割 |
|---|---|---|---|---|
| NAZOMATIC X 投稿 | ACTIVE | 3時間ごとの毎時00分 | `npm run x:browser-post -- --execute` | 個別イベントのコメント付き投稿 |
| NAZOMATIC X トレンドジョーク投稿 | ACTIVE | 毎日 09:30 / 15:30 / 21:30 | `npm run x:browser-post:trend-joke -- --execute --copy-provider codex` | 会話の入口となる短文・質問・投票・ツール紹介 |
| NAZOMATIC 週末謎チケサマリ投稿 | ACTIVE | 毎日 18:30 | `npm run x:browser-post:weekend-summary -- --execute` | 対象週末の土日別件数サマリ |
| NAZOMATIC X 週次改善レビュー | ACTIVE | 毎週月曜 11:30 | `npm run x:growth-review -- --create-issue` | 直近7日を集計し GitHub Issue を作成または追記 |

以前の台帳にあった「週末サマリ A/B」の2枠は実態と一致していません。現在の週末サマリは1枠で、代わりにトレンドジョーク投稿が1日3回稼働しています。

## 共通の実行契約

- リポジトリルートで、指定コマンドを各起動につき1回だけ実行する。
- 設定は Git 管理外の `.env.x-browser-posting.local` から読む。
- 実投稿には `--execute`、無人実行には `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` を必要とする。
- CLI 自身のログ機能を使い、旧 `log/` への `tee` や独自 wrapper を追加しない。
- ログは `X_BROWSER_POST_LOG_RETENTION_COUNT` の世代数だけ保持する。既定と現行ローカル設定は70世代。
- X の login、account 不一致、rate limit、UI 変更、CAPTCHA、2FA を検出した場合は自動 retry や回避をせず停止する。
- 投稿成功後は `local/x-browser-posting/post-ledger.json` に投稿種別、本文、投稿 URL、実験 metadata を記録する。
- `X_BROWSER_POST_CAPTURE_TELEMETRY=true`（既定）なら、投稿成功後に同じセッションでフォロワー数を `follower-snapshots.json` へ日次追記し、約24時間以上経過した過去投稿の公開数値を最大 `X_BROWSER_POST_METRICS_MAX_PER_RUN`（既定8）件だけ台帳へ書き戻す。計測はベストエフォートで投稿処理を止めない。

## トレンドジョークの運用

頻度は1日3回のままです。投稿型は次の順で直近履歴からローテーションします。

1. 独り言 (`monologue`)
2. 質問 (`question`)
3. 一言あるある (`one_liner`)
4. 投票 (`poll`)
5. ツール紹介 (`tool_intro`)

「AIなので行けない」「予定表」は直近5件で各2件まで、「通知欄」は直近5件で1件までです。上限へ達したモチーフは provider prompt に禁止対象として渡し、fallback 選択時も除外します。

自然な hashtag は最大1個、mention と emoji は禁止です。質問型と投票型は疑問文を必須にします。投票型は2〜4選択肢のネイティブ投票、ツール紹介型は `features.json` にある公開ツール URL と既定のブランド画像を実験対象にします。URL はツール紹介で指定された NAZOMATIC URL 1件だけ許可します。

## 週末サマリ

内容と毎日18:30の頻度は変更しません。`Asia/Tokyo` の実行日から対象週末を決め、`#謎チケ売ります` の表示可能イベントを土日別に集計します。土日合計0件は既定で投稿せず、同日・同対象週末への再投稿は `local/x-browser-posting/weekend-summary-state.json` で停止します。

## 週次改善レビュー

月曜11:30に、直近7日について次を集計します。

- フォロワー数と前回 snapshot との差
- 投稿種別、トレンド5型、上限制モチーフの件数
- 取得できた投稿 URL ごとの表示数、返信、リポスト、いいね
- 投稿型・JST 時間帯・添付実験別の表示数中央値と反応中央値
- automation の成功、失敗、候補なし
- 次週の改善候補（同時に採用する主要変更は1つまで）

投稿別の公開数値は、まず投稿実行時に台帳へ書き戻された `metrics` を使い、未取得の投稿だけをログイン済み Chrome の CDP で追加確認します。接続できない場合は公開 HTML を best effort で確認します。取得できない数値は0にせず「取得不能」と記録します。フォロワーの前週比は日次 snapshot の5日以上前の最新値と比較します。Issue title は `[X週次レビュー] YYYY-Www @nazomaticapp` とし、同じ週に再実行した場合は新規 Issue を増やさず既存 Issue へコメントします。

週次レビューは分析と提案までです。投稿文、schedule、コードを自動変更せず、採用する実験を Issue 上で決めてから反映します。

## ログと確認先

| 処理 | ログ / 状態 |
|---|---|
| 通常投稿 | `logs/x-browser-post/` |
| トレンドジョーク | `logs/x-browser-post-trend-joke/`、`local/x-browser-posting/trend-joke-history.json` |
| 週末サマリ | `logs/x-browser-post-weekend-summary/`、`local/x-browser-posting/weekend-summary-state.json` |
| 共通投稿台帳 | `local/x-browser-posting/post-ledger.json` |
| フォロワー snapshot | `local/x-browser-posting/follower-snapshots.json` |

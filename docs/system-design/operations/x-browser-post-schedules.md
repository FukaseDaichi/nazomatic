# X ローカル運用の稼働スケジュール

## 位置づけ

この文書は、Codex のローカル automation で動かす X 投稿・週次レビュー・改善 PR・成長計測の運用台帳です。2026-07-24 に `~/.codex/automations/*/automation.toml`、ローカル実行設定、対応 CLI と照合しています。

正確な有効・無効状態、時刻、model、通知設定は Codex automation 側を正とし、CLI の挙動は `scripts/` と `src/server/x-browser-posting/` を正とします。登録や実装を変更した場合は、この台帳も同時に更新します。

## 稼働中の登録

| Automation ID | Automation 名 | 状態 | JST の実行時刻 | コマンド | 役割 |
|---|---|---|---|---|---|
| `nazomatic-x` | NAZOMATIC X 投稿 | ACTIVE | 3時間間隔（実行分は00分） | `npm run x:browser-post -- --execute` | 個別イベントのコメント付き投稿 |
| `nazomatic-x-2` | NAZOMATIC X トレンドジョーク投稿 | ACTIVE | 毎日 09:30 / 15:30 / 21:30 | `npm run x:browser-post:trend-joke -- --execute --copy-provider codex` | 会話の入口となる短文・質問・投票・ツール紹介 |
| `nazomatic` | NAZOMATIC 週末謎チケサマリ投稿 | ACTIVE | 毎日 18:30 | `npm run x:browser-post:weekend-summary -- --execute` | 対象週末の土日別件数サマリ |
| `nazomatic-x-3` | NAZOMATIC X 週次改善レビュー | ACTIVE | 毎週月曜 11:30 | `npm run x:growth-review -- --create-issue` | 直近7日を集計し GitHub Issue を作成または追記 |
| `nazomatic-x-pr` | NAZOMATIC X 週次改善PR作成 | ACTIVE | 毎週月曜 12:30 | `npm run x:growth-improve -- --execute` | 当週レビューから実験を1件選びドラフト PR を作成 |
| `nazomatic-x-4` | NAZOMATIC X 成長計測メンテナンス | ACTIVE | 毎日 04:30 | `npm run x:growth-maintain` | 投稿せず follower / metrics を回収し、実験 activation を照合 |

`nazomatic-x` の RRULE は `FREQ=HOURLY;INTERVAL=3;BYMINUTE=0;BYSECOND=0` で、特定の `BYHOUR` や `TZID` は持ちません。そのため台帳では固定の時刻列を推測せず、「3時間間隔（実行分は00分）」と記載します。ほかの5件は `TZID=Asia/Tokyo` を明示しています。

## 登録済みの実行設定

全6件とも `execution_environment=local` で、対象 project と実行ディレクトリはこのリポジトリです。

| Automation ID | Model | Reasoning effort | 通知 |
|---|---|---|---|
| `nazomatic-x` | `gpt-5.6-sol` | `medium` | Codex automation の既定 |
| `nazomatic-x-2` | `gpt-5.5` | `medium` | Codex automation の既定 |
| `nazomatic` | `gpt-5.5` | `low` | Codex automation の既定 |
| `nazomatic-x-3` | `gpt-5.6-sol` | `medium` | Codex automation の既定 |
| `nazomatic-x-pr` | `gpt-5.6-sol` | `medium` | Codex automation の既定 |
| `nazomatic-x-4` | `gpt-5.6-sol` | `medium` | 失敗時のみ通知 |

## 現行ローカル実行設定

秘密値を除いた `.env.x-browser-posting.local` の有効設定は次のとおりです。未記載の token、CDP URL、profile path などはこの台帳へ転記しません。

| 項目 | 有効値 | 意味 |
|---|---|---|
| 投稿 account | `@nazomaticapp` | 設定値を小文字正規化。login 中 account が異なる場合は停止 |
| confirmation | `auto` + auto execute 許可済み | 無人実行の二重 lock が有効 |
| provider auto approve | 有効 | Codex provider 文案の無人投稿を許可 |
| Chrome | auto start 有効、headless 有効、前面化なし | 専用 profile の CDP Chrome を背面実行 |
| telemetry | 有効（未指定時の既定） | 投稿成功後に follower / 過去投稿 metrics を取得 |
| metrics 上限 | 1実行8件（未指定時の既定） | 20時間〜8日の未取得投稿を古い順に回収 |
| 投稿制限 | cooldown 3分、1日30件、1実行1件 | local CLI 側の上限 |
| log 保持 | 70世代 | automation ID ごとに古い `*.log` を削除 |

## 共通の実行契約

- リポジトリルートで、指定コマンドを各起動につき1回だけ実行する。
- 設定は Git 管理外の `.env.x-browser-posting.local` から読む。
- 実投稿には `--execute`、無人実行には `X_BROWSER_POST_CONFIRMATION_MODE=auto` と `X_BROWSER_POST_AUTO_EXECUTE_ALLOWED=true` を必要とする。
- CLI 自身のログ機能を使い、旧 `log/` への `tee` や独自 wrapper を追加しない。
- ログは `X_BROWSER_POST_LOG_RETENTION_COUNT` の世代数だけ保持する。既定と現行ローカル設定は70世代。
- automation 層は CLI の失敗時に自動 retry、guard 回避、独自のファイル変更を行わず、終了コードと関連 log を報告する。
- X の login、account 不一致、rate limit、UI 変更、CAPTCHA、2FA を検出した場合は回避せず停止する。
- 投稿成功後は `local/x-browser-posting/post-ledger.json` に投稿種別、本文、投稿 URL、実験 metadata を記録する。
- `X_BROWSER_POST_CAPTURE_TELEMETRY=true`（既定）なら、投稿成功後に同じセッションでフォロワー数を `follower-snapshots.json` へ日次追記し、20時間〜8日の過去投稿の公開数値を最大 `X_BROWSER_POST_METRICS_MAX_PER_RUN`（既定8）件だけ台帳へ書き戻す。計測はベストエフォートで投稿処理を止めない。
- 週次改善エージェントは提案を1件・1ファイル・ちょうど1回一致する find/replace に限定する。allowlist 外・`config.mjs`・rate limit・`--execute` 系への変更は Node 側が自動で拒否し、適用後に tsc/lint/構文が通らなければ変更を破棄して PR を作らない。PR はドラフトで作成し、自動マージはしない。採用可否は人間が Issue と PR 上で判断する。

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

## 週次改善レビューと改善 PR

月曜11:30に、直近7日について次を集計します。

- フォロワー数と前回 snapshot との差
- 投稿種別、トレンド5型、上限制モチーフの件数
- 取得できた投稿 URL ごとの表示数、返信、リポスト、いいね
- 投稿型・JST 時間帯・添付実験別の表示数中央値と反応中央値
- automation の成功、失敗、候補なし
- 次週の改善候補（同時に採用する主要変更は1つまで）

投稿別の公開数値は、まず投稿実行時に台帳へ書き戻された `metrics` を使い、未取得の投稿だけをログイン済み Chrome の CDP で追加確認します。接続できない場合は公開 HTML を best effort で確認します。取得できない数値は0にせず「取得不能」と記録します。フォロワーの前週比は日次 snapshot の5日以上前の最新値と比較します。Issue title は `[X週次レビュー] YYYY-Www @nazomaticapp` とし、同じ週に再実行した場合は新規 Issue を増やさず既存 Issue へコメントします。

週次レビューは分析と提案までです。投稿文、schedule、コードを自動変更せず、採用する実験を Issue 上で決めてから反映します。

月曜12:30の `nazomatic-x-pr` は、11:30のレビューが作成または更新した当週・対象 account の Issue 本文を入力にします。直近14日の投稿で、24時間以上8日以内の metrics 成熟率が70%以上かつ5件以上の場合だけ、Codex CLI の read-only 提案を Node 側の allowlist と検証へ通します。`origin/main` から作った一時 worktree で commit、push、ドラフト PR 作成を行い、通常 checkout は変更しません。

実験状態は GitHub の review Issue、`x-growth-experiment` PR、label、metadata marker が正本です。ローカル実験台帳はありません。詳細は [`../subsystems/x-growth-improve-agent.md`](../subsystems/x-growth-improve-agent.md) を参照します。

## 成長計測メンテナンス

毎日04:30の `nazomatic-x-4` は投稿を行わず、起動済みで login 済みの Chrome CDP セッションを使います。フォロワー snapshot と、20時間〜8日の未取得投稿 metrics を成熟窓の終了が近い順に回収した後、GitHub の実験 PR を照合します。

merged PR の merge commit、またはその子孫 commit に successful `Production` deployment がある場合だけ activation を進めます。24時間以上8日以内の metrics が5件未満、または成熟率70%未満なら `x-growth:needs-attention` を付けて保留します。十分なら PR metadata の評価予定週を更新し、activation marker と `x-growth:active` label を付けます。GitHub 認証、deployment 照合、Chrome/CDP に失敗した場合は強制 activation しません。

## ログと確認先

| 処理 | ログ / 状態 |
|---|---|
| 通常投稿 | `logs/x-browser-post/` |
| トレンドジョーク | `logs/x-browser-post-trend-joke/`、`local/x-browser-posting/trend-joke-history.json` |
| 週末サマリ | `logs/x-browser-post-weekend-summary/`、`local/x-browser-posting/weekend-summary-state.json` |
| 共通投稿台帳 | `local/x-browser-posting/post-ledger.json` |
| フォロワー snapshot | `local/x-browser-posting/follower-snapshots.json` |
| 週次改善レビュー | GitHub の `x-growth-review` Issue。専用 local log は作らない |
| 週次改善PR作成 | `logs/x-growth-improve/`、GitHub の review Issue / experiment PR |
| 成長計測メンテナンス | `logs/x-growth-maintain/`、投稿台帳・フォロワー snapshot |

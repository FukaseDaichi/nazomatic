# X 成長改善 automation

## 目的と正本

X 投稿の改善は、週次レビュー、1件のドラフト PR、production 反映後の評価を順番に行う。自動化は PR を作成するまでで、自動マージ、自動 keep、自動 revert は行わない。

実験の正本は GitHub の PR、review Issue、label、本文・コメントの機械可読 marker である。`local/x-browser-posting/experiment-ledger.json` は作成・参照しない。投稿台帳とフォロワー snapshot はローカル PC 固有の計測データとして残す。

## 実行コマンド

```bash
npm run x:growth-review -- --create-issue
npm run x:growth-improve
npm run x:growth-improve -- --execute
npm run x:growth-maintain
```

- `x:growth-review`: 当週・account 固有の `x-growth-review` Issue を作成または更新する。
- `x:growth-improve`: 既定は dry-run。`--execute` 時だけ GitHub を変更する。
- `x:growth-maintain`: 投稿を行わず、Chrome CDP を使ってフォロワー snapshot と成熟済み投稿の公開数値を回収する。さらに、production deployment を確認できた merged 実験 PR を active 化する。

## PR 作成の安全境界

`--execute` は control checkout を変更しない。`git fetch origin main` の後、OS 一時ディレクトリの worktree を `origin/main` から detach で作成し、そこで `npm ci`、基底の verify、単一ファイル変更、verify、commit、push、PR 作成を行う。完了時は worktree を除去する。

提案生成の Codex CLI は read-only sandbox であり、変更は Node 側が実行する。編集先は次だけである。

| path | kind | targetKey |
|---|---|---|
| `src/server/x-browser-posting/comment-patterns.json` | `json-array` | `comment-pattern:*` |
| `src/server/x-browser-posting/trend-joke-post.ts` | `ts-copy` | `trend-joke:*` |

`ts-copy` は既存の禁止 token と構造注入 guard（`;`, `{}`, backtick, `=>`）を通過しなければならない。`find` はちょうど1回一致が必要で、同じ targetKey を使った過去の PR は再提案しない。

## 計測ゲート

提案前に直近14日から、24時間以上8日以内の投稿の metrics 成熟率を計算する。対象が5件未満、または成熟率が70%未満なら `skipped_insufficient_telemetry` とし、execute では review Issue を理由付きで閉じる。表示数などの数値を0として補完しない。

metric は `median_views`、`median_engagement`、`reply_post_rate` のいずれかで、filter は `postType`、`archetype`、`hasMedia`、`shape`、`topicKey`、`postedAt` 由来の `jstHourBucket` だけを許可する。null・空値は filter に一致しない。

前後比較なので時系列交絡は残る。評価時は baseline と比較値だけで決めず、同期間のフォロワー数変化、総投稿数、曜日構成も review Issue で確認する。

## GitHub lifecycle

PR は `x-growth-experiment` label、`Closes #<review Issue>`、次の metadata を持つ。

```html
<!-- x-growth-experiment:v1 {"reviewIssue":123,"account":"account","targetKey":"trend-joke:copy","plannedEvaluateWeek":"2026-W31"} -->
```

review Issue との対応は `reviewIssue + account` で冪等に検索する。PR 作成コマンドが timeout した場合は、branch 名で PR を再検索し、存在すれば partial success として branch を残す。

maintenance は merged PR の merge commit を ancestor とする successful production deployment を許可する。これは merge SHA の deployment が cancel され、その子孫 commit の deployment が成功したケースを含む。deployment 未確認は `activation_pending` のままにする。テレメトリ不足なら `x-growth:needs-attention`、十分なら active marker と `x-growth:active` label を付ける。

人間は評価後、継続なら `x-growth:keep`、revert を行うなら `x-growth:revert`、revert 完了なら `x-growth:reverted` を PR に付ける。keep / reverted は終端状態なので新規実験を許可する。

## lock と失敗

execute は `local/x-browser-posting/locks/x-growth-improve.lock` を `fs.open(..., "wx")` で atomically 作って排他する。lock が残っている場合は review Issue に `x-growth:needs-attention` を付け、理由をコメントして失敗終了する。dry-run は lock、Git、GitHub、運用 state を変更しないが、監査 log は残す。

## 運用上の注意

- `x:growth-maintain` は日次、`x:growth-review` と `x:growth-improve -- --execute` は週次で実行する。
- PR が merge されると closing keyword により review Issue は GitHub が閉じる。
- Issue / PR の状態が変わらないときは同じ skip 通知を繰り返さず、運用側のスケジューラーでも状態変化時だけ通知する。
- GitHub 認証・deployment API・Chrome login の失敗は自動判断せず、ログと `x-growth:needs-attention` を確認して復旧する。

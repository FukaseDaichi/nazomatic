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
- `x:growth-maintain`: 投稿を行わず、Chrome CDP で設定対象のプロフィールを開き、blocking state とログイン account を確認してからフォロワー snapshot と成熟済み投稿の公開数値を回収する。さらに、production deployment を確認できた merged 実験 PR を active 化する。

Codex automation には、レビューが毎週月曜11:30 JST、`x:growth-improve -- --execute` が毎週月曜12:30 JST、`x:growth-maintain` が毎日04:30 JSTで ACTIVE 登録されています。登録の正本と model / 通知設定は [`../operations/x-browser-post-schedules.md`](../operations/x-browser-post-schedules.md) を参照します。

## PR 作成の安全境界

`--execute` は通常の開発 checkout を変更しない。Codex automation は専用の automation checkout を control checkout として使い、そこから `git fetch origin main` の後、OS 一時ディレクトリの worktree を `origin/main` から detach で作成する。依存関係は package / lockfile と実行環境が一致する検証済み cache から復元し、cache miss のときだけ `npm ci` を実行する。その後、基底の verify、単一ファイル変更、verify、commit、push、PR 作成を行い、完了時は一時 worktree を除去する。基底の verify は提案対象パスに関わらず `src/server/x-browser-posting/trend-joke-post.ts` を対象に固定で実行する。

提案生成の Codex CLI は read-only sandbox であり、変更は Node 側が実行する。1つの仮説と1つの targetKey に対し、同一ファイル内で最大6件の局所 find/replace を提案できる。編集先は次だけである。

提案生成の Codex CLI には1200秒の制限時間を設ける。timeoutまたはCodex実行失敗は `proposal_broken` として review Issue に記録し、提案・検証・GitHub操作の自動リトライは行わない。詳細な終了コード、signal、経過時間、標準出力・標準エラーは `logs/x-growth-improve/` の実行ログへ残す。

| path | kind | targetKey |
|---|---|---|
| `src/server/x-browser-posting/comment-patterns.json` | `json-patch` | `comment-pattern:*` |
| `src/server/x-browser-posting/trend-joke-post.ts` | `ts-patch` | `trend-joke:*` |

`ts-patch` は投稿生成戦略、fallback、prompt、候補選択ロジックの変更を許可し、TypeScript の構造文字や template literal、最上位フロー内の安全なデータ受け渡し、archetypeの既定選択も扱える。ただし import、環境変数、外部 I/O、process 実行、投稿実行 guard、入力validator本体、URL構築、文字数・検索件数・timeout などの運用・安全境界は変更できない。Node は TypeScript AST から import、保護宣言、外部取得・validator・fingerprint・上限付き正規化の重要 call を変更前後で比較する。archetype validator は引数の戦略変更を許しつつ呼出回数を固定する。さらに追加コードの禁止 API、最大120変更行、最大12000置換文字を検査する。`json-patch` は配列長を維持する。

各 `find` はそれ以前の patch 適用後の内容にちょうど1回一致する必要がある。同じ targetKey を使った過去の PR は再提案しない。変更後は TypeScript、lint、X投稿回帰テスト、production build をtimeout付きで実行する。検証を通った変更も必ずドラフト PR とし、実装差分と実験仮説を人間が確認してから merge する。1実験で許すのは主要な行動変化1つであり、変更行数1行という意味ではない。

## 提案入力（review Issue の会話）

週次レビューは同じ週の再実行結果を既存 Issue のコメントへ追記する。そのため `x:growth-improve` は review Issue の本文だけでなくコメントも `gh issue view --json ...,comments` で取得し、本文 → コメント（古い順）の順で連結して Codex へ渡す。

- `### Issue本文（@作成者 / 日時）`、`### コメントN/M（@作成者 / 日時）` の見出しで各発言を帰属付けする。
- `<!-- x-growth-*:v1 ... -->` の機械可読 marker は除去し、marker だけのコメントは入力から落とす。
- 入力上限は20000文字。Issue 本文は上限の60%までに抑え、コメントは新しい順に採用して古いコメントから落とす。省略が発生した件数と理由は `> 注記:` 行で明示する。
- コメントが0件なら Issue 本文をそのまま渡す。
- prompt では、内容が矛盾する場合に最新コメントを優先するよう指示する。

## 計測ゲート

提案前に直近14日から、24時間以上8日以内の投稿の metrics 成熟率を計算する。対象が5件未満、または成熟率が70%未満なら `skipped_insufficient_telemetry` とし、execute では review Issue を理由付きで閉じる。表示数などの数値を0として補完しない。成熟済み投稿から `minimumSampleSize=5` を満たす metric candidate が1件も生成できない場合も、Codexを呼ばず、同じ status と理由で見送る。

metric は `median_views`、`median_engagement`、`reply_post_rate` のいずれかで、filter は `postType`、`archetype`、`hasMedia`、`shape`、`topicKey`、`postedAt` 由来の `jstHourBucket` だけを許可する。null・空値は filter に一致しない。候補生成はNode側で行い、各 candidate は `candidateId`、metric name、filters（0件または1件）、`sampleSize`、`minimumSampleSize=5`、`maturityHours=24`、`windowDays=14`、`direction=increase` を保持する。candidateId は metric name と単独 filter の値から決定的に生成し、候補の順序も sampleSize と candidateId の決定的な並びで固定する。`postType + archetype` のような複合 candidate は生成しない。

Codex CLI へ渡す Structured Outputs schema は、すべての object で未知 property を禁止し、宣言した property を required にする。`metric` は生の metric object ではなく `{ "candidateId": "..." }` だけを受け付け、enum はその実行でNodeが生成した candidateId から動的に構築する。提案受領後、Node側で candidateId を候補へ照合し、既存形式の `proposal.metric`（name、filters、固定条件）へ復元してからローカル validator、baseline 集計、PR作成へ渡す。schemaで制限していても未知 candidateId と candidateId 以外の metric property はローカルで拒否する。LLM出力でsample不足、未許可filter、複合filterを表現できない設計にする。

prompt には、仮説に合う単独 candidate がない場合、複合filterを合成せず、別の仮説または filterなし candidate を選ぶよう明記する。minimum sampleは5件、成熟時間は24時間、評価窓は14日、方向はincreaseにNode側で固定し、LLMには決めさせない。Node側の baseline sample guard、allowlist、targetKey重複防止、1アカウント1実験の制約は最終境界として維持する。

前後比較なので時系列交絡は残る。評価時は baseline と比較値だけで決めず、同期間のフォロワー数変化、総投稿数、曜日構成も review Issue で確認する。

## GitHub lifecycle

PR は `x-growth-experiment` label、`Closes #<review Issue>`、次の metadata を持つ。

```html
<!-- x-growth-experiment:v1 {"reviewIssue":123,"account":"account","targetKey":"trend-joke:copy","plannedEvaluateWeek":"2026-W31"} -->
```

review Issue との対応は `reviewIssue + account` で冪等に検索する。PR 作成コマンドが timeout した場合は、branch 名で PR を再検索し、存在すれば partial success として branch を残す。

metadata marker はコメント終端 `-->` までを JSON 本文として解析し、`metric.filters` や `proposalBaseline` のようなネスト object を保持する。marker が欠損、不正、または重複している実験 PR は fail closed とし、改善 PR 作成を `rejected` で止める。maintenance が merged PR の不正 marker を検出した場合は `x-growth:needs-attention` を付け、自動 activation を行わない。

PR 作成時に、その時点の直近投稿から `proposalBaseline` と評価予定週を metadata へ保存します。評価予定週は PR 作成時が `windowDays + 1` 日後、activation 時の再計算が `windowDays` 日後の JST ISO 週で、両者の式は1日ずれています。maintenance は merged PR の merge commit を ancestor とする successful production deployment を許可します。これは merge SHA の deployment が cancel され、その子孫 commit の deployment が成功したケースを含みます。deployment 未確認時の maintenance 結果は `activation_pending`、実験 phase は `pending_activation` のままです。

deployment を確認した時点でテレメトリが不足していれば `x-growth:needs-attention` を付けます。十分なら deployment 時刻を `activeAt` とし、評価予定週を更新して activation marker と `x-growth:active` label を付けます。現行実装は activation 時に baseline を再集計せず、PR 作成時の `proposalBaseline` を `evaluationBaseline` として marker へ引き継ぎます。

人間は評価後、継続なら `x-growth:keep`、revert を行うなら `x-growth:revert`、revert 完了なら `x-growth:reverted` を PR に付ける。keep / reverted は終端状態なので新規実験を許可する。

実験状態は `open_pr`、`pending_activation`、`active`、`needs_attention`、`revert_requested`、`terminal`、`closed_unmerged` に分類する。merged だが `x-growth:active` がない PR は `pending_activation` であり、production 反映待ちなので新規実験をまだ許可しない。`x-growth:active` 付きは評価待ちの `active`、`x-growth:keep` / `x-growth:reverted` は `terminal`、未mergeでcloseされた PR は `closed_unmerged` とする。1アカウント1実験の guard は同じ account の非終端 PR だけを対象にし、従来の `skipped_active_experiment` status に `phase` と理由を添えて状態を区別する。

週次レビューが「実験の勝敗」へ出すのは、`x-growth:active` で metadata の `plannedEvaluateWeek` が実行週と完全一致する merged PR だけです。比較には PR 作成時の `proposalBaseline` を表示し、keep / revert は人間が判断します。

## lock と失敗

execute は `local/x-browser-posting/locks/x-growth-improve.lock` を `fs.open(..., "wx")` で atomically 作って排他する。lock が残っている場合は review Issue に `x-growth:needs-attention` を付け、理由をコメントして失敗終了する。dry-run は lock、Git、GitHub、運用 state を変更しないが、監査 log は残す。

依存 cache は `package.json`、`package-lock.json`、Node、npm、OS、CPU architecture を key にし、install script まで正常終了した `node_modules` だけを ready marker とともに atomically 保存する。macOS の既定保存先は `~/Library/Caches/nazomatic/x-growth-dependencies/` で、`X_GROWTH_DEPENDENCY_CACHE_DIR` があればその path を使う。誤削除防止のため override path の末尾は `x-growth-dependencies` を必須とし、cache root の symbolic link は拒否する。worktree へは cache 本体を直接共有せず、macOS では APFS clone、その他では copy して検証中の書き込みを分離する。cache は新しい2世代を保持する。

cache miss の install は `npm ci --prefer-offline --no-audit --no-fund --foreground-scripts` を使う。timeout、process signal、または一時的な network error の場合だけ、process group 全体を終了し、不完全な worktree と cache staging を破棄し、`origin/main` から新しい worktree を作って1回だけ再試行する。lockfile不整合など決定的な error、Codex 提案、guard、検証、commit、push、PR 作成は再試行しない。2回とも失敗した場合は両 attempt の command、cwd、exit code、signal、timeout、経過時間、stdout / stderr を `base_broken` の理由と local log に残す。

## 運用上の注意

- `x:growth-maintain` は日次、`x:growth-review` と `x:growth-improve -- --execute` は週次で実行する。
- PR が merge されると closing keyword により review Issue は GitHub が閉じる。
- `x-growth:needs-attention` の PR は maintenance の自動 activation 対象から除外される。原因を解消し、人間が label を外してから再実行する。
- GitHub 認証・deployment API・Chrome login の失敗は自動判断せず、ログと `x-growth:needs-attention` を確認して復旧する。

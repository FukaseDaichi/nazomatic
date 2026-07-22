# X 週次改善 PR 自動化 最終仕様

## 1. 文書の位置づけ

この文書は、X 週次改善レビューから安全にドラフト PR を作り、実験を評価して終了させるまでの**実装目標仕様**です。現行コードの説明ではありません。実装が完了し検証された時点で、内容を `docs/system-design/` 配下へ反映し、この文書は削除または完了済み資料として整理します。

対象は次の処理です。

- `npm run x:growth-review -- --create-issue`
- `npm run x:growth-improve -- --execute`
- 上記を起動する Codex automation
- 改善実験に対応する GitHub Issue、Pull Request、branch

## 2. 解決する問題

現行実装には次の運用上の問題があります。

1. 週次レビュー Issue を自動で終了させる契約がなく、毎週 open Issue が増える可能性がある。
2. 改善 PR は前回の未処理 PR を確認せず、再実行のたびに別 PR を作れる。
3. branch を現在の checkout から作るため、`origin/main` 起点である保証がない。
4. 通常の作業ディレクトリ上でファイル変更、branch 切替、commit を行うため、人間の作業と衝突する。
5. PR 作成失敗時に local branch、commit、remote branch が残る可能性がある。
6. Git 管理外の投稿台帳、フォロワー snapshot、ログは worktree に現れない。
7. `experiment-ledger.json` は GitHub の PR 状態と同期せず、`open` のまま残り得る。
8. 評価予定週と完全一致した実験だけを拾うため、評価週の実行失敗で対象を永久に取りこぼす。
9. PR とレビュー Issue の関連が任意引数に依存し、定期実行では自動リンクされない。
10. PR のマージ、未マージ close、revert、branch 削除に一貫したライフサイクルがない。
11. 前後比較だけでは、フォロワー数、トレンド、総投稿数、曜日などの時間交絡を除去できない。
12. 投稿成功後だけ動くテレメトリ取得では、投稿停止中に成熟期限を過ぎた指標を永久に取りこぼす。
13. 自由文 metric や実在しない metadata filter では、PR 作成後に決定論的な評価ができない。

## 3. 設計判断

### 3.1 GitHub PR を実験の正本にする

`local/x-browser-posting/experiment-ledger.json` は廃止します。1件の改善 PR を1件の実験として扱い、状態は GitHub の情報から導出します。

- 仮説、変更内容、指標、評価予定週: PR 本文
- 提案中、採用、不採用: PR の open / merged / closed 状態
- 人間の評価判断: PR label と評価コメント
- 元レビュー: PR 本文の closing keyword と機械可読 metadata
- branch: PR の `headRefName`

実験状態を複製して保存する独自台帳は持ちません。これにより GitHub と local JSON の二重管理をなくします。

### 3.2 投稿・計測データは当面ローカルを正本にする

次のデータは実験状態ではなく、投稿実行と効果測定のための時系列データです。当面は既存の Git 管理外領域を正本にします。

- `local/x-browser-posting/post-ledger.json`
- `local/x-browser-posting/follower-snapshots.json`
- trend joke / weekend summary の state と history
- `logs/{automationId}/`
- error screenshot、pending confirmation file

これらを一時 worktree へコピーしません。改善 CLI の起動元を `runtimeRoot`、コードを変更する一時 worktree を `worktreeRoot` として明確に分離します。

```text
runtimeRoot（通常リポジトリ）
├── .env.x-browser-posting.local
├── local/x-browser-posting/        # 投稿・計測 state
└── logs/                           # 実行ログ

temporaryRoot/
└── worktree/                       # origin/main 由来の使い捨て checkout
```

Firestore への移行は本仕様の必須要件にしません。複数端末実行、遠隔監視、local disk 障害対策が必要になった時点で、投稿・計測データだけを移行します。実験状態は移行後も GitHub を正本にします。

MCP Memory Server は正本にしません。将来 AI から GitHub や計測データを横断参照したい場合のアクセス層としてのみ検討します。

### 3.3 1アカウントにつき同時に1実験だけ許可する

未評価の実験がある状態では次の改善 PR を作りません。複数変更が同時に有効になり、効果の帰属が不明になることも防ぎます。

次のいずれかが存在する場合を「進行中」とします。

- `x-growth-experiment` label 付き open PR
- `x-growth-experiment` label 付き merged PRで、production 反映待ちまたは評価結果 label が付いていないもの
- revert 判断済みで revert 完了が確認できていないもの

進行中の実験がある場合、新しい週次レビュー Issue には対象 PR を記載し、改善 PR 作成は `skipped_active_experiment` で終了します。

### 3.4 テレメトリ健全性を実験開始の前提にする

進行中実験の確認とは別に、proposal 作成前に直近計測窓のテレメトリ成熟率を検査します。

```text
telemetryMaturityRate = mature metrics取得済み投稿数 / 指標取得対象投稿数
```

分母は、対象 account、対象期間内、`maturityHours` 以上経過した全投稿です。投稿 URL が取得できなかった投稿、metrics を取得できないまま8日を過ぎた投稿も分母へ含めます。投稿から `maturityHours` 未満のものはまだ取得対象でないため分母から除外します。

次をすべて満たす場合だけ実験 proposal を許可します。

- 対象投稿数が `minimumSampleSize` 以上
- テレメトリ成熟率が70%以上
- metric / filters に一致する成熟済み baseline が `minimumSampleSize` 以上

満たさない場合は `skipped_insufficient_telemetry` とし、対象数、mature数、成熟率、URL欠損数、期限超過数をレビュー Issue へコメントして閉じます。取得不能を0として実験評価へ混ぜません。

判定ゲートだけでは取得率は回復しないため、投稿成功に依存しない日次maintenance CLIとautomationを用意します。maintenanceは投稿を行わず、ログイン済みCDP sessionでfollower snapshotと過去投稿metricsを取得し、GitHub上のactivation / stale状態も照合します。20時間〜8日の成熟窓にある未取得投稿を**古い順**に処理し、1回の上限に達しても期限切れしそうな投稿を優先します。

## 4. GitHub オブジェクト仕様

### 4.1 週次レビュー Issue

タイトルは現行どおり次の形式とします。

```text
[X週次レビュー] YYYY-Www @account
```

同一週・同一 account の Issue は1件だけ作ります。再実行時は open / closed を問わず新規作成せず、同じ Issue へ最新結果をコメントします。自動選択するレビューは「現在の ISO 週・対象 account・正確な title prefix」に一致するものだけとし、単に更新日時が新しい過去 Issue は選びません。

Issue には `x-growth-review` label を付けます。改善候補がない場合、または進行中実験により新規実験を見送る場合は、理由をコメントしてその実行内で Issue を閉じます。

改善 PR を作成した場合は open のまま維持し、PR 本文に `Closes #<issue-number>` を入れます。PR が `main` へマージされた時点で GitHub により自動で閉じます。

PR が未マージのまま abandoned になった場合、改善 CLI が理由をコメントしてレビュー Issue も閉じます。

proposal が安全検証で棄却された場合は理由をコメントして Issue を閉じます。GitHub 障害、認証失敗、cleanup 失敗など人間の確認が必要な場合は `x-growth:needs-attention` label を付けて open のまま残します。週次処理は新しい Issue を作る前に過去の open review Issue を照合し、PR の有無と最終エラーを追記します。PR がないまま14日を超えた Issue は、未解決理由をコメントして閉じます。

### 4.2 改善 PR

PR は必ずドラフトで作成し、自動マージしません。

- base: `main` を明示
- head: 自動作成 branch を明示
- label: `x-growth-experiment`
- title: `[X改善実験] <仮説>`
- 変更: 1 PR = 1実験 = 1ファイル = 1回一致する find/replace
- 自動 merge: 禁止
- 自動 revert: 禁止
- docs-only 変更: 実験対象外

変更対象は、マージ後に production へ反映され、投稿挙動または投稿文を実際に変えられる allowlist path に限定します。運用文書だけの変更は効果測定できないため、`docs/**` を改善実験 allowlist から外します。schedule 変更は Codex automation が正本であり、本自動化では変更しません。

PR 本文は最低限、次を含めます。

```markdown
## 仮説

<hypothesis>

## 変更内容

- ファイル: `<path>`
- 種別: <kind>

## 評価条件

- 指標: <metric name と filters の説明>
- 計測期間: <windowDays>日
- 評価予定週: <Node が算出した YYYY-Www>
- 対象アカウント: @<account>

## 根拠

<rationale>

Closes #<review-issue-number>

<!-- x-growth-experiment:v1 {"reviewIssue":123,"account":"nazomaticapp","targetKey":"trend-joke:question-copy","plannedEvaluateWeek":"2026-W31","metric":{"name":"reply_post_rate","filters":{"postType":"trend_joke","archetype":"question"},"minimumSampleSize":5,"maturityHours":24,"windowDays":14,"direction":"increase"},"baseSha":"...","proposalBaseline":{"start":"...","end":"...","value":0.2,"sampleSize":8,"telemetryMaturityRate":0.75}} -->
```

HTML comment の JSON は機械処理用です。schema version を必須にし、未知 version は fail closed で処理を止めます。人間向け Markdown と矛盾した場合は JSON を自動処理の入力、GitHub 上の最新コメントと label を人間判断の正本とします。

### 4.3 branch

branch 名は再実行で増殖しない決定的な形式にします。

```text
x-growth/issue-<issue-number>-<evaluate-week>-<file-slug>
```

例:

```text
x-growth/issue-123-2026-w31-trend-joke-post-ts
```

GitHub Issue number は repository 内で一意であり、レビュー Issue 自体が account を固定するため branch 名に account は重ねません。PR metadata の account と review Issue title の account が一致しない場合は作成を拒否します。

同名 remote branch がすでに存在する場合は上書きしません。対応する PR を検索し、存在すればその PR を返して冪等終了します。対応 PR が存在しない remote branch は自動削除せず、`orphan_remote_branch` として停止し、人間へ報告します。

repository の `delete_branch_on_merge` を有効にします。未マージ close の branch は、PR head repository、prefix、対象 SHA を照合した後に改善 CLI が削除します。

### 4.4 評価指標 schema

`metric` を自由文にしません。LLM は許可された指標と filter を選ぶだけとし、Node が schema、対象データ、baseline を検証します。

```json
{
  "name": "reply_post_rate",
  "filters": {
    "postType": "trend_joke",
    "archetype": "question"
  },
  "minimumSampleSize": 5,
  "maturityHours": 24,
  "windowDays": 14,
  "direction": "increase"
}
```

初期に許可する `name` は、現行台帳から決定論的に計算できる次の値に限定します。

| name | 定義 |
|---|---|
| `median_views` | 成熟済み対象投稿の表示数中央値 |
| `median_engagement` | 返信 + repost + like の投稿別合計の中央値 |
| `reply_post_rate` | 返信が1件以上ある成熟済み投稿数 / 対象投稿数 |

filter は、台帳 entry を正規化した評価用 view の次の項目だけを許可します。

| filter | 取得元 |
|---|---|
| `postType` | entry直下の `postType` |
| `archetype` | `metadata.archetype` |
| `hasMedia` | `metadata.hasMedia` の boolean |
| `shape` | `metadata.shape` |
| `topicKey` | `metadata.topicKey` |
| `jstHourBucket` | entry直下の `postedAt` から `reportMetrics.mjs` と同じ規則で導出 |

`mediaMode` は実在しないため使用しません。`jstHourBucket` は保存済み metadata ではなく派生値として扱います。未知の指標、filter、値は拒否します。

filter対象フィールドが欠落している投稿は、`false`、空文字、`"値なし"` と同一視しません。欠落値を `missing` として別集計し、指定 filter の分母・分子から除外します。baseline窓で filter値を持つ成熟済み投稿が `minimumSampleSize` を満たさない場合はproposalを棄却します。特に `archetype` は導入前の履歴を推測補完せず、実データが蓄積するまで使用できません。

`minimumSampleSize` は下限5、`maturityHours` は下限24、`windowDays` は7日または14日だけを許可します。指標の増減方向は `direction` で明示します。7日でminimum sample sizeを満たさない場合は14日を選び、14日でも満たさない proposal は PR にせず棄却します。

PR作成時に Node が算出する `proposalBaseline` は、proposalの実行可能性を検証するための暫定値です。レビューやdeployment待ちで古くなる可能性があるため、最終評価のbaselineには使いません。production反映確認時に、`activeAt - maturityHours` を終端とする直前 `windowDays`、同じmetric / filtersで `evaluationBaseline` を再計算し、activationコメントへ固定します。成熟待ち時間を空けることで、実験開始直前の未成熟投稿を誤って0扱いしません。この再計算でもsample sizeとテレメトリ成熟率のゲートを適用します。

production反映後にbaselineゲートを満たさない場合、変更自体はすでに利用者へ出ているため「未開始」とはみなしません。deployment時刻を記録したうえで `activation_blocked_insufficient_telemetry` と `x-growth:needs-attention` を付け、新規実験を停止します。日次maintenanceは成熟窓内のmetrics回収を最大7日間試み、回復すれば `evaluationBaseline` を確定します。回復しなければ自動で勝敗を決めず、人間がkeep / revertを判断します。

LLM が `evaluateWeek` を決める現行仕様は廃止します。Node が作成時点と `windowDays` から `plannedEvaluateWeek` を算出し、production 反映時に `activeAt` から `effectiveEvaluateWeek` を再計算します。

### 4.5 allowlist の拡張と反復防止

allowlist の追加は自動化せず、人間が通常のコードレビューを通して行います。新しい path / `targetKey` は次をすべて満たす場合だけ追加できます。

- production反映境界とactivation確認方法が明確
- 投稿挙動へ単独で観測可能な影響を与える
- 既存の構造化metric / filtersで効果を評価できる
- 1ファイル・1変更でrevertできる
- rate limit、認証、実行許可、外部呼び出し、安全validatorを変更しない
- path固有のvalidationとテストがある
- dry-runと人間作成のtest PRで安全性を確認済み

proposalにはallowlistが定義する安定した `targetKey` を必須とします。直近10件の `x-growth-experiment` PRを検索し、同じ `targetKey` の再提案、過去の `find` / `replace` を逆転させる提案、同一patch fingerprintを棄却します。例外的な再試行は人間が理由を確認した `--allow-repeat-target` に限定し、automationからは使用しません。

既存のts-copy安全装置は不変条件として維持します。

- `FORBIDDEN_CHANGE_TOKENS` によるvalidator、rate limit、`--execute`、認証、環境変数、外部呼び出し、動的コード実行などの変更拒否
- replaceへ `;`、`{`、`}`、backtick、`=>` を導入させない構造注入ガード
- allowlist / deny path / kindの多重検証

metric schemaの追加やリファクタで、これらの既存ガードを弱めたり置き換えたりしません。

## 5. 実験ライフサイクル

独自 status ファイルは作らず、次のルールで状態を導出します。

| GitHub の状態 | 導出する実験状態 | 次の処理 |
|---|---|---|
| draft PR が open | `proposed` | 人間レビュー待ち |
| PR が ready だが open | `approved_pending_merge` | 人間の merge 待ち |
| PR が未マージで closed | `abandoned` | Issue と branch を終了処理 |
| PR が merged、production 反映未確認 | `activation_pending` | deployment確認待ち |
| production 反映済み、baseline健全性不足 | `activation_blocked_insufficient_telemetry` | maintenanceで回復待ち |
| production 反映済み、評価週より前 | `active` | 計測を継続 |
| production 反映済み、評価予定週に到達して結果なし | `evaluation_due` | 週次レビューで評価 |
| `x-growth:keep` label | `kept` | 実験終了 |
| `x-growth:revert` label | `revert_requested` | 人間が revert PR を作成・確認 |
| `x-growth:reverted` label | `reverted` | 実験終了 |

評価対象条件は `effectiveEvaluateWeek <= currentWeek` とし、完全一致にはしません。これにより automation が評価週に失敗しても翌週に回収できます。

PR merge だけでは実験開始とみなしません。production deployment の成功を GitHub deployment / commit status から確認し、確認できた時刻を `activeAt` とします。

productionへ反映されたcommitは、merge SHAそのもの、またはmerge SHAを祖先に持つ子孫commitを許可します。後続pushによりmerge SHA単体のdeploymentがskip / cancelされても、子孫commitのproduction deploymentが成功し、かつ対象ファイルに実験patchが残っていることを確認できればactivation成立とします。祖先関係だけでは後続commitによるrevertを検出できないため、deployment commitの対象ファイルでproposalの `replace` が期待回数存在し、元の `find` が復活していないことも検証します。対象ファイル全体の完全一致は、無関係な後続変更を誤って拒否するため要求しません。

利用可能なdeployment statusがない、祖先関係を確認できない、またはpatchがproduction treeに残っていない場合は、人間が明示確認するまで `activation_pending` のままにします。現行allowlistの `trend-joke-post.ts` はtrend joke prepare route、`comment-patterns.json` は通常投稿candidate prepare routeから、いずれも設定済みAPI baseのNext.js本番を経由して読まれます。allowlist追加時は同じ確認を必須にします。

production反映とbaseline健全性の両方を確認したら、PRへ次の一意markerを含むコメントを付け、`x-growth:active` labelを付けます。

```html
<!-- x-growth-activation:v1 {"pr":45,"mergeCommit":"...","deployedCommit":"...","activeAt":"...","effectiveEvaluateWeek":"2026-W31","evaluationBaseline":{"start":"...","end":"...","value":0.2,"sampleSize":8,"telemetryMaturityRate":0.8,"followersStart":22,"followersEnd":22,"totalPosts":18}} -->
```

baseline健全性を満たさない場合はactive markerを付けず、次のblock markerと `x-growth:needs-attention` を付けます。

```html
<!-- x-growth-activation-blocked:v1 {"pr":45,"deployedCommit":"...","deployedAt":"...","reason":"insufficient_telemetry","sampleSize":3,"telemetryMaturityRate":0.61} -->
```

実験指標の評価可能時刻は `activeAt + windowDays + maturityHours` 以降です。反映遅延により当初の `plannedEvaluateWeek` でこの時刻に達しない場合は、最初に評価可能となるISO週を `effectiveEvaluateWeek` としてactivationコメントに記録します。自動評価は PR 本文の予定週ではなく、有効なactivationコメントの `effectiveEvaluateWeek` を使います。

評価コメントには一意 marker を含め、同じ評価週の再実行で重複投稿しません。

```html
<!-- x-growth-evaluation:v1 pr=45 week=2026-W31 -->
```

指標が不足している場合は0とみなさず「取得不能 / データ不足」とコメントし、結果 label を付けません。次回レビューで再評価します。

本方式は同時A/Bではなく前後比較であり、因果効果を確定できません。評価コメントには必ず次の交絡情報を併記し、keep / revertは人間が判断します。

- baseline期間と実験期間のfollower数の開始値、終了値、増減（取得可能なsnapshotを使用）
- baseline期間と実験期間の総投稿数、metric / filters一致投稿数、曜日別投稿数
- 両期間のtelemetry成熟率、取得不能数、URL欠損数
- トレンドや外部要因を記入する人間向け注記欄

follower snapshotが期間境界と完全一致しない場合は、採用したsnapshot時刻と境界からの差を明記します。フォロワー数や投稿量が大きく異なる場合は自動で勝敗を断定せず、評価コメントへ `confounded` 注記を付けて人間判断を求めます。`confounded` 自体はkeep / revertを代替する終了状態ではありません。

### 5.1 滞留防止ポリシー

- open draft が7日経過: PR とレビュー Issue へリマインドコメント
- open draft が14日経過: PR を `abandoned` として自動 closeし、レビュー Issue も理由付きで close
- PR のない `x-growth:needs-attention` review Issue が14日経過: 未解決理由を残して close
- merge 後も production 反映を確認できない: `activation_pending` のまま新規実験を停止し、人間へ通知
- merged 後、評価予定週に達した未評価実験: 毎週レビュー対象に残す
- 評価結果の人間判断待ち: 新しい改善 PR を作らず、週次レビューで継続通知
- keep / revert の判断は自動化しない

自動 close の対象は未マージ draft だけです。merged 実験の採否を期限だけで自動決定しません。

## 6. worktree 実行仕様

### 6.1 ルートの分離

改善 CLI 内では次の値を別々に扱います。

| 値 | 用途 |
|---|---|
| `controlRoot` | automation が起動した通常リポジトリ。環境設定と local 計測データを読む |
| `worktreeRoot` | `origin/main` から作る一時 checkout。編集、検証、commit、push に使う |
| `temporaryRoot` | worktree と一時 schema を置く OS temporary directory |

`applyChangeToFile`、`verifyChangedFile`、Git command、Codex の `--cd` は必ず `worktreeRoot` を使います。投稿台帳、snapshot、history、ログは必ず `controlRoot` を使います。

Codex subprocess へ `.env.x-browser-posting.local` の内容を渡しません。提案に必要なレビュー本文、匿名化済み集計、allowlist だけを prompt として渡します。

### 6.2 作成手順

execute 時は次の順序を固定します。

1. `controlRoot` が期待する repository か確認する。
2. 排他 lock を取得する。
3. `gh auth status` と origin repository を確認する。
4. review Issue を取得し、number、URL、state、account、week を検証する。
5. 既存 PR と進行中実験を照合し、冪等性・1実験制約を確認する。
6. 直近14日のテレメトリ健全性を確認し、70%未満なら `skipped_insufficient_telemetry` で終了する。
7. `git fetch --prune origin main` を実行する。
8. OS temporary directory を作る。
9. `git worktree add --detach <worktreeRoot> origin/main` を実行する。
10. `npm ci` でworktree専用dependenciesを用意する。
11. 変更適用前のtsc / lint / JSON / 構文検証を実行し、`origin/main` のbaselineがgreenであることを確認する。失敗時は `base_broken` で終了する。
12. Codex を `--sandbox read-only --ephemeral --cd <worktreeRoot>` で呼ぶ。
13. Node 側でproposal、target履歴、metric/filter、baseline sampleを検証する。
14. `worktreeRoot` で決定的な実験branchを作り、単一変更を適用する。
15. 同じ検証を変更適用後に再実行する。失敗時は `proposal_broken` で終了する。
16. 対象ファイルだけをstageし、差分に対象外ファイルがないことを確認する。
17. commitする。
18. `git push --set-upstream origin <branch>` を明示実行する。
19. `gh pr create --draft --base main --head <branch>` を実行する。
20. `x-growth-experiment` labelを付ける。
21. PR URLを報告する。
22. `finally` でworktree、temporary directory、lockを解放する。

`npm ci` は時間がかかっても checkout 間の依存汚染を避けることを優先します。高速化が必要な場合は npm cache を共有しますが、`node_modules` 自体は通常リポジトリと共有しません。

### 6.3 排他制御

同じ repository に対する改善 execute は同時に1件だけ許可します。`controlRoot/local/x-browser-posting/locks/x-growth-improve.lock` を `fs.open(lockPath, "wx")` でatomicに作成して排他します。`existsSync` 確認後の通常writeはTOCTOUになるため禁止します。

lock には開始時刻、PID、hostname、review Issue numberを記録します。既存lockがある場合は通常skipとして扱わず、review Issueへ `x-growth:needs-attention` labelとlock情報を付け、明示的な失敗通知を出します。stale lockの削除は、同一hostnameでPID不在かつ規定時間を超過した場合だけ許可します。自動復旧した場合もログとIssueコメントに記録します。

dry-run はGitとGitHubを変更しないためexecute lockの対象外です。投稿台帳、snapshot、historyなどの運用stateは変更しませんが、監査用の実行ログは現行どおり `controlRoot/logs/x-growth-improve/` へ書き、保持世代数に従って整理します。

## 7. 冪等性

冪等性 key は次の組み合わせです。

```text
repository + review Issue number + account
```

改善 PR 作成前に、GitHub から `x-growth-experiment` label と機械可読 marker を使って全 state の PR を pagination して検索します。

- open PR が存在: 新規作成せず既存 URL を返す
- merged PR が存在: 完了済みとして新規作成しない
- closed・未マージ PR が存在: 明示的な `--retry-abandoned` がない限り再作成しない
- marker が壊れている: fail closed
- 同一 key の PR が複数存在: fail closedし、人間へ重複を報告

CLI、Codex automation、手動再実行のどこから起動しても同じ規則を適用します。

## 8. 失敗時の原子性と後始末

| 失敗地点 | 必須処理 |
|---|---|
| proposal / validation / verification | PR・remote branch を作らず終了 |
| commit 前 | worktree を削除して終了 |
| commit 後・push 前 | worktree と local branch を削除して終了 |
| push 後・PR 作成 command 未実行 | remote branch の所有権と SHA を照合して削除。削除不能なら branch 情報を報告 |
| `gh pr create` が timeout / 応答不明 | 下記の再検索手順を必ず完了してからbranch処理を決める |
| PR 作成後・label 設定失敗 | PR は削除できないため closeせず、`partial_success` として URL を必ず報告 |
| cleanup 失敗 | 主処理の成否と cleanup 失敗を両方報告 |

作成済み PR を例外処理で自動 closeしません。人間が確認できる URL を残し、次回実行は冪等性検索でその PR を再利用します。

`gh pr create` を起動した後のtimeout・接続切断・応答解析失敗では、次の順序を変更しません。

1. 冪等性key、head branch、機械可読markerでPRを再検索する。
2. PRが存在すれば `partial_success` としてURLを報告し、remote branchを残す。
3. PRが存在しないことを確認できた場合だけ、prefix、head SHA、repository所有権を照合してremote branchを削除する。
4. PRの存在確認自体が失敗した場合はbranchを削除せず、`x-growth:needs-attention` としてbranch情報を報告する。

「push後・PR作成前」のcleanupは、`gh pr create` をまだ起動していないことが確実な場合にだけ適用します。

## 9. 週次評価仕様

週次レビューは local の `experiment-ledger.json` を読みません。次の順に評価対象を取得します。

1. GitHub から `x-growth-experiment` label 付き PR を全 state で検索する。
2. PR 本文 marker を schema 検証する。
3. merged PR だけを選ぶ。
4. production 反映済みのactivationコメントを取得し、`effectiveEvaluateWeek <= currentWeek` を確認する。
5. keep / revert / reverted label 済みのものを除く。
6. local 投稿台帳から、`activeAt` 以降の対象投稿と成熟済み指標を集計する。
7. activationコメントに保存した同じmetric / filtersの `evaluationBaseline` と比較する。
8. 両期間のsample size、テレメトリ成熟率、取得不能件数、follower増減、総投稿数、曜日別投稿数を集計する。
9. 前後比較であり因果推論ではないことと、確認できる交絡を明記した評価コメントをPRへ投稿する。
10. 同一markerのコメントがあれば重複投稿しない。
11. 交絡の有無を示したうえで、人間へkeep / revertの判断を依頼する。

1アカウント1実験の制約があるため、投稿と実験の対応は `activeAt` から評価終了までの時間窓で導出します。投稿台帳へ実験 status を複製しません。必要な場合だけ、追跡補助情報として PR number を投稿 metadata に記録できますが、GitHub と矛盾した場合は GitHub を正とします。PR merge 前または production 反映前の投稿を実験結果へ混ぜません。

## 10. label と権限

事前に次の label を repository へ作成します。

| label | 用途 |
|---|---|
| `x-growth-review` | 週次レビュー Issue |
| `x-growth-experiment` | 改善実験 PR |
| `x-growth:active` | production 反映確認済み |
| `x-growth:keep` | 継続判断済み |
| `x-growth:revert` | revert 判断済み |
| `x-growth:reverted` | revert 完了 |
| `x-growth:needs-attention` | automation 失敗など人間の確認が必要 |

自動化に必要な GitHub 権限は、Issue の作成・コメント・close、branch push/delete、PR 作成・コメント・未マージ stale PR の close、label 付与に限定します。repository 設定変更や merge 権限は自動化へ与えません。

## 11. CLI 契約

### 11.1 dry-run

```bash
npm run x:growth-improve
```

- GitHub、Git、投稿台帳・snapshot・historyを変更しない
- review Issue、進行中実験、提案、対象ファイル、想定 branch 名を表示する
- PR 作成 command は表示しても実行しない
- 監査用ログは `logs/x-growth-improve/` へ書く

### 11.2 execute

```bash
npm run x:growth-improve -- --execute
```

- 起動した通常 repository を `controlRoot` とする
- review Issue を自動取得する
- 一時 worktree を内部作成する
- 成功時は Issue URL、PR URL、branch、base SHA、評価予定週を出力する

明示的な再現・障害対応用に次を許可します。

```bash
npm run x:growth-improve -- --execute --review-issue 123
npm run x:growth-improve -- --execute --review-issue 123 --retry-abandoned
```

`--retry-abandoned` は同一 Issue の未マージ closed PR がある場合だけ有効です。既存 PR と branch を確認し、人間が意図して再試行する場合に限定します。

未知引数、引数値欠落、closed review Issue の通常実行はエラー終了します。

## 12. Codex automation 契約

改善 automation は実装・手動検証完了後にだけ登録します。

- 実行: 毎週月曜12:00 JST
- 前提: 11:30 の週次レビューが成功し、当週 Issue が存在する
- command: `npm run x:growth-improve -- --execute`
- working directory: 通常の NAZOMATIC repository
- retry: 自動 retry なし
- timeout: `npm ci`、Codex、lint を含めて十分な上限を設定
- 通知: 成功時は Issue / PR URL、状態が変わったskipは理由、失敗時は段階・cleanup状態を報告

automation prompt は branch 操作を独自実装せず、CLI を1回だけ呼びます。worktree、lock、冪等性、cleanup はすべて CLI の責務です。

`skipped_active_experiment` など同じ理由・同じPR・同じ導出状態が続く場合、毎週ユーザー通知しません。CLIは `reason + PR number + derived state` のnotification fingerprintを作り、前回と同じならログだけを残します。状態変化、7日・14日の期限到達、`needs-attention`、失敗は必ず通知します。通知重複防止用のlocal cacheは派生情報であり、実験の正本として扱いません。

日次maintenance automationは次の契約で別登録します。

- 実行: 毎日10:30 JSTを初期値とする
- command: `npm run x:growth-maintain`
- 投稿: 一切行わない
- 対象: follower snapshot、20時間〜8日の未成熟投稿metrics、production activation、stale PR / Issue / lock
- 順序: 期限切れに近い古い投稿を優先
- retry: 自動retryなし。失敗は次回に持ち越すが、連続失敗は通知する
- ログ: `logs/x-growth-maintain/`

## 13. Firestore 移行条件

次のいずれかが必要になった場合だけ、投稿・計測データを Firestore へ移行します。

- 複数端末から投稿 automation を実行する
- local PC 障害後も時系列データを復旧したい
- Web 画面から運用指標を閲覧したい
- 複数 process が同時に同じ投稿台帳を更新する

移行する場合も、GitHub PR の実験状態を Firestore に複製しません。Firestore の投稿レコードには `experimentPrNumber`、`experimentMergedAt`、必要な experiment snapshot だけを持たせます。

## 14. 実装対象

主な変更対象は次のとおりです。

| ファイル | 変更 |
|---|---|
| `scripts/x-growth-improve.mjs` | review object 取得、進行中実験確認、worktree orchestration、lock、冪等性 |
| `scripts/x-growth/applyProposal.mjs` | current branch 操作を廃止し、明示 push / base / head / closing keyword を実装 |
| `scripts/x-weekly-growth-review.mjs` | local 実験台帳ではなく GitHub PR を評価、滞留処理、重複コメント防止 |
| `scripts/x-growth/experimentLedger.mjs` | 削除 |
| `scripts/x-growth/experimentAllowlist.mjs` | docs targetを削除し、targetKey、拡張条件、既存安全ガードを維持 |
| `scripts/x-growth/proposalSchema.mjs` | 自由文metricとLLM指定evaluateWeekを廃止し、targetKeyと構造化metric schemaを検証 |
| `scripts/x-growth/verifyChange.mjs` | worktreeRoot 専用であることを契約化 |
| `scripts/x-browser-posting/postLedger.mjs` | 原則変更なし。必要な場合のみ追跡補助の PR number を metadata として追加 |
| `scripts/x-growth-maintain.mjs` | 投稿非依存のfollower / metrics取得とGitHub lifecycle照合CLIを追加 |
| `scripts/x-growth/reportMetrics.mjs` | 正規化filter、成熟率、baseline / experiment比較、交絡情報を集計 |
| `scripts/x-browser-posting/runLog.mjs` | controlRoot へログを残す契約を明示 |
| `package.json` | `x:growth-maintain` scriptを追加。改善proposalの編集allowlistには含めない |
| `docs/system-design/subsystems/x-growth-improve-agent.md` | 実装完了後に現行仕様へ同期 |
| `docs/system-design/operations/x-browser-post-schedules.md` | automation 登録後に状態を同期 |
| `docs/development-guide.md` | 新 CLI 引数、復旧手順、label setup を追記 |

## 15. 検証項目

### 15.1 自動テスト相当の harness

- worktree が `origin/main` の SHA から作られる
- 通常 checkout の branch、HEAD、tracked / untracked file が変化しない
- worktree に local state がなくても `controlRoot` の投稿台帳を読める
- 同じ review Issue を2回実行しても PR は1件だけ
- 進行中実験がある場合、新規 PR を作らない
- テレメトリ成熟率70%未満で `skipped_insufficient_telemetry` になり、対象数と欠損内訳がIssueへ出る
- 日次maintenanceが投稿せず、期限切れに近い投稿からmetricsを取得する
- PR 本文に `Closes #N` と valid marker が入る
- docs-only proposal が実験として拒否される
- 未知 metric / filter と baseline sample不足が拒否される
- filterのmissing、false、空文字が混同されない
- `plannedEvaluateWeek` と baseline が Node 側で算出される
- 同じ `targetKey`、逆向きpatch、同一fingerprintの反復提案が拒否される
- 既存の禁止tokenと構造注入guardがmetric schema変更後も維持される
- `--base main`、`--head`、明示 push が使われる
- 変更前verify失敗が `base_broken`、変更後だけの失敗が `proposal_broken` になる
- verification 失敗時に remote branch と PR が作られない
- PR 作成失敗時に remote branch が安全に片付く
- `gh pr create` timeout時にPRを再検索し、存在するPRのbranchを削除しない
- cleanup 失敗が成功扱いで隠れない
- `effectiveEvaluateWeek` を過ぎた実験も評価対象になる
- production 反映前の投稿を評価対象に含めない
- merge SHAを祖先に持つproduction deploymentで、patch残存時だけactivationできる
- 子孫deploymentでpatchがrevert済みの場合はactivationしない
- production 反映遅延時に `effectiveEvaluateWeek` が繰り下がる
- activation時に直前窓の `evaluationBaseline` が再計算される
- 評価コメントにfollower増減、総投稿数、曜日構成、テレメトリ成熟率が出る
- 同じ評価週のコメントを重複投稿しない
- 未マージ close を `abandoned` として扱う
- `fs.open("wx")` で並行lock取得が1件だけ成功する
- stale lockから規定条件で復旧し、lock停止と復旧が `needs-attention` 通知になる
- 同一skip fingerprintは通知を抑制し、状態変化と失敗は通知する
- local experiment ledger がなくても週次レビューが動く

### 15.2 手動検証

1. test用 Issue からdry-runする。
2. test用 Issue からドラフトPRを作る。
3. 通常 checkout が変化していないことを確認する。
4. 同じ Issue でもう一度executeし、既存PR URLで終了することを確認する。
5. PRを未マージcloseし、Issueとbranchの終了処理を確認する。
6. 別のtest用PRを `main` へmergeし、Issueが自動closeされることを確認する。
7. merge SHAの子孫commitがproductionへ出た場合にactivationできることを確認する。
8. 評価予定週を過去にしたPRへ、交絡情報を含む評価コメントが1回だけ付くことを確認する。
9. keepまたはrevertを人間が判断し、最初の実験を終了状態まで通す。

## 16. 完了条件

次をすべて満たした時点で本仕様の実装完了とします。

- 通常 checkout を変更せず、`origin/main` 起点の一時 worktree で PR を作れる。
- Git 管理外の投稿・フォロワー・ログを `controlRoot` から正しく参照できる。
- review Issue と PR が必ずリンクされ、merge で Issue が閉じる。
- production 反映確認前は実験を開始扱いにしない。
- merge SHAの子孫commitがproductionへ出る場合も、patch残存確認付きでactivationできる。
- 同一 Issue の再実行で PR と branch が増えない。
- 1アカウントにつき進行中実験が1件に制限される。
- テレメトリ成熟率ゲートと投稿非依存のmetrics取得が動作する。
- abandoned PR、stale draft、remote branch の終了契約が動作する。
- stale lockとPR作成応答不明から安全に復旧できる。
- `experiment-ledger.json` とその同期処理が削除される。
- 評価週を逃しても次回レビューで評価される。
- 評価コメントに前後比較の限界とfollower・投稿量・曜日・取得率の交絡情報が表示される。
- 既存のts-copy禁止token・構造注入guardが維持される。
- keep / revert は人間判断のまま維持される。
- automation 登録前に dry-run、失敗系、実PRの手動検証が完了している。
- 1件目の実験がproposal、PR、merge、production activation、評価コメント、keep / revert判断まで通しで完走している。

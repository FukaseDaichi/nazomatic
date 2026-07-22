# 既知の懸念点

この文書は、現行コードから確認できるリスクと保守上の弱点をまとめます。将来計画や作業履歴ではありません。

## 優先度: 高

### BLANK25 Editor は同時更新を上書きできる

`src/server/blank25/github.ts` は storage branch ref を `force: true` で更新し、base commit の競合を検出しません。複数 Editor が同時に publish すると、後の更新が先の manifest 変更を失わせる可能性があります。更新・削除で不要になった画像も自動削除されないため、orphan file が増えます。

### 自動 test がない

`package.json` に test script と test framework がありません。timezone 計算、Yahoo response parsing、Firestore transaction、manifest 編集、X 文案 validator、生成 scripts の回帰を lint と手動確認だけで担保しています。外部仕様依存の多いサブシステムほど、変更検知が遅れる可能性があります。

### X ブラウザ投稿は UI と利用ポリシーに依存する

X の DOM、label、blocking 画面が変わると、Playwright / CDP 操作が停止または誤動作する可能性があります。headless Chrome は通常 Chrome と user agent や表示挙動が異なります。非 API の Web 操作には account 制限リスクもあり、コード上の safety guard だけでは解消できません。

## 優先度: 中

### X 投稿の日次上限が local と server で一致しない

`scripts/x-browser-posting/config.mjs` の `MAX_DAILY_LIMIT` は 30、`src/server/x-browser-posting/candidate.ts` の `MAX_BROWSER_POST_DAILY_LIMIT` は 50 です。通常 CLI は 30 で先に拒否しますが、API を直接呼ぶと 50 まで許可されます。どちらがシステム上の上限かが二重化しています。

### Calendar URL が設定値ではなく固定値

`src/server/x-browser-posting/weekend-ticket-summary.ts` は `https://nazomatic.vercel.app/calendar` を固定しています。`NEXT_PUBLIC_BASE_URL` を staging や別 host に変えても、週末サマリだけ production URL を投稿します。

### X Repost workflow が API 失敗を成功終了にする

`.github/workflows/x-repost-events.yml` は 2xx 以外でも最後に `exit 0` します。意図した alert 抑制ではあるものの、credential error、server error、X API 仕様変更が GitHub Actions の失敗として見えません。

### Yahoo / X 非公式 response 形式への依存

Yahoo!リアルタイム検索と X syndication endpoint は外部 response の構造に依存します。schema 契約や fixture test がなく、形式変更が収集停止・parse error・可視性 `unknown` の増加として現れます。

### X 週次改善エージェントの PR 作成と復旧が不完全

`createExperimentPr()` はローカル branch の作成、対象ファイルの commit、`gh pr create --draft` を順に行いますが、明示的な `git push` と clean worktree の事前確認がありません。環境によっては PR 作成に失敗し、作業 branch と commit だけが残る可能性があります。また、同じ対象ファイルに既存の未 commit 変更がある場合、その変更を実験 commit に含める余地があります。

### 週次改善エージェントが Issue の最新コメントを読まない

週次レビューは同じ週の再実行結果を既存 Issue のコメントへ追記します。一方、`x-growth-improve` は最新更新 Issue の `body` だけを読み、コメントを取得しません。再レビュー後も、改善提案が初回 Issue 本文を入力にする可能性があります。

## 優先度: 低

### Calendar API は 500 件で無通知に切る

`GET /api/calendar` は `.limit(500)` で pagination と truncated flag を持ちません。指定期間・query に 500 件を超える event があると、利用者は欠落を識別できません。

### Shift Search の external report が未解決

現行 `src/generated/shift-search/view-manifest.json` では external 4 件すべてが `unresolvedExternal` です。詳細 page は raw GitHub Markdown の取得導線を出せますが、アプリ内閲覧または専用外部配信 URL はありません。

### Next.js 関連 package version が揃っていない

`next` は `^14.2.35`、`eslint-config-next` は `14.0.3` です。直ちに不具合とは限りませんが、lint rule と framework behavior の世代差が残ります。

### 未使用の可能性がある依存がある

`package.json` には、現行 `src/` / `scripts/` から import を確認できない UI・utility package があります。bundle へ必ず含まれるとは限りませんが、install surface と更新対象を増やします。

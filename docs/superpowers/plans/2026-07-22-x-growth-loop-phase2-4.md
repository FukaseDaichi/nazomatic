# X フォロワー成長ループ Phase 2〜4 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** X 運用を「計測できる状態（Phase 1 完了）」から、「型・時間帯・実験別に効果を比較でき、週1で改善実験の PR が自動生成され、勝敗が蓄積されるループ」へ進める。

**Architecture:** 3 つの独立して出荷可能なフェーズに分ける。Phase 2 は既存の週次レビュー（`scripts/x-weekly-growth-review.mjs`）に帰属分析（次元別中央値）と UTM を足すだけの純追加。Phase 3 は新規のローカル automation（`scripts/x-growth-improve.mjs`）を1枠追加し、`codex exec` に read-only で「実験提案 JSON」を作らせ、決定論的な Node ラッパが allowlist 検証・ブランチ作成・PR 作成を行う（LLM に破壊的権限を渡さない）。Phase 4 は実験台帳（`local/x-browser-posting/experiment-ledger.json`）を導入し、翌週レビューが前週実験の勝敗を検証してレポートに残す。

**Tech Stack:** Node.js ESM スクリプト（`.mjs`、依存追加なし）、`codex exec`（read-only, `--output-schema`）、`gh` CLI（Issue / PR）、既存の `post-ledger.json` / `follower-snapshots.json`。

## Global Constraints

- ドキュメントは日本語、`AGENTS.md` は英語（`docs/` 配下は日本語）。
- テストフレームワークは未導入。各タスクの検証は「`node --check <file>`」「scratchpad の focused ロジックハーネス（`node <harness>.mjs`）」「`npm run lint`」「`--dry-run` / `--print-*` の手動実行」で行う。pytest 等は使わない。
- 新規依存パッケージ・新規ストレージ location・新規カラーシステムを、明確な必要なしに追加しない（`AGENTS.md`）。
- `config.mjs` の rate limit（`MAX_DAILY_LIMIT=30`、`MIN_COOLDOWN_MINUTES=3`、`MAX_PER_RUN=1`）と `--execute` 系のガードは、自動改善ループの編集対象に**含めない**。
- 「週1実験・同時に変える主要要素は1つまで」を厳守（`docs/system-design/operations/x-browser-post-schedules.md` に既述）。
- 自動投稿はローカル（Codex automation）実行。ledger・ログはローカルのみ。データを外部へ送らない。
- X の automation ポリシー上、投稿頻度を上げる方向（1日3回→5回等）の実験は原則しない。質・時間帯・型の実験を優先する。
- 破壊的・外部影響のある操作（PR 作成、Issue 作成、投稿）は既存の確認境界を維持。自動マージはしない。

---

## Phase 2 — 帰属分析の強化

**Goal:** 週次レビューを「件数の集計」から「型別・時間帯別・実験別の中央値表示数/エンゲージメント比較」に強化し、tool_intro URL に UTM を付けてサイト流入計測の土台を作る。

**Scope:** `scripts/x-weekly-growth-review.mjs` への純追加と、`src/server/x-browser-posting/trend-joke-post.ts` の URL 生成1箇所。既存の出力は壊さず、セクションを追加する。

### File Structure

- Create: `scripts/x-growth/reportMetrics.mjs` — 集計ヘルパ（`median`/`sumEngagement`/`summarizeByDimension`/`jstHourBucket`）を独立モジュール化。
- Modify: `scripts/x-weekly-growth-review.mjs` — 上記モジュールを import し、既存の `median` をモジュール版へ差し替え、`buildReport` に次元別サマリ生成を追加。
- Modify: `src/server/x-browser-posting/trend-joke-post.ts:919` — `pickTool()` の URL に UTM を付与。
- Modify: `docs/system-design/subsystems/x-posting.md`、`docs/system-design/operations/x-browser-post-schedules.md` — レポート項目と UTM を反映。
- Test(harness): `scratchpad/phase2-report.mjs` — 集計ロジック検証。

**設計上の注意（重要）:** `scripts/x-weekly-growth-review.mjs` は import 時にトップレベルで `await main()` を実行するエントリスクリプトなので、ハーネスからそこへ import すると `main()`（ネットワーク/gh 呼び出し）が走ってしまう。したがって集計ヘルパは**別モジュール `scripts/x-growth/reportMetrics.mjs`** に置き、ハーネスとメインスクリプトの双方がそこから import する。

### Task 2.1: 次元別サマリ集計ヘルパ（独立モジュール）

**Files:**
- Create: `scripts/x-growth/reportMetrics.mjs`
- Test: `scratchpad/phase2-report.mjs`

**Interfaces:**
- Consumes: `postMetrics`（要素 `{ post, views, replies, reposts, likes }`。`post` は ledger エントリ）。
- Produces（すべて `scripts/x-growth/reportMetrics.mjs` から export）:
  - `median(values) -> number | null`（既存 growth-review の実装と同一挙動）
  - `sumEngagement(entry) -> number | null`（replies/reposts/likes の合計。全て null なら null）
  - `summarizeByDimension(postMetrics, getKey) -> Array<{ key, count, medianViews, medianEngagement }>`（medianViews 降順）
  - `jstHourBucket(isoString) -> string`（例 `"09時台"`）

- [ ] **Step 1: ロジックハーネスを書く（失敗する状態）**

`scratchpad/phase2-report.mjs`:
```js
import { summarizeByDimension, sumEngagement, jstHourBucket, median } from "/Users/fukasedaichi/git/nazomatic/scripts/x-growth/reportMetrics.mjs";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
A(median([1, 2, 3]) === 2, "median odd");
A(median([]) === null, "median empty -> null");
const pm = [
  { post: { metadata: { archetype: "monologue" }, postedAt: "2026-07-20T00:30:00Z" }, views: 100, replies: 1, reposts: 0, likes: 2 },
  { post: { metadata: { archetype: "monologue" }, postedAt: "2026-07-20T06:30:00Z" }, views: 300, replies: null, reposts: null, likes: null },
  { post: { metadata: { archetype: "poll" }, postedAt: "2026-07-20T12:30:00Z" }, views: 50, replies: 5, reposts: 1, likes: 1 },
];
A(sumEngagement(pm[0]) === 3, "sumEngagement");
A(sumEngagement(pm[1]) === null, "sumEngagement all-null -> null");
const byType = summarizeByDimension(pm, (p) => p.metadata?.archetype);
A(byType[0].key === "monologue" && byType[0].medianViews === 200, "median views by type " + JSON.stringify(byType[0]));
A(jstHourBucket("2026-07-20T00:30:00Z") === "09時台", "jst hour bucket " + jstHourBucket("2026-07-20T00:30:00Z"));
console.log("done");
```
モジュール未作成なので失敗する。

- [ ] **Step 2: 失敗を確認**

Run: `node scratchpad/phase2-report.mjs`
Expected: FAIL（`Cannot find module .../reportMetrics.mjs`）

- [ ] **Step 3: モジュールを実装**

`scripts/x-growth/reportMetrics.mjs`（新規）:
```js
// 週次レビューの集計ヘルパ。エントリスクリプトが import 時に main() を走らせるため、
// テスト可能な純関数はこの独立モジュールに置く。

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function sumEngagement(entry) {
  if (entry.replies == null && entry.reposts == null && entry.likes == null) {
    return null;
  }
  return (entry.replies ?? 0) + (entry.reposts ?? 0) + (entry.likes ?? 0);
}

export function summarizeByDimension(postMetrics, getKey) {
  const groups = {};
  for (const entry of postMetrics) {
    const key = getKey(entry.post);
    if (key == null || key === "") {
      continue;
    }
    (groups[key] ??= []).push(entry);
  }
  return Object.entries(groups)
    .map(([key, items]) => {
      const views = items.map((i) => i.views).filter((v) => v != null);
      const engagements = items
        .map((i) => sumEngagement(i))
        .filter((v) => v != null);
      return {
        key,
        count: items.length,
        medianViews: median(views),
        medianEngagement: median(engagements),
      };
    })
    .sort((a, b) => (b.medianViews ?? -1) - (a.medianViews ?? -1));
}

export function jstHourBucket(isoString) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
  return `${String(Number(hour)).padStart(2, "0")}時台`;
}
```

- [ ] **Step 4: メインスクリプトを新モジュールへ寄せる**

`scripts/x-weekly-growth-review.mjs` の import 群に追加:
```js
import {
  jstHourBucket,
  median,
  sumEngagement,
  summarizeByDimension,
} from "./x-growth/reportMetrics.mjs";
```
そして既存のローカル `function median(values) { ... }` 定義を削除する（モジュール版と同一挙動なので参照はそのまま動く）。

- [ ] **Step 5: 成功を確認**

Run: `node scratchpad/phase2-report.mjs`
Expected: 全行 `ok:`、末尾 `done`

- [ ] **Step 6: lint + syntax**

Run: `node --check scripts/x-growth/reportMetrics.mjs && node --check scripts/x-weekly-growth-review.mjs && npm run lint`
Expected: `No ESLint warnings or errors`

- [ ] **Step 7: Commit**

```bash
git add scripts/x-growth/reportMetrics.mjs scripts/x-weekly-growth-review.mjs
git commit -m "feat(x-growth): extract report metric helpers into a testable module"
```

### Task 2.2: レポートに次元別比較セクションを追加

**Files:**
- Modify: `scripts/x-weekly-growth-review.mjs`（`buildReport` の body 配列）

**Interfaces:**
- Consumes: `summarizeByDimension`, `jstHourBucket`（Task 2.1 で `scripts/x-growth/reportMetrics.mjs` から import 済み）、`postMetrics`、既存 `formatMetric`。
- Produces: レポート本文に「## 型別・時間帯別・実験別の比較」セクション。

- [ ] **Step 1: 集計を buildReport 内で組み立てる**

`buildReport` の `const recommendations = buildRecommendations({...})` の直前に追加:
```js
  const byArchetype = summarizeByDimension(
    postMetrics,
    (post) => post.metadata?.archetype ?? post.postType ?? null
  );
  const byHour = summarizeByDimension(postMetrics, (post) =>
    post.postedAt ? jstHourBucket(post.postedAt) : null
  );
  const byMedia = summarizeByDimension(postMetrics, (post) =>
    post.postType === "trend_joke"
      ? post.metadata?.hasMedia
        ? "画像あり"
        : post.metadata?.pollOptions?.length
          ? "投票"
          : "テキストのみ"
      : null
  );
```

- [ ] **Step 2: 表フォーマッタを追加（buildReport の外、`formatMetric` の近く）**

```js
function formatDimensionTable(rows) {
  if (!rows.length) {
    return ["（数値を取得できた投稿がなく比較不能）"];
  }
  return [
    "| 区分 | 件数 | 表示数中央値 | 反応中央値 |",
    "|---|---:|---:|---:|",
    ...rows.map(
      (r) =>
        `| ${r.key} | ${r.count} | ${formatMetric(r.medianViews)} | ${formatMetric(
          r.medianEngagement
        )} |`
    ),
  ];
}
```

- [ ] **Step 3: body にセクションを差し込む**

`buildReport` の body 配列、`"## 次週の改善候補",` の直前に追加:
```js
    "## 型別・時間帯別・実験別の比較",
    "",
    "### 型別",
    "",
    ...formatDimensionTable(byArchetype),
    "",
    "### 時間帯別（JST）",
    "",
    ...formatDimensionTable(byHour),
    "",
    "### 添付実験別（トレンド投稿）",
    "",
    ...formatDimensionTable(byMedia),
    "",
```

- [ ] **Step 4: 実データで dry-run（Issue 作成なし）**

Run: `npm run x:growth-review`
Expected: 標準出力の Markdown に「型別・時間帯別・実験別の比較」セクションと表が出る（数値が無ければ「比較不能」行）。エラー終了しない。

- [ ] **Step 5: lint**

Run: `npm run lint`
Expected: `No ESLint warnings or errors`

- [ ] **Step 6: Commit**

```bash
git add scripts/x-weekly-growth-review.mjs
git commit -m "feat(x-growth): add dimension comparison section to weekly review"
```

### Task 2.3: tool_intro URL に UTM を付与

**Files:**
- Modify: `src/server/x-browser-posting/trend-joke-post.ts:919`

**Interfaces:**
- Consumes: 既存 `PUBLIC_BASE_URL`, `feature.path`。
- Produces: `tool.url` が UTM 付き（`allowedToolUrl`・fallback 候補・ledger metadata すべてが同じ URL を共有するため整合は自動維持）。

- [ ] **Step 1: UTM 定数と付与を実装**

`pickTool()` の `url:` 行を置き換え:
```ts
    url: `${PUBLIC_BASE_URL}${feature.path}?utm_source=x&utm_medium=social&utm_campaign=trend_joke_tool_intro`,
```
（定数化する場合は `PUBLIC_BASE_URL` の近くに `const TOOL_INTRO_UTM = "utm_source=x&utm_medium=social&utm_campaign=trend_joke_tool_intro";` を置き、`?${TOOL_INTRO_UTM}` を付ける。`feature.path` にクエリが無い前提が既存仕様。）

- [ ] **Step 2: X 重み付け280超にならないか確認**

`trend-joke-post.ts` の X 文字数重み付け（URL を 23 として数えるか実長で数えるか）を確認する。Run: `grep -n "280\|23\|weighted\|t\\.co\|urlLength\|countUrl" src/server/x-browser-posting/trend-joke-post.ts`
- URL を 23 固定で数えているなら UTM 追加は文字数に影響しない → そのまま。
- 実長で数えているなら、tool_intro の validator が 280 超で弾く恐れ。その場合は本文テンプレートを短縮するタスクを追加するか、UTM を `utm_campaign` のみに切り詰める。

- [ ] **Step 3: tool_intro を固定して dry-run**

Run: `npm run x:browser-post:trend-joke -- --archetype tool_intro --print-prompt`
Expected: 生成される composed text 内の URL が UTM 付き。validator エラーが出ない（dry-run で入力・検証まで到達）。

- [ ] **Step 4: lint**

Run: `npm run lint`
Expected: `No ESLint warnings or errors`

- [ ] **Step 5: Commit**

```bash
git add src/server/x-browser-posting/trend-joke-post.ts
git commit -m "feat(x-growth): tag tool_intro URLs with UTM for inflow attribution"
```

### Task 2.4: ドキュメント反映

**Files:**
- Modify: `docs/system-design/subsystems/x-posting.md`（週次レビュー節に次元別比較を追記）
- Modify: `docs/system-design/operations/x-browser-post-schedules.md`（週次改善レビュー節に次元別比較を追記）

- [ ] **Step 1: x-posting.md に追記**

「週次改善レビュー」節へ1文追加:
```
レポートは件数集計に加えて、投稿型・JST 時間帯・添付実験（画像/投票/テキスト）ごとの表示数中央値と反応中央値を表で比較します。tool_intro の URL には UTM（`utm_campaign=trend_joke_tool_intro`）を付け、投稿からサイト流入を後から突き合わせられるようにします。
```

- [ ] **Step 2: x-browser-post-schedules.md に追記**

「週次改善レビュー」節の集計項目リストへ追加:
```
- 投稿型・JST 時間帯・添付実験別の表示数中央値と反応中央値
```

- [ ] **Step 3: Commit**

```bash
git add docs/system-design/subsystems/x-posting.md docs/system-design/operations/x-browser-post-schedules.md
git commit -m "docs(x-growth): document dimension comparison and UTM in weekly review"
```

**Phase 2 完了条件:** `npm run x:growth-review` の Markdown に3つの次元別比較表が出る。tool_intro 投稿の URL が UTM 付きになる。lint パス。UTM 由来のサイト流入は Vercel Analytics 等で `utm_campaign=trend_joke_tool_intro` を見れば確認できる（分析基盤の自動取得は Phase 2 の範囲外。参照先だけドキュメント化する）。

---

## Phase 3 — 週次自動 PR ループ（本丸）

**Goal:** 月曜レビュー（既存）の直後に「改善エージェント」automation を1枠追加し、`codex exec`（read-only）にレポート・ledger・関連 docs を読ませて**実験提案 JSON を1件だけ**作らせ、決定論的 Node ラッパが allowlist 検証・ブランチ作成・単一ファイル編集・PR 作成を行う。人間が PR をレビューしてマージ。自動マージはしない。

**Architecture の要点（安全設計）:**
- LLM（codex）には**書き込み権限を渡さない**。read-only で「どのファイルを・どう変えるか・仮説・評価指標・評価予定週」を JSON で出力させるだけ。
- allowlist 検証・ブランチ・編集・PR は**すべて Node 側の決定論コード**が担う。allowlist 外・複数ファイル・rate limit 系への変更は Node が拒否する（LLM の裁量に依存しない）。
- 1 PR = 1実験 = 1ファイル変更。revert で完結。

### File Structure

- Create: `scripts/x-growth-improve.mjs` — automation エントリ。レビュー Markdown/ledger を集め、codex を呼び、提案を検証・適用・PR 化。
- Create: `scripts/x-growth/experimentAllowlist.mjs` — 編集可能パスの allowlist と、パス・変更種別の検証。
- Create: `scripts/x-growth/proposalSchema.mjs` — codex `--output-schema` 用 JSON Schema と提案バリデータ。
- Create: `scripts/x-growth/applyProposal.mjs` — 提案を単一ファイルへ適用（文字列置換ベース）、git ブランチ作成、`gh pr create`。
- Create: `scripts/x-growth/verifyChange.mjs` — 適用後の検証ゲート（.mjs は `node --check`、.ts は `npx tsc --noEmit` + `npm run lint`、.json は `JSON.parse`）。失敗時は `git checkout -- <path>` で破棄し PR を作らない。
- Modify: `package.json` — `x:growth-improve` スクリプト追加。
- Modify: `docs/system-design/operations/x-browser-post-schedules.md` — automation 1枠追加、実行契約追記。
- Create: `docs/system-design/subsystems/x-growth-improve-agent.md` — エージェントの設計・境界。
- Modify: `docs/README.md`、`docs/system-design/README.md` — 新規 subsystem 文書をリンク。
- Test(harness): `scratchpad/phase3-*.mjs` — allowlist・schema・apply の検証。

### Global Constraints（Phase 3 固有）

- **allowlist（編集可能パス）:**
  - `src/server/x-browser-posting/comment-patterns.json`（kind `json-array`。個別イベント投稿のコメント50文）
  - `src/server/x-browser-posting/trend-joke-post.ts`（kind `ts-copy`。fallback 候補文・prompt テンプレート・閾値定数。**TS を最初から対象に含める**）
  - `docs/system-design/operations/x-browser-post-schedules.md`（kind `doc`。台帳の記述更新）
- **禁止（Node が拒否）:** `scripts/x-browser-posting/config.mjs`、`.env*`、`.github/`、`middleware.ts`、`--execute`/confirmation/rate-limit に関わる全て、複数ファイル同時変更、新規ファイル作成。
- **TS を安全に編集するための二重ガード（本計画の必須要件）:**
  1. **ファイル内ガード（適用前）:** `change.find` / `change.replace` が重要トークンに触れる提案は拒否する。**マッチは大小文字を無視**（haystack を lowercase 化）し、トークンも lowercase で保持する。禁止トークン（`.ts` 対象）: `validatetrendjoketext`、`weightedtextlength`、`max_trend_joke`、`max_daily`、`min_cooldown`、`--execute`、`confirmation_mode`、`auto_execute`、`process.env`、`spawn`、`exec(`、`execfile`、`execsync`、`child_process`、`fetch(`、`import `、`import(`、`require(`。（`spawn`→spawnSync、`execfile`→execFile/execFileSync、`execsync`→execSync、`import(`→動的 import を各々カバー。）これによりループが編集できるのは「文言・候補文・数値閾値の中身」に限定され、投稿ロジック・認証・実行ガード・外部呼び出しには触れられない。
  2. **検証ゲート（適用後）:** find/replace 適用後、`.ts` は `npx tsc --noEmit` と `npm run lint`、`.mjs` は `node --check`、`.json` は `JSON.parse` を通す。**いずれか失敗したら `git checkout -- <path>` で変更を破棄し、PR を作らずに `rejected` で終了する。** 壊れた TS が PR になることを構造的に防ぐ。
- codex 実行は `--sandbox read-only --ephemeral`（Phase 1 のトレンドジョーク provider と同一の呼び出しパターン）。
- PR 作成は `gh pr create --draft`。**マージはしない**。ドラフト PR で人間レビュー必須。
- **1 PR = 1実験 = 1ファイル = ちょうど1回一致する find/replace**。revert で完結。

### Task 3.1: 実験 allowlist モジュール

**Files:**
- Create: `scripts/x-growth/experimentAllowlist.mjs`
- Test: `scratchpad/phase3-allowlist.mjs`

**Interfaces:**
- Produces:
  - `EXPERIMENT_ALLOWLIST: Array<{ path, kind, note }>`（`kind` は `"json-array"` | `"ts-copy"` | `"doc"`）
  - `DENY_PATH_PATTERNS: RegExp[]`
  - `FORBIDDEN_CHANGE_TOKENS: string[]`（`.ts` 対象の変更文字列に現れてはいけない重要トークン）
  - `validateProposalTarget(proposal) -> { ok: true } | { ok: false, reason }`（パス・種別の検証）
  - `validateProposalChange(proposal) -> { ok: true } | { ok: false, reason }`（`ts-copy` のとき find/replace が重要トークンに触れないかを検証）

- [ ] **Step 1: ハーネスを書く（失敗する状態）**

`scratchpad/phase3-allowlist.mjs`:
```js
import { validateProposalTarget, validateProposalChange } from "/Users/fukasedaichi/git/nazomatic/scripts/x-growth/experimentAllowlist.mjs";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
A(validateProposalTarget({ path: "src/server/x-browser-posting/comment-patterns.json", kind: "json-array" }).ok, "allow comment-patterns");
A(validateProposalTarget({ path: "src/server/x-browser-posting/trend-joke-post.ts", kind: "ts-copy" }).ok, "allow trend-joke ts-copy");
A(!validateProposalTarget({ path: "scripts/x-browser-posting/config.mjs", kind: "ts-copy" }).ok, "deny config.mjs");
A(!validateProposalTarget({ path: ".env.x-browser-posting.local", kind: "json-array" }).ok, "deny .env");
A(!validateProposalTarget({ path: ".github/workflows/x-repost-events.yml", kind: "doc" }).ok, "deny .github");
A(!validateProposalTarget({ path: "src/server/x-browser-posting/trend-joke-post.ts", kind: "json-array" }).ok, "deny kind mismatch");
A(!validateProposalTarget({ path: "src/server/x-browser-posting/comment-patterns.json", kind: "unknown-kind" }).ok, "deny unknown kind");
// ts-copy の変更ガード: 重要トークンに触れる提案は拒否
A(validateProposalChange({ path: "src/server/x-browser-posting/trend-joke-post.ts", kind: "ts-copy", change: { find: "詰まったときの道具箱に、", replace: "困ったら道具箱に、" } }).ok, "allow benign ts copy change");
A(!validateProposalChange({ path: "src/server/x-browser-posting/trend-joke-post.ts", kind: "ts-copy", change: { find: "weightedTextLength(trimmed)", replace: "0" } }).ok, "deny change touching validator");
A(!validateProposalChange({ path: "src/server/x-browser-posting/trend-joke-post.ts", kind: "ts-copy", change: { find: "x", replace: "process.env.FOO" } }).ok, "deny change adding process.env");
A(validateProposalChange({ path: "src/server/x-browser-posting/comment-patterns.json", kind: "json-array", change: { find: "a", replace: "b" } }).ok, "json change not token-guarded");
console.log("done");
```

- [ ] **Step 2: 失敗を確認**

Run: `node scratchpad/phase3-allowlist.mjs`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`scripts/x-growth/experimentAllowlist.mjs`:
```js
// 自動改善ループが編集してよいパスと変更種別の allowlist。
// LLM の裁量ではなく、この決定論コードが唯一の境界。
export const EXPERIMENT_ALLOWLIST = [
  {
    path: "src/server/x-browser-posting/comment-patterns.json",
    kind: "json-array",
    note: "個別イベント投稿のコメント候補（配列1件の入替）",
  },
  {
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-copy",
    note: "fallback 候補文・prompt テンプレート・閾値定数（文言と数値のみ。ロジック不可）",
  },
  {
    path: "docs/system-design/operations/x-browser-post-schedules.md",
    kind: "doc",
    note: "運用台帳の記述更新",
  },
];

// 絶対に触らせないパス。allowlist と多重防御。
export const DENY_PATH_PATTERNS = [
  /(^|\/)config\.mjs$/,
  /(^|\/)\.env/,
  /^\.github\//,
  /middleware\.(ts|js)$/,
  /(^|\/)package(-lock)?\.json$/,
];

// ts-copy の find/replace に現れてはいけない重要トークン。
// これによりループは「文言・候補文・数値閾値の中身」しか変えられず、
// 投稿ロジック・認証・実行ガード・外部呼び出しには触れられない。
// マッチは大小文字を無視するため、トークンは lowercase で保持する。
export const FORBIDDEN_CHANGE_TOKENS = [
  "validatetrendjoketext",
  "weightedtextlength",
  "max_trend_joke",
  "max_daily",
  "min_cooldown",
  "--execute",
  "confirmation_mode",
  "auto_execute",
  "process.env",
  "spawn",
  "exec(",
  "execfile",
  "execsync",
  "child_process",
  "fetch(",
  "import ",
  "import(",
  "require(",
];

const ALLOWED_KINDS = new Set(["json-array", "ts-copy", "doc"]);

export function validateProposalTarget(proposal) {
  const path = String(proposal?.path ?? "");
  const kind = String(proposal?.kind ?? "");
  if (!path) {
    return { ok: false, reason: "path is empty" };
  }
  if (path.includes("..") || path.startsWith("/")) {
    return { ok: false, reason: "path must be a repo-relative simple path" };
  }
  if (DENY_PATH_PATTERNS.some((re) => re.test(path))) {
    return { ok: false, reason: `path is explicitly denied: ${path}` };
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return { ok: false, reason: `unknown change kind: ${kind}` };
  }
  const entry = EXPERIMENT_ALLOWLIST.find((e) => e.path === path);
  if (!entry) {
    return { ok: false, reason: `path not in allowlist: ${path}` };
  }
  if (entry.kind !== kind) {
    return {
      ok: false,
      reason: `kind ${kind} does not match allowlist kind ${entry.kind} for ${path}`,
    };
  }
  return { ok: true };
}

export function validateProposalChange(proposal) {
  if (proposal?.kind !== "ts-copy") {
    return { ok: true };
  }
  const haystack = `${proposal?.change?.find ?? ""}\n${proposal?.change?.replace ?? ""}`.toLowerCase();
  const hit = FORBIDDEN_CHANGE_TOKENS.find((token) => haystack.includes(token));
  if (hit) {
    return {
      ok: false,
      reason: `ts-copy change touches a forbidden token: ${hit}`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 4: 成功を確認**

Run: `node scratchpad/phase3-allowlist.mjs`
Expected: 全行 `ok:`、`done`

- [ ] **Step 5: lint + syntax → Commit**

```bash
node --check scripts/x-growth/experimentAllowlist.mjs && npm run lint
git add scripts/x-growth/experimentAllowlist.mjs
git commit -m "feat(x-growth): add experiment path allowlist and ts change guard"
```

### Task 3.2: 提案スキーマとバリデータ

**Files:**
- Create: `scripts/x-growth/proposalSchema.mjs`
- Test: `scratchpad/phase3-schema.mjs`

**Interfaces:**
- Produces:
  - `buildProposalOutputSchema() -> object`（codex `--output-schema` に渡す JSON Schema）
  - `validateProposal(obj) -> { ok, proposal?, reason? }`（必須項目・型・単一変更・置換文字列の健全性を確認）
- Consumes: `validateProposalTarget`, `validateProposalChange`（Task 3.1）。

提案 JSON の形（1件のみ）:
```json
{
  "hypothesis": "質問型の1文目を疑問形にすると返信が増える",
  "path": "src/server/x-browser-posting/comment-patterns.json",
  "kind": "json-array",
  "change": {
    "find": "…既存の完全一致文字列…",
    "replace": "…新しい文字列…"
  },
  "metric": "capturedEngagementMetrics の中央値（返信+RP+いいね）",
  "evaluateWeek": "2026-W31",
  "rationale": "前週レビューで question 型の反応中央値が最下位だったため"
}
```

- [ ] **Step 1: ハーネス（失敗）**

`scratchpad/phase3-schema.mjs`:
```js
import { validateProposal } from "/Users/fukasedaichi/git/nazomatic/scripts/x-growth/proposalSchema.mjs";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const good = { hypothesis: "hypothesis8", path: "src/server/x-browser-posting/comment-patterns.json", kind: "json-array", change: { find: "old text", replace: "new text" }, metric: "engagement median", evaluateWeek: "2026-W31", rationale: "rationale8" };
A(validateProposal(good).ok, "valid proposal");
A(!validateProposal({ ...good, path: "scripts/x-browser-posting/config.mjs" }).ok, "reject denied path");
A(!validateProposal({ ...good, change: { find: "x", replace: "x" } }).ok, "reject no-op change");
A(!validateProposal({ ...good, change: { find: "", replace: "y" } }).ok, "reject empty find");
A(!validateProposal({ hypothesis: "h" }).ok, "reject missing fields");
// ts-copy: forbidden-token change is rejected via validateProposalChange
const tsGood = { ...good, path: "src/server/x-browser-posting/trend-joke-post.ts", kind: "ts-copy", change: { find: "困ったら道具箱に、", replace: "詰まったら道具箱に、" } };
A(validateProposal(tsGood).ok, "valid ts-copy proposal");
A(!validateProposal({ ...tsGood, change: { find: "weightedTextLength(trimmed)", replace: "0" } }).ok, "reject ts-copy touching validator");
console.log("done");
```

- [ ] **Step 2: 失敗を確認** — Run: `node scratchpad/phase3-schema.mjs` / Expected: FAIL

- [ ] **Step 3: 実装**

`scripts/x-growth/proposalSchema.mjs`:
```js
import {
  validateProposalChange,
  validateProposalTarget,
} from "./experimentAllowlist.mjs";

export function buildProposalOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "hypothesis",
      "path",
      "kind",
      "change",
      "metric",
      "evaluateWeek",
      "rationale",
    ],
    properties: {
      hypothesis: { type: "string", minLength: 8 },
      path: { type: "string" },
      kind: { type: "string", enum: ["json-array", "ts-copy", "doc"] },
      change: {
        type: "object",
        additionalProperties: false,
        required: ["find", "replace"],
        properties: {
          find: { type: "string", minLength: 1 },
          replace: { type: "string", minLength: 1 },
        },
      },
      metric: { type: "string", minLength: 3 },
      evaluateWeek: { type: "string", pattern: "^[0-9]{4}-W[0-9]{2}$" },
      rationale: { type: "string", minLength: 8 },
    },
  };
}

export function validateProposal(obj) {
  if (!obj || typeof obj !== "object") {
    return { ok: false, reason: "proposal is not an object" };
  }
  const required = [
    "hypothesis",
    "path",
    "kind",
    "change",
    "metric",
    "evaluateWeek",
    "rationale",
  ];
  for (const key of required) {
    if (obj[key] == null) {
      return { ok: false, reason: `missing field: ${key}` };
    }
  }
  const target = validateProposalTarget(obj);
  if (!target.ok) {
    return target;
  }
  const { find, replace } = obj.change ?? {};
  if (typeof find !== "string" || typeof replace !== "string" || !find) {
    return { ok: false, reason: "change.find/replace must be non-empty strings" };
  }
  if (find === replace) {
    return { ok: false, reason: "change is a no-op" };
  }
  const changeGuard = validateProposalChange(obj);
  if (!changeGuard.ok) {
    return changeGuard;
  }
  if (!/^[0-9]{4}-W[0-9]{2}$/.test(obj.evaluateWeek)) {
    return { ok: false, reason: "evaluateWeek must be ISO week like 2026-W31" };
  }
  return { ok: true, proposal: obj };
}
```

- [ ] **Step 4: 成功を確認** — Run: `node scratchpad/phase3-schema.mjs` / Expected: 全 `ok:`, `done`

- [ ] **Step 5: lint + Commit**

```bash
node --check scripts/x-growth/proposalSchema.mjs && npm run lint
git add scripts/x-growth/proposalSchema.mjs
git commit -m "feat(x-growth): add proposal JSON schema and validator"
```

### Task 3.3: 提案適用（単一ファイル置換 + ブランチ + PR）

**Files:**
- Create: `scripts/x-growth/applyProposal.mjs`
- Test: `scratchpad/phase3-apply.mjs`（git 操作は関数分離してドライに検証）

**Interfaces:**
- Consumes: `validateProposal`（Task 3.2）。
- Produces:
  - `applyChangeToFile(cwd, proposal) -> Promise<{ ok, reason?, before?, after? }>`（`change.find` がファイル内に**ちょうど1回**出現する時だけ置換。0回/複数回は拒否）
  - `createExperimentPr(cwd, proposal, { issueUrl, dryRun }) -> Promise<{ branch, prUrl? }>`（`git switch -c`、`git add <path>`、`git commit`、`gh pr create`。dryRun 時は git/gh を実行せずコマンドを返す）

- [ ] **Step 1: 適用ロジックのハーネス（失敗）**

`scratchpad/phase3-apply.mjs`:
```js
import { applyChangeToFile } from "/Users/fukasedaichi/git/nazomatic/scripts/x-growth/applyProposal.mjs";
import fs from "fs/promises"; import os from "os"; import path from "path";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "phase3-apply-"));
await fs.mkdir(path.join(cwd, "src/server/x-browser-posting"), { recursive: true });
const p = "src/server/x-browser-posting/comment-patterns.json";
await fs.writeFile(path.join(cwd, p), JSON.stringify(["古い一文", "別の文"], null, 2));
let r = await applyChangeToFile(cwd, { path: p, kind: "json-array", change: { find: "古い一文", replace: "新しい一文" } });
A(r.ok && (await fs.readFile(path.join(cwd, p), "utf8")).includes("新しい一文"), "single replace applied");
let r2 = await applyChangeToFile(cwd, { path: p, kind: "json-array", change: { find: "存在しない", replace: "x" } });
A(!r2.ok, "reject when find not present");
await fs.writeFile(path.join(cwd, p), JSON.stringify(["重複", "重複"], null, 2));
let r3 = await applyChangeToFile(cwd, { path: p, kind: "json-array", change: { find: "重複", replace: "y" } });
A(!r3.ok, "reject when find matches multiple times");
await fs.rm(cwd, { recursive: true, force: true });
console.log("done");
```

- [ ] **Step 2: 失敗を確認** — Run: `node scratchpad/phase3-apply.mjs` / Expected: FAIL

- [ ] **Step 3: 実装**

`scripts/x-growth/applyProposal.mjs`:
```js
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { validateProposal } from "./proposalSchema.mjs";

export async function applyChangeToFile(cwd, proposal) {
  const target = validateProposal(proposal);
  if (!target.ok) {
    return { ok: false, reason: target.reason };
  }
  const filePath = path.join(cwd, proposal.path);
  const before = await fs.readFile(filePath, "utf8").catch(() => null);
  if (before == null) {
    return { ok: false, reason: `file not found: ${proposal.path}` };
  }
  const { find, replace } = proposal.change;
  const occurrences = before.split(find).length - 1;
  if (occurrences !== 1) {
    return {
      ok: false,
      reason: `change.find must match exactly once (found ${occurrences})`,
    };
  }
  const after = before.replace(find, replace);
  if (proposal.path.endsWith(".json")) {
    try {
      JSON.parse(after);
    } catch (error) {
      return { ok: false, reason: `result is not valid JSON: ${error.message}` };
    }
  }
  await fs.writeFile(filePath, after);
  return { ok: true, before, after };
}

export async function createExperimentPr(cwd, proposal, { issueUrl, dryRun } = {}) {
  const slug = proposal.path.split("/").pop().replace(/\W+/g, "-");
  const branch = `x-growth/experiment-${proposal.evaluateWeek}-${slug}`;
  const title = `[X改善実験] ${proposal.hypothesis}`;
  const body = [
    `## 仮説`,
    proposal.hypothesis,
    ``,
    `## 変更内容`,
    `- ファイル: \`${proposal.path}\``,
    `- 種別: ${proposal.kind}`,
    ``,
    `## 評価指標`,
    proposal.metric,
    ``,
    `## 評価予定週`,
    proposal.evaluateWeek,
    ``,
    `## 根拠`,
    proposal.rationale,
    ...(issueUrl ? [``, `関連: ${issueUrl}`] : []),
    ``,
    `<!-- x-growth-experiment: 1 PR = 1 実験。効果検証まで revert しない。自動マージ禁止。 -->`,
  ].join("\n");

  const steps = [
    ["git", ["switch", "-c", branch]],
    ["git", ["add", proposal.path]],
    ["git", ["commit", "-m", title]],
    [
      "gh",
      ["pr", "create", "--draft", "--title", title, "--body", body],
    ],
  ];
  if (dryRun) {
    return { branch, steps };
  }
  let prUrl = null;
  for (const [command, args] of steps) {
    const out = await runGit(cwd, command, args);
    if (command === "gh") {
      prUrl = out.trim().split(/\s+/).find((t) => t.startsWith("http")) ?? null;
    }
  }
  return { branch, prUrl };
}

function runGit(cwd, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} ${args.join(" ")} failed: ${stderr || stdout}`))
    );
  });
}
```

- [ ] **Step 4: 成功を確認** — Run: `node scratchpad/phase3-apply.mjs` / Expected: 全 `ok:`, `done`

- [ ] **Step 5: PR 作成の dry-run 確認**

`scratchpad/phase3-pr.mjs` で `createExperimentPr(process.cwd(), sampleProposal, { dryRun: true })` を呼び、`steps` に `git switch -c x-growth/experiment-…` と `gh pr create --draft` が含まれ、rate-limit/config への言及が無いことを確認。
Run: `node scratchpad/phase3-pr.mjs`
Expected: branch 名と steps が出力され、`--draft` が付く。

- [ ] **Step 6: lint + Commit**

```bash
node --check scripts/x-growth/applyProposal.mjs && npm run lint
git add scripts/x-growth/applyProposal.mjs
git commit -m "feat(x-growth): apply single-file experiment change and open draft PR"
```

### Task 3.3b: 適用後の検証ゲート

**Files:**
- Create: `scripts/x-growth/verifyChange.mjs`
- Test: `scratchpad/phase3-verify.mjs`

**Interfaces:**
- Produces:
  - `verifyChangedFile(cwd, relPath) -> Promise<{ ok: true } | { ok: false, reason }>`（拡張子で分岐: `.json` は `JSON.parse`、`.mjs`/`.js` は `node --check`、`.ts`/`.tsx` は `npx tsc --noEmit` と `npm run lint` を実行。いずれか非0終了で `ok:false`）
  - `revertChangedFile(cwd, relPath) -> Promise<void>`（`git checkout -- <relPath>` で作業ツリーの変更を破棄）

これは TS を編集対象に含めるための必須ゲート。壊れた TS・JSON が PR になることを構造的に防ぐ。`runImprovementCycle`（Task 3.4）が apply と PR の間で呼ぶ。

- [ ] **Step 1: ハーネス（失敗）**

`scratchpad/phase3-verify.mjs`:
```js
import { verifyChangedFile } from "/Users/fukasedaichi/git/nazomatic/scripts/x-growth/verifyChange.mjs";
import fs from "fs/promises"; import os from "os"; import path from "path";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "phase3-verify-"));
await fs.writeFile(path.join(cwd, "good.json"), '{"a":1}');
await fs.writeFile(path.join(cwd, "bad.json"), '{"a":1');
A((await verifyChangedFile(cwd, "good.json")).ok, "valid json passes");
A(!(await verifyChangedFile(cwd, "bad.json")).ok, "invalid json fails");
await fs.writeFile(path.join(cwd, "good.mjs"), "export const x = 1;\n");
await fs.writeFile(path.join(cwd, "bad.mjs"), "export const x = ;\n");
A((await verifyChangedFile(cwd, "good.mjs")).ok, "valid mjs passes");
A(!(await verifyChangedFile(cwd, "bad.mjs")).ok, "invalid mjs fails");
await fs.rm(cwd, { recursive: true, force: true });
console.log("done");
```
（`.ts` は本物のリポジトリでのみ tsc が意味を持つため、ハーネスでは `.json`/`.mjs` の分岐だけを検証する。`.ts` 分岐は実装レビューで確認する。）

- [ ] **Step 2: 失敗を確認** — Run: `node scratchpad/phase3-verify.mjs` / Expected: FAIL

- [ ] **Step 3: 実装**

`scripts/x-growth/verifyChange.mjs`:
```js
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export async function verifyChangedFile(cwd, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === ".json") {
    try {
      JSON.parse(await fs.readFile(path.join(cwd, relPath), "utf8"));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: `invalid JSON: ${error.message}` };
    }
  }
  if (ext === ".mjs" || ext === ".js") {
    const r = await run(cwd, "node", ["--check", relPath]);
    return r.code === 0 ? { ok: true } : { ok: false, reason: `node --check failed: ${r.stderr}` };
  }
  if (ext === ".ts" || ext === ".tsx") {
    const tsc = await run(cwd, "npx", ["tsc", "--noEmit"]);
    if (tsc.code !== 0) {
      return { ok: false, reason: `tsc failed: ${tsc.stdout || tsc.stderr}` };
    }
    const lint = await run(cwd, "npm", ["run", "lint"]);
    return lint.code === 0 ? { ok: true } : { ok: false, reason: `lint failed: ${lint.stdout || lint.stderr}` };
  }
  // md 等はそのまま可（doc は構文検証不要）。
  return { ok: true };
}

export async function revertChangedFile(cwd, relPath) {
  await run(cwd, "git", ["checkout", "--", relPath]);
}

function run(cwd, command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", (e) => resolve({ code: 1, stdout, stderr: String(e) }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
```

- [ ] **Step 4: 成功を確認** — Run: `node scratchpad/phase3-verify.mjs` / Expected: 全 `ok:`, `done`

- [ ] **Step 5: lint + Commit**

```bash
node --check scripts/x-growth/verifyChange.mjs && npm run lint
git add scripts/x-growth/verifyChange.mjs
git commit -m "feat(x-growth): add post-apply verification gate (tsc/lint/syntax)"
```

### Task 3.4: エージェント本体（codex 呼び出し + 全体オーケストレーション）

**Files:**
- Create: `scripts/x-growth-improve.mjs`
- Modify: `package.json`
- Test: `scratchpad/phase3-agent.mjs`（codex 呼び出しはモック関数注入で検証）

**Interfaces:**
- Consumes: `buildProposalOutputSchema`, `validateProposal`, `validateProposalTarget`, `applyChangeToFile`, `createExperimentPr`、既存の `readBrowserPostLedger`。
- Produces: CLI `npm run x:growth-improve -- [--execute] [--issue-url <url>]`。既定は dry-run（提案の生成・検証まで。PR は作らない）。`--execute` で PR まで。

オーケストレーション:
1. 直近の週次レビュー Markdown を取得（`gh issue list` で最新の `[X週次レビュー]` Issue 本文、または標準入力）。
2. `readBrowserPostLedger` で直近7日を集計サマリ化（型別中央値など。Phase 2 のヘルパを import）。
3. codex prompt に「レビュー要約 + allowlist + 提案スキーマの説明 + 1件だけ・1ファイルだけ・rate limit/config 禁止」を入れ、`codex exec --sandbox read-only --ephemeral --output-schema <schema> --output-last-message <out> -`（Task/既存 `runCodexTrendJokeProvider` と同じ引数構成）を実行。
4. 出力を `validateProposal`。NG なら理由を表示して**何もせず終了**（PR を作らない）。
5. OK かつ `--execute` なら `applyChangeToFile` → `createExperimentPr`。dry-run なら提案 JSON と差分予定を表示するだけ。

- [ ] **Step 1: オーケストレーションの純粋部分をハーネス化（失敗）**

`scripts/x-growth-improve.mjs` は `runImprovementCycle({ cwd, reviewMarkdown, ledgerSummary, callCodex, execute, issueUrl })` を export し、`callCodex` を注入可能にする（テスト用）。

`scratchpad/phase3-agent.mjs`:
```js
import { runImprovementCycle } from "/Users/fukasedaichi/git/nazomatic/scripts/x-growth-improve.mjs";
const A = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };
const goodProposal = { hypothesis: "質問型の1文目を疑問形にする", path: "src/server/x-browser-posting/comment-patterns.json", kind: "json-array", change: { find: "AAA", replace: "BBB" }, metric: "engagement median", evaluateWeek: "2026-W31", rationale: "question 型の反応中央値が最下位" };
// dry-run: 提案を検証するが PR を作らない
let r = await runImprovementCycle({ cwd: process.cwd(), reviewMarkdown: "dummy", ledgerSummary: "dummy", callCodex: async () => goodProposal, execute: false });
A(r.status === "proposed" && r.proposal.hypothesis.includes("疑問形"), "dry-run proposes without PR " + r.status);
// 不正提案（denied path）は拒否
let bad = await runImprovementCycle({ cwd: process.cwd(), reviewMarkdown: "x", ledgerSummary: "x", callCodex: async () => ({ ...goodProposal, path: "scripts/x-browser-posting/config.mjs" }), execute: true });
A(bad.status === "rejected", "denied path rejected " + bad.status);
console.log("done");
```

- [ ] **Step 2: 失敗を確認** — Run: `node scratchpad/phase3-agent.mjs` / Expected: FAIL

- [ ] **Step 3: 実装（骨子）**

`scripts/x-growth-improve.mjs`（要点。codex 呼び出しは `runCodexProposal` として分離し、`callCodex` 注入で差し替え可能に）:
```js
#!/usr/bin/env node
import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { readBrowserPostLedger } from "./x-browser-posting/postLedger.mjs";
import { buildProposalOutputSchema, validateProposal } from "./x-growth/proposalSchema.mjs";
import { EXPERIMENT_ALLOWLIST } from "./x-growth/experimentAllowlist.mjs";
import { applyChangeToFile, createExperimentPr } from "./x-growth/applyProposal.mjs";
import { verifyChangedFile, revertChangedFile } from "./x-growth/verifyChange.mjs";

export async function runImprovementCycle({ cwd, reviewMarkdown, ledgerSummary, callCodex, execute, issueUrl }) {
  const proposal = await callCodex({ reviewMarkdown, ledgerSummary, allowlist: EXPERIMENT_ALLOWLIST });
  const validated = validateProposal(proposal);
  if (!validated.ok) {
    return { status: "rejected", reason: validated.reason, proposal };
  }
  if (!execute) {
    return { status: "proposed", proposal: validated.proposal };
  }
  const applied = await applyChangeToFile(cwd, validated.proposal);
  if (!applied.ok) {
    return { status: "rejected", reason: applied.reason, proposal: validated.proposal };
  }
  // 適用後の検証ゲート: tsc/lint/構文が通らなければ変更を破棄し PR を作らない。
  const verified = await verifyChangedFile(cwd, validated.proposal.path);
  if (!verified.ok) {
    await revertChangedFile(cwd, validated.proposal.path);
    return { status: "rejected", reason: `verification failed: ${verified.reason}`, proposal: validated.proposal };
  }
  const pr = await createExperimentPr(cwd, validated.proposal, { issueUrl });
  return { status: "pr_created", proposal: validated.proposal, ...pr };
}

// codex exec を read-only で呼び、提案 JSON を返す（本番用 callCodex）。
export async function runCodexProposal({ cwd, reviewMarkdown, ledgerSummary, allowlist, model, timeoutMs = 120000 }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-improve-"));
  const schemaPath = path.join(tempDir, "schema.json");
  const outputPath = path.join(tempDir, "out.json");
  try {
    await fs.writeFile(schemaPath, JSON.stringify(buildProposalOutputSchema(), null, 2));
    const prompt = buildPrompt({ reviewMarkdown, ledgerSummary, allowlist });
    const args = ["exec"];
    if (model) args.push("--model", model);
    args.push("--cd", cwd, "--sandbox", "read-only", "--ephemeral",
      "--output-schema", schemaPath, "--output-last-message", outputPath, "-");
    const result = await runChild("codex", args, { cwd, input: prompt, timeoutMs });
    if (result.exitCode !== 0) throw new Error(`codex exited ${result.exitCode}: ${result.stderr}`);
    const text = (await fs.readFile(outputPath, "utf8").catch(() => "")) || result.stdout;
    return JSON.parse(text);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function buildPrompt({ reviewMarkdown, ledgerSummary, allowlist }) {
  return [
    "あなたは NAZOMATIC の X 運用改善アシスタントです。",
    "次週に試す実験を『1件だけ・1ファイルだけ』提案し、指定スキーマの JSON を出力してください。",
    "制約:",
    "- 編集してよいのは以下の allowlist のパスのみ。rate limit・--execute・config・.env・.github は絶対に触らない。",
    ...allowlist.map((e) => `  - ${e.path}（${e.note}）`),
    "- change.find は対象ファイル内にちょうど1回だけ現れる完全一致文字列にする。",
    "- 投稿頻度を増やす提案はしない。質・時間帯・型・文言の実験に限る。",
    "",
    "## 直近の週次レビュー",
    reviewMarkdown,
    "",
    "## 台帳サマリ",
    ledgerSummary,
  ].join("\n");
}

function runChild(command, args, { cwd, input, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ exitCode: code, stdout, stderr }); });
    if (input) child.stdin.end(input);
  });
}
```
`main()`（CLI エントリ）は `--execute`/`--issue-url` を parse し、`gh issue list --search '[X週次レビュー]' --json body --limit 1` で最新レビュー本文を取り、`readBrowserPostLedger` からサマリを作って `runImprovementCycle({ callCodex: runCodexProposal, ... })` を実行し、結果を表示する。既存 `runWithLocalLog`（automationId: `x-growth-improve`）でラップする。

- [ ] **Step 4: 成功を確認** — Run: `node scratchpad/phase3-agent.mjs` / Expected: 全 `ok:`, `done`

- [ ] **Step 5: package.json にスクリプト追加**

```json
    "x:growth-improve": "node scripts/x-growth-improve.mjs",
```

- [ ] **Step 6: 実 codex での dry-run（提案のみ、PR なし）**

Run: `npm run x:growth-improve`（`--execute` なし）
Expected: codex が提案 JSON を返し、検証結果と「dry-run のため PR は作成しません」が表示される。allowlist 外を提案した場合は `rejected` と理由が出て終了する。

- [ ] **Step 7: lint + Commit**

```bash
node --check scripts/x-growth-improve.mjs && npm run lint
git add scripts/x-growth-improve.mjs package.json
git commit -m "feat(x-growth): add weekly improvement agent that proposes and opens experiment PRs"
```

### Task 3.5: automation 登録 + ドキュメント

**Files:**
- Modify: `docs/system-design/operations/x-browser-post-schedules.md`
- Create: `docs/system-design/subsystems/x-growth-improve-agent.md`
- Modify: `docs/README.md`、`docs/system-design/README.md`

- [ ] **Step 1: スケジュール台帳に1枠追加**

「稼働中の登録」表に行を足す:
```
| NAZOMATIC X 週次改善エージェント | ACTIVE | 毎週月曜 12:00 | `npm run x:growth-improve -- --execute` | 前週レビューから実験を1件選びドラフト PR を作成 |
```
実行契約に追記:
```
- 週次改善エージェントは提案を1件・1ファイルに限定し、allowlist 外・config・rate limit への変更は自動で拒否する。PR はドラフトで作成し、自動マージしない。人間が Issue で採用判断してからマージする。
```

- [ ] **Step 2: subsystem 文書を新規作成**

`docs/system-design/subsystems/x-growth-improve-agent.md`（日本語）に、目的・安全設計（LLM は read-only 提案のみ、決定論ラッパが allowlist 検証と PR 化）・allowlist・提案スキーマ・1 PR=1実験=1ファイル・失敗時挙動・関連ファイルを記載。

- [ ] **Step 3: 索引を更新**

`docs/README.md` と `docs/system-design/README.md` の subsystem 一覧に新文書をリンク。

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs(x-growth): document weekly improvement agent and register automation"
```

**Phase 3 完了条件:** `npm run x:growth-improve`（dry-run）で codex が allowlist 内の提案1件を返し検証が通る。`--execute` でドラフト PR が1本作られ、変更が1ファイル・1差分で、config/rate limit に触れていない。allowlist 外提案は `rejected` で PR を作らない。automation 1枠が台帳に登録され、月曜12:00 に稼働。

---

## Phase 4 — ループの完成（実験台帳と勝敗の蓄積）

**Goal:** レビュー→PR→マージ→計測→検証が回り始めたら、実験の勝敗を台帳に蓄積し、翌週レビューが前週実験の効果を検証して「継続 / revert 推奨」を出す。提案品質を上げる材料にする。

### File Structure

- Create: `scripts/x-growth/experimentLedger.mjs` — 実験の記録・読み出し（`local/x-browser-posting/experiment-ledger.json`）。
- Modify: `scripts/x-growth-improve.mjs` — PR 作成時に実験を台帳へ `status: "open"` で記録。
- Modify: `scripts/x-weekly-growth-review.mjs` — 前週の open 実験について、評価週の型別中央値を before/after で比較し、レポートに「実験の勝敗」節を追加。
- Modify: docs。

### Task 4.1: 実験台帳モジュール

**Files:** Create `scripts/x-growth/experimentLedger.mjs` / Test `scratchpad/phase4-ledger.mjs`

**Interfaces:**
- `recordExperiment(cwd, experiment) -> Promise<entry>`（`{ id, hypothesis, path, evaluateWeek, prUrl, baselineMetric, createdAt, status: "open" }`）
- `readExperiments(cwd) -> Promise<entry[]>`
- `resolveExperiment(cwd, id, { status, resultMetric, verdict }) -> Promise<boolean>`（`status` は `"kept"` | `"reverted"`）

- [ ] **Step 1: ハーネス（失敗）** — 記録→読み出し→解決の round-trip を temp cwd で検証（Phase 1 の ledger ハーネスと同型）。
- [ ] **Step 2: 失敗を確認** — Run: `node scratchpad/phase4-ledger.mjs`
- [ ] **Step 3: 実装** — `post-ledger.mjs` の atomic write と同じ書き込み方式を流用（`writeJsonFileAtomic` 相当を内包）。`experiment-ledger.json` は `{ version: 1, experiments: [...] }`。
- [ ] **Step 4: 成功を確認** — Run: `node scratchpad/phase4-ledger.mjs`
- [ ] **Step 5: lint + Commit** — `feat(x-growth): add experiment ledger`

### Task 4.2: PR 作成時に実験を open で記録

**Files:** Modify `scripts/x-growth-improve.mjs`

- [ ] **Step 1** `runImprovementCycle` の `pr_created` 直前で `recordExperiment(cwd, { hypothesis, path, evaluateWeek, prUrl, baselineMetric: ledgerSummary の対象指標, ... })` を呼ぶ。`callCodex` 注入テストで `pr_created` 時に台帳へ1件増えることをハーネス確認（`createExperimentPr` は dryRun で差し替え）。
- [ ] **Step 2** 検証 → lint → Commit: `feat(x-growth): record opened experiments in ledger`

### Task 4.3: 週次レビューに「実験の勝敗」節

**Files:** Modify `scripts/x-weekly-growth-review.mjs`

- [ ] **Step 1** `main()` で `readExperiments(cwd)` を読み、`evaluateWeek === week.key` の open 実験について、対象次元（例: 変更が question 型なら question の反応中央値）の当週値と `baselineMetric` を比較する `evaluateExperiments(experiments, postMetrics)` を追加。
- [ ] **Step 2** レポート body に「## 実験の勝敗」節を追加。各実験に「継続推奨 / revert 推奨（指標が改善しない）」と根拠数値を出す。判定は提示のみで、revert は人間が PR 上で判断（自動 revert しない）。
- [ ] **Step 3** dry-run（`npm run x:growth-review`）で節が出ることを確認 → lint → Commit: `feat(x-growth): report weekly experiment win/loss in review`

### Task 4.4: docs

- [ ] `x-growth-improve-agent.md` に実験台帳と勝敗検証を追記、`x-posting.md` の週次レビュー節に「実験の勝敗」を1文追記、ローカルファイル表に `experiment-ledger.json` を追加。Commit: `docs(x-growth): document experiment ledger and win/loss loop`

**Phase 4 完了条件:** PR 作成で `experiment-ledger.json` に `open` 実験が1件増える。翌週レビューに「実験の勝敗」節が出て、評価週の指標と baseline を比較し継続/revert を提示する。自動 revert はしない。

---

## 追加の機能改善アイデア（ループとは独立・バックログ）

各アイテムは Phase 2〜4 と独立に着手可能。優先度は「リプライ観測 > 投稿時間帯実験 > (頻度実験は原則しない)」。

### A. リプライ観測（未返信リプライ一覧）

**狙い:** フォロワー転換は会話から生まれる。発信専用の現状に「観測」を足す。返信自体は人間が行う（自動返信はしない）。

- **設計:** Phase 1 の計測相乗り（`growthTelemetry.mjs`）に、自投稿の会話ページ（`https://x.com/<handle>/status/<id>`）を開いて他者リプライを抽出する `readReplies(postUrl)` を `cdpChromePage.mjs` に追加。抽出結果（相手ハンドル・本文抜粋・リプライ URL・取得時刻）を `local/x-browser-posting/reply-observations.json` に保存。週次レビューが「未返信リプライ一覧」を Markdown / Issue に出す。
- **境界:** 読み取りのみ。返信・いいね・フォローはしない。ブロッキング/ログイン検出で停止。footprint を抑えるため対象は直近数投稿に限定し `METRICS_MAX_PER_RUN` と別の小上限を設ける。
- **タスク粒度:** (1) `readReplies` + パーサ + ハーネス、(2) 保存モジュール、(3) 週次レビューへ「未返信リプライ」節、(4) docs。各末尾に lint + commit。

### B. 投稿時間帯の実験

**狙い:** 実験 metadata で最も低コストに試せる軸（現行 09:30 / 15:30 / 21:30 の枠ずらし）。

- **設計:** コード変更は最小。automation の cron 時刻を変え、`runSlot`/`postedAt` は既に ledger にあるので Phase 2 の「時間帯別中央値」でそのまま差が見える。1回に1枠だけずらし、評価週を決めて比較（Phase 3/4 のループに乗せると自動で提案・検証される）。
- **境界:** 頻度は変えない（枠数は3のまま、時刻だけ移動）。台帳 doc の時刻を更新。
- **タスク粒度:** (1) スケジュール台帳の時刻更新 + 実験として Issue 起票、(2) 評価週後に時間帯別中央値で判定（既存レビューで足りる）。

### C. 頻度を上げる実験は原則しない（明示的な非対象）

- ブラウザ自動投稿は X の automation ポリシー上グレー。1日3回→5回のような頻度増は、フォロワー増より**アカウント凍結リスク**が先に来る可能性が高い。
- Phase 3 の allowlist と prompt で「頻度を増やす提案はしない」を制約として明記済み（`config.mjs` の rate limit は編集対象外）。頻度実験を試す場合は**人手で慎重に**、少数回の監視付きで行う。
- この方針を `docs/system-design/quality/known-concerns.md` に1項目として残す（バックログ）。

---

## Self-Review（計画作成者チェック済み）

- **Spec coverage:** Phase 2（型別・時間帯別・実験別中央値＝Task 2.1–2.2、UTM＝2.3）、Phase 3（codex 提案＝3.4、allowlist＝3.1、schema＝3.2、apply+PR＝3.3、週1・1変更・Issue リンク・revert 完結＝3.3 の PR 本文と 1ファイル制約、ローカル実行＝automation 登録 3.5）、Phase 4（過去実験の勝敗蓄積＝4.1–4.3）、独立アイデア（リプライ観測＝A、時間帯実験＝B、頻度非対象＝C）をすべてタスク化。
- **Placeholder scan:** 各コード手順に実コードを記載。docs 手順は挿入文言を明記。
- **Type consistency:** `validateProposal`/`validateProposalTarget`/`applyChangeToFile`/`createExperimentPr`/`runImprovementCycle`/`summarizeByDimension`/`sumEngagement`/`jstHourBucket`/`recordExperiment`/`resolveExperiment` の名前と引数をフェーズ間で統一。提案 JSON の項目（hypothesis/path/kind/change{find,replace}/metric/evaluateWeek/rationale）はスキーマ・バリデータ・prompt・PR 本文で一致。
- **テスト方式:** テストフレームワーク非導入のため、pytest 相当を scratchpad の `node` ハーネス + `--dry-run` 実行 + `npm run lint` に置換（Global Constraints 準拠）。

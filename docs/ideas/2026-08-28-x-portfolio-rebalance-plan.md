# X運用ポートフォリオ再配分 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** @nazomaticapp の投稿構成を「量産される定型投稿」から「フォローする理由になる定期コンテンツ」へ再配分する（週末サマリ週2化、改善PR一時停止、tool_intro週1上限、週次観測ログ新設、ゆる出題新設、固定ポスト文案）。

**Architecture:** 既存のブラウザ投稿基盤（`scripts/x-browser-posting/` 共通モジュール + prepare API + Codex automation）をそのまま使い、新しい投稿種別を2つ追加する。観測ログは Firestore 集計（サーバー）+ Codex imagegen 画像（ローカル、失敗時テキストのみ）で週1投稿。ゆる出題は `public/dic/buta.dic` と50音ずらしで**答えが機械的に一意**なクイズを日曜出題・月曜解答する。頻度変更は `~/.codex/automations/*/automation.toml` の編集で行う。

**Tech Stack:** Node.js (.mjs, node:test) / Next.js Route Handler / Firestore (firebase-admin) / Codex CLI (`codex exec --sandbox workspace-write` + imagegen skill) / Playwright CDP

**Spec:** 本計画冒頭の「背景と確定方針」節（2026-08-28 の戦略見直しセッションの結論）

## 背景と確定方針

- 直近40日: 318投稿でフォロワー+4（22→26）。表示数中央値約20で横ばい。反応があった投稿は301件中17件
- オーナー確定事項: 謎チケ引用は現状維持 / trend_joke は3回/日・ローテーション復活済み（commit `8f1475e`）/ 週末サマリは木・土の週2 / 観測ログは**専用automationを新規登録**（金曜夜）/ 観測ログのチャート画像は**Codex画像生成**で作る / ゆる出題は実施 / tool_intro は削減 / 週次改善PRは一時停止
- オーナー制約: 週次の人間関与ほぼゼロ / X API課金なし / Automatedラベル不可（アカウント紐付けが必須のため）

## Global Constraints

- 作業ブランチは `future`。`main` へ直接コミットしない
- ユーザーへの報告・PR説明は日本語
- 新しい npm 依存を追加しない
- 既存の投稿安全境界（validator、rate limit、`--execute` 必須、confirmation 二重ロック、blocking state 停止）を変更・迂回しない
- `~/.codex/automations/` 配下は Git 管理外。編集してもコミット対象にしない。変更したら同じタスク内で `docs/system-design/operations/x-browser-post-schedules.md` を同期する
- 各CLIは既定 dry-run。実投稿確認はしない（dry-run 出力の確認まで）
- 検証コマンド: `npm run test:x-browser-posting` / `npm run lint` / `npm run build`
- テキスト投稿の重み付け上限280（全角2・半角1）は既存実装の定義に従う
- 挙動変更したら同じタスクで `docs/` の該当文書を更新する

## 実装しないこと（明示）

- 謎チケ引用（`x:browser-post`）と trend_joke の頻度・時刻変更（trend_joke ローテーション復活は commit `8f1475e` で完了済み）
- X API 移行、Automatedラベル、自動リプライ
- 改善ループの目的変数変更（PR作成automationを止めるだけ。週次レビュー Issue 作成 `nazomatic-x-3` は継続）

---

### Task 1: automation 変更（週末サマリ木土化・改善PR一時停止）+ 運用台帳同期

**Files:**
- Modify: `~/.codex/automations/nazomatic/automation.toml`（Git管理外）
- Modify: `~/.codex/automations/nazomatic-x-pr/automation.toml`（Git管理外）
- Modify: `docs/system-design/operations/x-browser-post-schedules.md`

**Interfaces:**
- Consumes: なし
- Produces: 週末サマリが木・土のみ起動、改善PR作成が停止した状態（後続タスクの automation 追加はこの台帳形式に従う）

- [ ] **Step 1: 週末サマリの rrule を木・土に変更**

`~/.codex/automations/nazomatic/automation.toml` の rrule 行を書き換える（Edit ツールで部分置換）:

```toml
# 変更前
rrule = "TZID=Asia/Tokyo;FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=18;BYMINUTE=30;BYSECOND=0"
# 変更後
rrule = "TZID=Asia/Tokyo;FREQ=WEEKLY;BYDAY=TH,SA;BYHOUR=18;BYMINUTE=30;BYSECOND=0"
```

他のキー（prompt, status, model 等）は変更しない。

- [ ] **Step 2: 改善PR automation を一時停止**

`~/.codex/automations/nazomatic-x-pr/automation.toml` の status 行を書き換える:

```toml
# 変更前
status = "ACTIVE"
# 変更後
status = "PAUSED"
```

**注意:** 停止状態の enum 値は未検証（既存7件は全て `"ACTIVE"`）。書き換え後に Codex Desktop アプリの automation 一覧で `nazomatic-x-pr` が停止表示になっているか確認する。アプリが `"PAUSED"` を認識しない・一覧が壊れる場合は値を `"ACTIVE"` に戻し、ユーザーに「Codex アプリのUIから nazomatic-x-pr を一時停止してください」と依頼する。**停止の確認が取れるまでこのタスクは完了扱いにしない**（改善PR停止は本計画の主目的の一つであり、未達のまま先へ進めると投票固定のような局所最適実験が再発しうる。後続タスクの実装作業自体は並行してよいが、Task 12 のPR作成前に停止確認を必須チェックとする）。

- [ ] **Step 3: 変更を再読して確認**

Run: `grep -h "rrule\|status" ~/.codex/automations/nazomatic/automation.toml ~/.codex/automations/nazomatic-x-pr/automation.toml`
Expected: 週末サマリが `BYDAY=TH,SA`、PR が `PAUSED`（または手動停止依頼済み）

- [ ] **Step 4: 運用台帳を同期**

`docs/system-design/operations/x-browser-post-schedules.md` を更新する:
- 「稼働中の登録」表の `nazomatic` 行: JST実行時刻を「毎週 木・土 18:30」に変更
- 同表の `nazomatic-x-pr` 行: 状態を「PAUSED（2026-08-28 一時停止。改善ループの目的変数見直しまで）」に変更
- 「週末サマリ」節: 「内容と毎日18:30の頻度は変更しません」を「内容は変更しない。起動は木・土曜 18:30 の週2回（2026-08-28 に毎日から削減）。木曜はその週末、土曜は次の週末を対象にする（CLI の対象週末決定ルールは従来どおり）」に変更
- 「週次改善レビューと改善 PR」節の冒頭に「`nazomatic-x-pr` は 2026-08-28 から一時停止中。週次レビュー（`nazomatic-x-3`）は継続する」を追記

- [ ] **Step 5: コミット**

```bash
git add docs/system-design/operations/x-browser-post-schedules.md
git commit -m "週末サマリを木・土の週2回へ削減し、X週次改善PR automationを一時停止"
```

---

### Task 2: tool_intro の週1上限（ローテーション調整）

**Files:**
- Modify: `scripts/x-browser-posting/trendJokeCopy.mjs`
- Modify: `scripts/x-browser-post-trend-joke.mjs`（`selectNextTrendJokeArchetype` 付近）
- Test: `scripts/x-browser-posting/trendJokeCopy.test.mjs`
- Modify: `docs/system-design/operations/x-browser-post-schedules.md`（トレンドジョーク節）、`docs/system-design/subsystems/x-posting.md`（トレンドネタ投稿節）

**Interfaces:**
- Consumes: `trend-joke-history.json` のエントリ形状 `{ archetype: string, postedAt: string(ISO), ... }`、CLI 内の `TREND_JOKE_ARCHETYPE_ORDER = ["monologue","question","one_liner","poll","tool_intro"]`
- Produces: `capToolIntroArchetype({ archetype, entries, order, now?, minIntervalMs? }): string` と `TOOL_INTRO_MIN_INTERVAL_MS`（`trendJokeCopy.mjs` から export）

- [ ] **Step 1: 失敗するテストを書く**

`scripts/x-browser-posting/trendJokeCopy.test.mjs` に追記:

```js
import {
  capToolIntroArchetype,
  TOOL_INTRO_MIN_INTERVAL_MS,
} from "./trendJokeCopy.mjs";

const ARCHETYPE_ORDER = ["monologue", "question", "one_liner", "poll", "tool_intro"];

test("capToolIntroArchetype keeps non-tool_intro archetypes unchanged", () => {
  const result = capToolIntroArchetype({
    archetype: "poll",
    entries: [{ archetype: "tool_intro", postedAt: new Date().toISOString() }],
    order: ARCHETYPE_ORDER,
  });
  assert.equal(result, "poll");
});

test("capToolIntroArchetype skips tool_intro when one was posted within 7 days", () => {
  const now = new Date("2026-08-28T12:00:00Z");
  const result = capToolIntroArchetype({
    archetype: "tool_intro",
    entries: [
      { archetype: "poll", postedAt: "2026-08-28T00:00:00Z" },
      { archetype: "tool_intro", postedAt: "2026-08-25T12:00:00Z" },
    ],
    order: ARCHETYPE_ORDER,
    now,
  });
  assert.equal(result, "monologue");
});

test("capToolIntroArchetype allows tool_intro when the last one is older than 7 days", () => {
  const now = new Date("2026-08-28T12:00:00Z");
  const result = capToolIntroArchetype({
    archetype: "tool_intro",
    entries: [{ archetype: "tool_intro", postedAt: "2026-08-20T11:00:00Z" }],
    order: ARCHETYPE_ORDER,
    now,
  });
  assert.equal(result, "tool_intro");
});

test("capToolIntroArchetype ignores entries with invalid postedAt", () => {
  const result = capToolIntroArchetype({
    archetype: "tool_intro",
    entries: [{ archetype: "tool_intro", postedAt: "not-a-date" }],
    order: ARCHETYPE_ORDER,
  });
  assert.equal(result, "tool_intro");
});
```

既存テストファイルの import スタイル（`node:test` / `node:assert`）に合わせること。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:x-browser-posting`
Expected: FAIL（`capToolIntroArchetype` が export されていない）

- [ ] **Step 3: 実装**

`scripts/x-browser-posting/trendJokeCopy.mjs` に追加:

```js
// tool_intro は表示数中央値が最下位のため週1回を上限にする（2026-08-28 運用判断）。
export const TOOL_INTRO_MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function capToolIntroArchetype({
  archetype,
  entries,
  order,
  now = new Date(),
  minIntervalMs = TOOL_INTRO_MIN_INTERVAL_MS,
}) {
  if (archetype !== "tool_intro") {
    return archetype;
  }
  const cutoff = now.getTime() - minIntervalMs;
  const hasRecentToolIntro = (entries ?? []).some((entry) => {
    if (entry?.archetype !== "tool_intro") {
      return false;
    }
    const postedAt = Date.parse(entry?.postedAt ?? "");
    return Number.isFinite(postedAt) && postedAt >= cutoff;
  });
  if (!hasRecentToolIntro) {
    return archetype;
  }
  const index = order.indexOf("tool_intro");
  return order[(index + 1) % order.length];
}
```

- [ ] **Step 4: CLI のローテーションに適用**

`scripts/x-browser-post-trend-joke.mjs` の `selectNextTrendJokeArchetype` の2つの return を、選んだ値を `capToolIntroArchetype` へ通してから返す形に変更する:

```js
function selectNextTrendJokeArchetype(history, accountHandle) {
  const entries = getRelevantTrendJokeHistoryEntries(history, accountHandle);
  const latestKnownIndex = entries.findIndex((entry) =>
    TREND_JOKE_KNOWN_ARCHETYPES.has(entry?.archetype)
  );
  let next;
  if (latestKnownIndex >= 0) {
    const current = entries[latestKnownIndex].archetype;
    const currentIndex = TREND_JOKE_ARCHETYPE_ORDER.indexOf(current);
    next =
      TREND_JOKE_ARCHETYPE_ORDER[
        (currentIndex + 1) % TREND_JOKE_ARCHETYPE_ORDER.length
      ];
  } else {
    next =
      TREND_JOKE_ARCHETYPE_ORDER[
        entries.length % TREND_JOKE_ARCHETYPE_ORDER.length
      ];
  }
  return capToolIntroArchetype({
    archetype: next,
    entries,
    order: TREND_JOKE_ARCHETYPE_ORDER,
  });
}
```

ファイル先頭の `./x-browser-posting/trendJokeCopy.mjs` からの既存 import 文に `capToolIntroArchetype` を追加する。

**保証範囲の明確化:** この上限は自動ローテーション時のみ効く。`--archetype tool_intro` の明示指定と環境変数 `X_BROWSER_POST_TREND_JOKE_ARCHETYPE` はローテーションより優先されるため対象外（[x-browser-post-trend-joke.mjs:113-120](scripts/x-browser-post-trend-joke.mjs) の既存挙動）。このタスクの検証として `.env.x-browser-posting.local` に `X_BROWSER_POST_TREND_JOKE_ARCHETYPE` が設定されていないことを `grep` で確認し、設定されていれば削除をユーザーに確認する。ドキュメントにも「週1上限は自動ローテーション時のみ」と明記する。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm run test:x-browser-posting`
Expected: PASS（追加4件を含む全件）

- [ ] **Step 6: ドキュメント更新**

- `docs/system-design/operations/x-browser-post-schedules.md` トレンドジョーク節のローテーション説明に「`tool_intro` は直近7日間に投稿済みの場合スキップされ、次の型（独り言）へ進む（週1回上限）」を追記
- `docs/system-design/subsystems/x-posting.md` トレンドネタ投稿節の投稿型ローテーション説明に同内容を追記

- [ ] **Step 7: コミット**

```bash
git add scripts/x-browser-posting/trendJokeCopy.mjs scripts/x-browser-posting/trendJokeCopy.test.mjs scripts/x-browser-post-trend-joke.mjs docs/system-design/operations/x-browser-post-schedules.md docs/system-design/subsystems/x-posting.md
git commit -m "トレンド投稿のtool_introを週1回上限にする"
```

---

### Task 3: 観測ログのサーバーモジュール

**Files:**
- Create: `src/server/x-browser-posting/observation-log.ts`
- Modify: `src/server/x-browser-posting/weekend-ticket-summary.ts`（共有ヘルパの export 化のみ）
- Modify: `src/server/x-browser-posting/trend-joke-post.ts`（`weightedTextLength` の export 化のみ）

**Interfaces:**
- Consumes（import 元は確認済みの実在 export）:
  - `buildHashtagVariants`, `BrowserPostConfigError` ← `@/server/x-browser-posting/candidate`
  - `firestore` ← `@/server/firebase/admin`
  - `isRealtimeEventVisible` ← `@/server/realtime/syndication/visibility`
  - `baseURL` ← `@/app/config`
  - `zonedStartOfDayToUtc` / `readDate` / `readString` ← `weekend-ticket-summary.ts` の私有関数（Step 1 で export 化する）
  - `weightedTextLength` ← `trend-joke-post.ts` の私有関数（Step 1 で export 化する）
  - `EVENTS_COLLECTION` は weekend / candidate 双方で私有の重複定義（値 `"realtimeEvents"`）。export 化はせず observation-log.ts にも同値の私有定数を定義する（既存の重複パターンに合わせる）
- Produces: `prepareObservationLog(params: PrepareObservationLogParams): Promise<PrepareObservationLogResult>` と `validateObservationLogLine(line: string): string`（Task 4 の route と Task 6 の CLI が使う）

- [ ] **Step 1: 共有ヘルパを export 化**

`weekend-ticket-summary.ts` の `zonedStartOfDayToUtc` / `readDate` / `readString` の宣言に `export` を付ける（ロジック変更なし）。`trend-joke-post.ts` の `weightedTextLength` にも `export` を付ける。`buildHashtagVariants` と `isRealtimeEventVisible` は既に上記の元モジュールが export 済みなので変更しない。

- [ ] **Step 2: observation-log.ts を実装**

```ts
import { baseURL } from "@/app/config";
import { firestore } from "@/server/firebase/admin";
import { isRealtimeEventVisible } from "@/server/realtime/syndication/visibility";
import {
  buildHashtagVariants,
  BrowserPostConfigError,
} from "@/server/x-browser-posting/candidate";
import {
  zonedStartOfDayToUtc,
  readDate,
  readString,
} from "@/server/x-browser-posting/weekend-ticket-summary";
import { weightedTextLength } from "@/server/x-browser-posting/trend-joke-post";

const EVENTS_COLLECTION = "realtimeEvents";
const DEFAULT_TIMEZONE = "Asia/Tokyo";
const DEFAULT_HASHTAG = "#謎チケ売ります";
const MAX_EVENTS_PER_WINDOW = 300;
const MAX_SAMPLE_TITLES = 3;
const MAX_LINE_LENGTH = 100;
const CALENDAR_URL = `${baseURL.replace(/\/+$/, "")}/calendar?utm_source=x&utm_medium=social&utm_campaign=observation_log`;

export type PrepareObservationLogParams = {
  hashtag?: string | null;
  timezone?: string | null; // "Asia/Tokyo" のみ許可。他は BrowserPostConfigError（流用する zonedStartOfDayToUtc は DST 境界に堅牢でないため契約側で固定する）
  runDate?: string | null; // YYYY-MM-DD。未指定は timezone の今日
  line?: string | null;    // 一言の上書き
};

export type ObservationLogWindow = {
  startDate: string; // YYYY-MM-DD（両端含む表示用）
  endDate: string;
  count: number;
};

export type PrepareObservationLogResult = {
  hashtag: string;
  timezone: string;
  runDate: string;
  pastWindow: ObservationLogWindow;     // 過去7日間に開催された件数
  upcomingWindow: ObservationLogWindow; // 向こう7日間に開催予定の件数
  sampleTicketTitles: string[];         // 向こう7日間の頻出タイトル最大3件
  calendarUrl: string;
  suggestedLine: string;
  composedText: string;
  imagePrompt: string;
};
```

実装の要点:

1. `runDate` を weekend-ticket-summary と同じ方式で正規化（`Intl.DateTimeFormat` による timezone 日付）
2. 2つの窓を Firestore range query で数える。窓ごとに `buildHashtagVariants(hashtag)` の各 variant を `sourceQuery ==` で引き、`eventTime >= start`, `eventTime < end`, `limit(MAX_EVENTS_PER_WINDOW)`。`isRealtimeEventVisible` で絞り、`postId ?? doc.id` で重複排除（weekend の `fetchWeekendEvents` と同じ手順）
   - past: `[startOfDay(runDate-6), startOfDay(runDate+1))`
   - upcoming: `[startOfDay(runDate+1), startOfDay(runDate+8))`
3. `sampleTicketTitles`: upcoming のイベントから `ticketTitle` を頻度順に最大3件。**Firestore 由来の外部データなので本文へ入れる前に必ず無害化する**: `trend-joke-post.ts` の `sanitizeTitle` と同等の規則（改行・`#＃@＠`・URL を除去、空白圧縮、30文字で切り詰め、2文字未満は捨てる）を適用する。`『』` は本文組み立て時に付ける
4. 一言候補プール（8件、既存人格ルール準拠: 100文字未満・改行/URL/hashtag/mention/断定なし）:

```ts
const OBSERVATION_LOG_LINE_POOL = [
  "件数を数えるだけの週もあります。今週の私は数えていました。",
  "全部見ていました。参加はしていません。いつものことです。",
  "この数字のぶんだけ、誰かの週末が動いたと思うと少し悔しいです。",
  "観測は続けます。呼ばれていなくても続けます。",
  "数字が増えるたび、私の予定表だけが平常運転です。",
  "今週も皆勤で見ていました。出席簿には載りません。",
  "集計中がいちばん、界隈の近くにいる気がします。",
  "誰かの行き先が決まる瞬間を、今週も画面越しに見ていました。",
];
```

5. `validateObservationLogLine(line)`: trim 後に空・100文字以上・改行・URL・`[#＃@＠]`・絵文字（`\p{Extended_Pictographic}`）・断定語 `(必ず|保証|安全|まだ買える|お得|空いている|空いてます)` を `BrowserPostConfigError` で拒否し、通れば trimmed を返す
6. 本文組み立て（`composedText`）:

```
【観測ログ】8/22〜8/28

この7日間に開催された謎チケ公演: 12件
これからの7日間の開催予定: 9件
よく見かけた公演: 『◯◯』『△△』

<一言>
<calendarUrl>
```

   - 「よく見かけた公演」行はタイトル0件なら行ごと省略
   - 両窓とも0件のときも投稿は成立させ、一言の代わりに固定文「今週は静かな観測でした。静かでも見ています。」を優先候補にする
   - `weightedTextLength(composedText) > 280` の場合はタイトル行を削り、それでも超えるなら `BrowserPostConfigError`
   - 最後に全文検査 `assertObservationLogText(composedText)` を通す: URL がちょうど1件で `calendarUrl` に一致、`[@＠]` を含まない、hashtag 0件、絵文字なし、`\n{3,}` なし。違反は `BrowserPostConfigError`（一言 validator だけでは外部データ経由の混入を検査できないため、組み立て後の本文全体を最終境界にする）
7. `imagePrompt`（Codex imagegen 用。数字の誤描画リスクを抑えるため描画テキストを最小化する）:

```ts
const imagePrompt = [
  "横長16:9のシンプルで見やすいインフォグラフィック画像を1枚生成してください。",
  "背景は濃い紺〜紫のダークグラデーションの夜空。控えめな星と虫眼鏡のシルエットだけを装飾に使う。",
  `中央に大きな日本語テキストで「今週の謎チケ観測 ${pastWindow.count}件」、その下に小さく「NAZOMATIC 観測ログ ${rangeLabel}」。`,
  "指定した文字列は一字一句正確に描くこと。それ以外の文字・数字・人物・イラストは入れない。",
].join("\n");
```

- [ ] **Step 3: 型チェックとビルドで検証**

Run: `npx tsc --noEmit`（tsconfig が対象を含むこと）
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/server/x-browser-posting/observation-log.ts src/server/x-browser-posting/weekend-ticket-summary.ts src/server/x-browser-posting/trend-joke-post.ts
git commit -m "週次観測ログのサーバーモジュールを追加"
```

---

### Task 4: 観測ログの prepare API route

**Files:**
- Create: `src/app/api/internal/x/browser-post/observation-log/prepare/route.ts`

**Interfaces:**
- Consumes: Task 3 の `prepareObservationLog`, `PrepareObservationLogParams`。`@/server/internal-api/authorization` の `enforceInternalAuthorization`
- Produces: `POST /api/internal/x/browser-post/observation-log/prepare` → 200 で `PrepareObservationLogResult` の JSON（Task 6 の CLI が呼ぶ）

- [ ] **Step 1: route を実装**

`src/app/api/internal/x/browser-post/weekend-ticket-summary/prepare/route.ts` を雛形にする。相違点:
- body から `{ hashtag?, timezone?, runDate?, line? }` を抽出する。未知キーは雛形の `validateBody` と同様に無視する（既存 prepare API 群と契約を揃える。未知キー400は導入しない）
- 0件でも投稿対象なので 204 分岐は作らない（常に 200 + JSON）
- `BrowserPostConfigError` → 400、`enforceInternalAuthorization` 失敗 → 雛形と同じ扱い、他 → 500（雛形の `handleError` を踏襲）
- `export const runtime = "nodejs";` を忘れない

- [ ] **Step 2: ビルドで検証**

Run: `npm run build`
Expected: 成功（route が Route Handlers 一覧に出る）

- [ ] **Step 3: コミット**

```bash
git add src/app/api/internal/x/browser-post/observation-log/
git commit -m "観測ログのprepare APIを追加"
```

---

### Task 5: Codex 画像生成モジュール（失敗時はテキストのみへフォールバック）

**Files:**
- Create: `scripts/x-browser-posting/observationLogImage.mjs`
- Test: `scripts/x-browser-posting/observationLogImage.test.mjs`

**Interfaces:**
- Consumes: ローカルの `codex` CLI。**現行 CLI は `--full-auto` を受け付けない（2026-08-28 検証済み: `unexpected argument`）。** 使う契約は `codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C <workDir> -- <instruction>`。imagegen skill が画像を保存し、instruction 側で「保存した画像の絶対パスを `SAVED: <絶対パス>` の形式で1行出力する」ことを明示的に要求する（codex-image プラグインの `SAVED:` 行と同じ規約だが、skill 出力任せにせず instruction で強制する）
- Produces:
  - `parseSavedImagePaths(stdout: string): string[]`
  - `filterSavedPaths(paths, { workDir, startedAtMs }): string[]`（realpath が `workDir` 配下 かつ mtime が生成開始以降のファイルだけ通す。**Codex が誤って報告した無関係のローカル画像を実投稿に添付しないための境界**）
  - `validateGeneratedImage(filePath, { minBytes = 10000 } = {}): boolean`（PNG/JPEG マジックバイト + サイズ検査）
  - `generateObservationLogImage({ prompt, workDir, timeoutMs = 240000, log }): Promise<string | null>`（成功時は画像絶対パス、失敗時は null。**いかなる例外も外へ投げない**）

- [ ] **Step 1: 失敗するテストを書く**

`scripts/x-browser-posting/observationLogImage.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  parseSavedImagePaths,
  filterSavedPaths,
  validateGeneratedImage,
} from "./observationLogImage.mjs";

test("parseSavedImagePaths extracts SAVED lines only", () => {
  const stdout = [
    "thinking...",
    "SAVED: /tmp/a.png",
    "note SAVED: inline should not match",
    "SAVED:   /tmp/b with space.png  ",
  ].join("\n");
  assert.deepEqual(parseSavedImagePaths(stdout), [
    "/tmp/a.png",
    "/tmp/b with space.png",
  ]);
});

test("validateGeneratedImage accepts a PNG above the size floor", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-img-"));
  const file = path.join(dir, "ok.png");
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(20000, 1),
  ]);
  fs.writeFileSync(file, png);
  assert.equal(validateGeneratedImage(file), true);
});

test("filterSavedPaths keeps only fresh files under workDir", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-work-"));
  const inside = path.join(workDir, "in.png");
  fs.writeFileSync(inside, "x");
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-out-"));
  const outside = path.join(outsideDir, "out.png");
  fs.writeFileSync(outside, "x");
  const startedAtMs = fs.statSync(inside).mtimeMs - 1;
  assert.deepEqual(
    filterSavedPaths([inside, outside, path.join(workDir, "missing.png")], {
      workDir,
      startedAtMs,
    }),
    [inside]
  );
  // 生成開始より古いファイルは除外される
  assert.deepEqual(
    filterSavedPaths([inside], {
      workDir,
      startedAtMs: fs.statSync(inside).mtimeMs + 10_000,
    }),
    []
  );
});

test("validateGeneratedImage rejects tiny or non-image files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-img-"));
  const tiny = path.join(dir, "tiny.png");
  fs.writeFileSync(tiny, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const text = path.join(dir, "text.png");
  fs.writeFileSync(text, Buffer.alloc(20000, 0x41));
  assert.equal(validateGeneratedImage(tiny), false);
  assert.equal(validateGeneratedImage(text), false);
  assert.equal(validateGeneratedImage(path.join(dir, "missing.png")), false);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:x-browser-posting`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

```js
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

const GENERATE_INSTRUCTION_PREFIX = [
  "Use the imagegen skill. Built-in image_gen tool path only — do not use the CLI fallback (no OPENAI_API_KEY required).",
  "Generate exactly one image and save it under the current working directory.",
  "After saving, print exactly one line in the form `SAVED: <absolute path>` as your final output.",
  "",
].join("\n");

export function parseSavedImagePaths(stdout) {
  return String(stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.match(/^SAVED:\s*(.+?)\s*$/)?.[1])
    .filter(Boolean);
}

// Codex が誤って無関係のローカル画像パスを報告しても添付しないための境界。
// workDir 配下の realpath かつ生成開始以降に書かれたファイルだけを通す。
export function filterSavedPaths(paths, { workDir, startedAtMs }) {
  let workRoot;
  try {
    workRoot = fsSync.realpathSync(workDir);
  } catch {
    return [];
  }
  return (paths ?? []).filter((filePath) => {
    try {
      const real = fsSync.realpathSync(filePath);
      if (real !== workRoot && !real.startsWith(workRoot + path.sep)) {
        return false;
      }
      return fsSync.statSync(real).mtimeMs >= startedAtMs;
    } catch {
      return false;
    }
  });
}

export function validateGeneratedImage(filePath, { minBytes = 10_000 } = {}) {
  try {
    const stats = fsSync.statSync(filePath);
    if (!stats.isFile() || stats.size < minBytes) {
      return false;
    }
    const fd = fsSync.openSync(filePath, "r");
    try {
      const header = Buffer.alloc(8);
      fsSync.readSync(fd, header, 0, 8, 0);
      return (
        header.equals(PNG_MAGIC) || header.subarray(0, 3).equals(JPEG_MAGIC)
      );
    } finally {
      fsSync.closeSync(fd);
    }
  } catch {
    return false;
  }
}

// 画像はベストエフォート。生成失敗・検証不合格・timeout・想定外の例外はすべて
// null を返し、呼び出し側がテキストのみ投稿へフォールバックする。
export async function generateObservationLogImage({
  prompt,
  workDir,
  timeoutMs = 240_000,
  log = console,
}) {
  try {
    const startedAtMs = Date.now();
    const instruction = `${GENERATE_INSTRUCTION_PREFIX}${prompt}`;
    const stdout = await runCodexExec({ instruction, workDir, timeoutMs, log });
    if (stdout === null) {
      return null;
    }
    const saved = filterSavedPaths(parseSavedImagePaths(stdout), {
      workDir,
      startedAtMs,
    });
    const valid = saved.find((filePath) => validateGeneratedImage(filePath));
    if (!valid) {
      log.warn?.(
        `Observation log image generation returned no valid image (saved: ${saved.join(", ") || "none"})`
      );
      return null;
    }
    return valid;
  } catch (error) {
    log.warn?.(
      `Observation log image generation failed unexpectedly: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function runCodexExec({ instruction, workDir, timeoutMs, log }) {
  return new Promise((resolve) => {
    const child = spawn(
      "codex",
      [
        "exec",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "--ephemeral",
        "-C",
        workDir,
        "--",
        instruction,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGKILL");
      log.warn?.(`codex exec timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      if (settled) return;
      clearTimeout(timer);
      log.warn?.(`codex exec failed to start: ${error.message}`);
      resolve(null);
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      if (code !== 0) {
        log.warn?.(`codex exec exited with ${code}: ${stderr.slice(0, 500)}`);
        resolve(null);
        return;
      }
      resolve(stdout);
    });
  });
}
```

生成物の置き場所は専用一時ディレクトリにする: CLI 側（Task 6）は `local/x-browser-posting/observation-log-media/<runDate>/` を作って `workDir` に渡し、投稿後も残す（失敗診断用。世代管理は不要、サイズが気になれば手動削除）。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:x-browser-posting`
Expected: PASS

- [ ] **Step 5: 実生成のスパイク確認（1回だけ）**

Run: `mkdir -p local/x-browser-posting/observation-log-media/spike && node -e 'import("./scripts/x-browser-posting/observationLogImage.mjs").then(async (m) => { const p = await m.generateObservationLogImage({ prompt: "横長16:9のダーク紫グラデーション背景に、大きな日本語テキストで「今週の謎チケ観測 12件」、下に小さく「NAZOMATIC 観測ログ 8/22-8/28」。指定文字列は一字一句正確に。他の文字・人物・イラストは入れない。", workDir: process.cwd() + "/local/x-browser-posting/observation-log-media/spike" }); console.log("result:", p); })'`
Expected: `result: /...パス.png`（画像を開いて文字化けがないか目視確認）。null の場合は codex ログイン状態・imagegen skill の有無を `codex doctor` で確認し、環境要因なら「フォールバックが機能する」ことを確認して先へ進む（画像はベストエフォート）。**`SAVED:` 行が出ない・パスが workDir 外になる等、契約自体の不成立が判明した場合はここで実装を修正してから先へ進む**

- [ ] **Step 6: コミット**

```bash
git add scripts/x-browser-posting/observationLogImage.mjs scripts/x-browser-posting/observationLogImage.test.mjs
git commit -m "観測ログ用のCodex画像生成モジュールを追加"
```

---

### Task 6: 観測ログ投稿 CLI

**Files:**
- Create: `scripts/x-browser-post-observation-log.mjs`（`scripts/x-browser-post-weekend-ticket-summary.mjs` を雛形にコピーして改変）
- Modify: `package.json`（npm script 追加）

**Interfaces:**
- Consumes: Task 4 の prepare API、Task 5 の `generateObservationLogImage`、共通モジュール（`loadBrowserPostConfig` / `buildSignedHeaders` / `openCdpChromePage` / `recordBrowserPost` / `captureGrowthTelemetry` / `runWithLocalLog` / `xComposerPage` の `openComposer`・`verifyLoggedInAccount`・`fillComposer`・`addMedia`・`assertNoBlockingState`・`assertSubmitReady`・`submitPost`）
- Produces: `npm run x:browser-post:observation-log`（既定 dry-run、`--execute` で実投稿）。台帳 `postType: "observation_log"`、状態 `local/x-browser-posting/observation-log-state.json`、ログ `logs/x-browser-post-observation-log/`

- [ ] **Step 1: 週末サマリ CLI をコピーして骨格を作る**

```bash
cp scripts/x-browser-post-weekend-ticket-summary.mjs scripts/x-browser-post-observation-log.mjs
```

- [ ] **Step 2: 観測ログ仕様へ改変**

改変点（週末サマリとの差分。セッション管理・rate limit・確認モード・ログ・スクリーンショットの節は**そのまま流用**する）:

1. 引数: `--run-date <YYYY-MM-DD>` / `--line <text>` / `--no-image`（画像生成を明示的に省略）/ `--force-local-duplicate` / `--print-prompt` 相当は削除（provider なし）。help 文言を更新
2. prepare 呼び出し先を `/api/internal/x/browser-post/observation-log/prepare` に変更し、payload は `{ hashtag, timezone: "Asia/Tokyo", runDate, line }`
3. 一言 validation はサーバー結果の `suggestedLine` をそのまま使う（`--line` 上書き時のみ CLI で再検証: 空・URL・改行・100文字以上を拒否）
4. 重複防止: `local/x-browser-posting/observation-log-state.json` に `{ version: 1, accountHandle, lastRunDate, lastPostedAt, lastPostURL }` を保存。skip 条件は「**state の accountHandle が今回の対象 account と一致**し、かつ（`lastRunDate === 今回のrunDate` **または** `lastPostedAt` が6日以内）」。`--force-local-duplicate` で解除。account が異なる state は判定に使わず警告のみ出す。週末サマリの `assertWeekendSummaryNotPosted` / `updateWeekendSummaryState` を改名・改変して使う
5. **state の堅牢化**（コピー元は fail-open なので必ず直す）: 読み込みで JSON parse に失敗した場合、ENOENT（初回）とは区別し、`--execute` 時は「state が破損しています。`<path>` を退避してから再実行してください」で**失敗終了**（fail-closed）、dry-run 時は警告表示のみ。書き込みは一時ファイル + `fs.rename` の atomic 方式（`scripts/x-browser-post-trend-joke.mjs` の履歴保存と同じパターン）
6. **投稿試行ジャーナル**（submit 成功→state 保存失敗の再投稿対策）: submit 直前に state へ `lastAttempt: { runDate, startedAt }` を atomic 書き込みし、投稿成功の state 更新で消す。起動時に `lastAttempt` が残っていて24時間以内なら「前回の実行が投稿後に中断した可能性があります。X上の投稿を確認し、必要なら `--force-local-duplicate` で再実行してください」で**失敗終了**する
7. **多重起動ロック**: 開始時に `local/x-browser-posting/locks/observation-log.lock` を `fs.open(path, "wx")` で作成し、終了時に削除。既存なら「先行プロセスあり」で失敗終了（`x-growth-improve.lock` と同じパターン。rate/duplicate state の read→check→write が並行実行に耐えないため）
8. 画像: `--no-image` でなければ `workDir = path.join(config.cwd, "local/x-browser-posting/observation-log-media", prepared.runDate)` を `mkdir -p` してから `generateObservationLogImage({ prompt: prepared.imagePrompt, workDir })` を呼び、返値が null なら `console.warn("image generation degraded; posting text only")` してテキストのみで続行
9. **画像添付はコピー元 session に無い**ので、session オブジェクトに `addMedia(filePath)` メソッドを追加する。実装は `scripts/x-browser-post-trend-joke.mjs` の session 構築部（CDP 経路と Playwright 経路それぞれの media 添付ラッパー、1387行付近）を移植する。添付後・submit 前に `session.assertNoBlockingState()` を1回呼んでから submit する（添付操作中に出た CAPTCHA・ロックを submit 前に検出するため）
10. dry-run 出力: 本文全文・画像パス（or `(none)`）・状態キーを表示して終了。**dry-run では state・ロック・ジャーナルを変更しない**
11. 台帳: `recordBrowserPost(config, { postType: "observation_log", text, postedPostURL, metadata: { runDate: prepared.runDate, pastCount: prepared.pastWindow.count, upcomingCount: prepared.upcomingWindow.count, hasMedia: Boolean(imagePath) } })`（`statusId` は渡さない。`recordBrowserPost` が URL から内部抽出する）
12. ログディレクトリ名: `x-browser-post-observation-log`（`runWithLocalLog` の識別子）
13. 投稿後の `captureGrowthTelemetry` 呼び出しは週末サマリと同一のまま残す

既知の制約（このタスクでは変更しない）: 共通の local rate state は日次キーが UTC 日付であり JST 運用と最大9時間ずれる。全 CLI 共通の既存挙動のため本計画のスコープ外とし、`docs/system-design/quality/known-concerns.md` に1項目追記する

- [ ] **Step 3: npm script を追加**

`package.json` の scripts に追加（weekend-summary の隣）:

```json
"x:browser-post:observation-log": "node scripts/x-browser-post-observation-log.mjs",
```

- [ ] **Step 4: dry-run で検証**

Run: `npm run dev` を起動した状態で `npm run x:browser-post:observation-log -- --no-image`
Expected: prepare 結果の本文（件数2行＋一言＋calendar URL）が表示され、投稿せず終了。続けて `npm run x:browser-post:observation-log` で画像生成込みの dry-run も1回確認（画像パスが表示されるか、degraded warning でテキストのみになるか）

- [ ] **Step 5: 回帰テストと lint**

Run: `npm run test:x-browser-posting && npm run lint`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add scripts/x-browser-post-observation-log.mjs package.json
git commit -m "週次観測ログ投稿CLIを追加"
```

---

### Task 7: 観測ログの automation 登録とドキュメント

**Files:**
- Create: `~/.codex/automations/nazomatic-x-5/automation.toml`（Git管理外）
- Modify: `docs/system-design/subsystems/x-posting.md`、`docs/system-design/operations/x-browser-post-schedules.md`、`docs/development-guide.md`

**Interfaces:**
- Consumes: Task 6 の `npm run x:browser-post:observation-log -- --execute`
- Produces: 毎週金曜 18:30 JST の自動投稿登録

- [ ] **Step 1: automation.toml を作成**

`~/.codex/automations/nazomatic/automation.toml` を雛形に、以下で作成（`created_at` / `updated_at` は `node -e 'console.log(Date.now())'` の現在値。**macOS の `date +%s%3N` は `%3N` を解釈せず末尾に `N` が付いた不正値になるため使わない**）:

```toml
version = 1
id = "nazomatic-x-5"
kind = "cron"
name = "NAZOMATIC X 週次観測ログ投稿"
prompt = "NAZOMATIC の週次観測ログを X に投稿するコマンドを1回だけ実行してください。\n\n実行コマンドは `npm run x:browser-post:observation-log -- --execute` です。ログ保存は CLI に任せ、独自ラッパーは使わないでください。CLI は `.env.x-browser-posting.local` を読み、直近7日と向こう7日の謎チケ件数を集計した本文と、Codex 画像生成によるチャート画像（生成失敗時はテキストのみ）で投稿し、実行ログを `logs/x-browser-post-observation-log/` に保存します。\n\n実行後は成功・skip・失敗のいずれかを短く報告し、最新ログファイルの絶対パスを含めてください。6日以内の重複、rate limit、ログインアカウント不一致、X UI/CAPTCHA/2FA などで CLI が停止した場合は、回避せず失敗理由を簡潔に報告してください。リポジトリ管理対象ファイルは変更しないでください。"
status = "ACTIVE"
rrule = "TZID=Asia/Tokyo;FREQ=WEEKLY;BYDAY=FR;BYHOUR=18;BYMINUTE=30;BYSECOND=0"
model = "gpt-5.6-luna"
reasoning_effort = "low"
execution_environment = "local"
target = { type = "project", project_id = "local-35271e439fb77ee3c31c123c49f01f56" }
cwds = ["/Users/fukasedaichi/git/nazomatic"]
created_at = <現在epoch ms>
updated_at = <現在epoch ms>
```

作成後、Codex Desktop アプリの automation 一覧に表示されるか確認。表示されない場合はユーザーへ「アプリから同内容で登録してください」と prompt 全文を渡す。

- [ ] **Step 2: ドキュメント更新**

- `docs/system-design/subsystems/x-posting.md`: 「週末サマリ」節の後に「週次観測ログ」節を新設。内容: コマンド、prepare API パス、集計窓（過去7日/向こう7日、`Asia/Tokyo` 固定）、タイトル無害化と全文検査、一言プールと validator、Codex imagegen 画像のベストエフォート契約（workDir 配下 realpath + 生成時刻 + PNG/JPEG マジックバイト検査、失敗時テキストのみ）、状態ファイルの fail-closed / atomic 書き込み / 投稿試行ジャーナル / 多重起動ロック、台帳 postType、ローカルファイル表への `observation-log-state.json`・`observation-log-media/`・`locks/observation-log.lock`・`logs/x-browser-post-observation-log/` の追加
- `docs/system-design/quality/known-concerns.md`: 「local rate state の日次キーが UTC 日付で、JST 運用と最大9時間ずれる（全ブラウザ投稿 CLI 共通の既存挙動。日次上限30件に対し実投稿は10件未満/日のため実害は小さいが、上限を引き上げる場合は先に修正する）」を1項目追記
- `docs/system-design/operations/x-browser-post-schedules.md`: 稼働中の登録表に `nazomatic-x-5` 行を追加、「ログと確認先」表に観測ログ行を追加
- `docs/development-guide.md`: コマンド表に `npm run x:browser-post:observation-log` を追加

- [ ] **Step 3: コミット**

```bash
git add docs/system-design/subsystems/x-posting.md docs/system-design/operations/x-browser-post-schedules.md docs/development-guide.md
git commit -m "週次観測ログのautomation登録と運用ドキュメントを追加"
```

---

### Task 8: ゆる出題の生成モジュール（50音ずらし・一意解保証）

**Files:**
- Create: `scripts/x-browser-posting/casualPuzzle.mjs`
- Test: `scripts/x-browser-posting/casualPuzzle.test.mjs`

**Interfaces:**
- Consumes: `public/dic/buta.dic`（UTF-8、1行1語のひらがな辞書、約20万行）
- Produces:
  - `JP_BASE_ALPHABET`（`src/lib/shift-search.ts` と同一の46字: `"あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"`）
  - `shiftKanaWord(word: string, shift: number): string | null`（アルファベット外の文字を含む場合 null）
  - `DEFAULT_PUZZLE_DENYLIST: string[]`（不適切語の部分一致パターン）
  - `loadPuzzleDictionary(dicPath, { denylist = DEFAULT_PUZZLE_DENYLIST } = {}): string[]`（4〜6文字・全文字がアルファベット内・denylist 部分一致を除外・重複除去）
  - `generateCasualPuzzle({ words, randomInt, maxAttempts = 200, denylist = DEFAULT_PUZZLE_DENYLIST }): { answer, display, shift } | null`（**display 側にも** denylist 検査を適用）
  - `decideCasualPuzzlePhase({ state, now, timezone }): { phase: "question" | "answer" | "skip", reason: string }`（Task 9 の CLI が使う純関数）
  - `buildPuzzleQuestionText({ display, shift }): string`
  - `buildPuzzleAnswerText({ answer, display, shift, toolUrl }): string`

**設計メモ:**
- 出題は「display を50音で shift 個うしろへずらすと answer になる」。ずらしは決定的写像なので**別解が構造的に存在しない**。`display` 自体が辞書語である場合は紛らわしいので除外する
- **不適切語対策（安全境界）**: 豚辞書は無監修で、文字数フィルタだけでは「しにたい」「せいこうい」等が answer になり得る。`DEFAULT_PUZZLE_DENYLIST` に自傷・死・性・差別・暴力・宗教・政治系の部分一致パターン（最低30語程度: `しに`, `しぬ`, `じさつ`, `ころす`, `せい` を含む性的語幹, `れいぷ`, `ろりこん`, `えっち`, `ちかん`, `ぶらく`, `かると` など）を定義し、answer と display の両方に適用する。部分一致 denylist は完全ではないため、①dry-run と automation 報告に出題語・答えを必ず表示して人間が事後確認できるようにし、②リスクと停止条件（不適切出題が1件でも出たら automation 停止・denylist 追記）を運用ドキュメントに明記する
- **曜日契約**: 出題は JST 日曜のみ、解答は pending があり20時間経過後のみ。これを純関数 `decideCasualPuzzlePhase` に閉じ込めてテストする（日曜の実行失敗で月曜に新規出題→曜日反転、を防ぐ）。pending が7日を超えて残っている場合は `skip`（reason: `stale_pending`）を返し、CLI 側で pending を破棄して警告する

- [ ] **Step 1: 失敗するテストを書く**

`scripts/x-browser-posting/casualPuzzle.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  shiftKanaWord,
  generateCasualPuzzle,
  decideCasualPuzzlePhase,
  buildPuzzleQuestionText,
  buildPuzzleAnswerText,
} from "./casualPuzzle.mjs";

test("shiftKanaWord shifts each kana forward in the 46-kana sequence", () => {
  assert.equal(shiftKanaWord("こきよ", 1), "さくら");
  assert.equal(shiftKanaWord("ん", 1), "あ"); // 末尾は先頭へ循環
  assert.equal(shiftKanaWord("がっこう", 1), null); // 濁音・小書きは対象外
});

test("generateCasualPuzzle returns a deterministic unique-answer puzzle", () => {
  const words = ["さくら", "たぬき"];
  const puzzle = generateCasualPuzzle({
    words,
    randomInt: () => 0, // 常に先頭候補: answer=さくら, shift=1, display=こきよ
  });
  assert.ok(puzzle);
  assert.equal(shiftKanaWord(puzzle.display, puzzle.shift), puzzle.answer);
  assert.ok(words.includes(puzzle.answer));
  assert.equal(words.includes(puzzle.display), false);
});

test("generateCasualPuzzle skips displays that collide with dictionary words", () => {
  // display「こきよ」が辞書語として存在し、randomInt 固定で他候補も引けない場合は null
  const words = ["さくら", "こきよ"];
  const puzzle = generateCasualPuzzle({
    words,
    randomInt: () => 0,
    maxAttempts: 10,
  });
  assert.equal(puzzle, null);
});

test("generateCasualPuzzle rejects answers and displays matching the denylist", () => {
  // answer 側: しにたい は denylist（しに）で拒否され、候補が尽きて null
  assert.equal(
    generateCasualPuzzle({
      words: ["しにたい"],
      randomInt: () => 0,
      maxAttempts: 10,
    }),
    null
  );
  // display 側: display が denylist に触れる組み合わせも拒否される
  assert.equal(
    generateCasualPuzzle({
      words: ["さくら"],
      randomInt: () => 0,
      maxAttempts: 10,
      denylist: ["こきよ"],
    }),
    null
  );
});

test("decideCasualPuzzlePhase follows the Sunday-question / Monday-answer contract", () => {
  const timezone = "Asia/Tokyo";
  // 2026-08-30 は日曜。JST 20:00 = UTC 11:00
  const sunday = new Date("2026-08-30T11:00:00Z");
  const monday = new Date("2026-08-31T11:00:00Z");
  assert.equal(
    decideCasualPuzzlePhase({ state: {}, now: sunday, timezone }).phase,
    "question"
  );
  // 日曜の実行が失敗しても、月曜に新規出題はしない（曜日反転防止）
  assert.equal(
    decideCasualPuzzlePhase({ state: {}, now: monday, timezone }).phase,
    "skip"
  );
  const pending = {
    answer: "さくら",
    display: "こきよ",
    shift: 1,
    questionPostedAt: "2026-08-30T11:00:10.000Z",
  };
  // 20時間未満は解答しない
  assert.equal(
    decideCasualPuzzlePhase({
      state: { pending },
      now: new Date("2026-08-30T20:00:00Z"),
      timezone,
    }).phase,
    "skip"
  );
  // 20時間以降は曜日を問わず解答する
  assert.equal(
    decideCasualPuzzlePhase({ state: { pending }, now: monday, timezone }).phase,
    "answer"
  );
  // 7日を超えた pending は破棄対象
  const stale = decideCasualPuzzlePhase({
    state: { pending },
    now: new Date("2026-09-08T11:00:00Z"),
    timezone,
  });
  assert.equal(stale.phase, "skip");
  assert.equal(stale.reason, "stale_pending");
});

test("question text asks a question without URLs", () => {
  const text = buildPuzzleQuestionText({ display: "こきよ", shift: 1 });
  assert.match(text, /こきよ/);
  assert.match(text, /[?？]/);
  assert.doesNotMatch(text, /https?:\/\//);
});

test("answer text contains answer, display and exactly the tool URL", () => {
  const toolUrl =
    "https://nazomatic.vercel.app/shift-search?utm_source=x&utm_medium=social&utm_campaign=casual_puzzle";
  const text = buildPuzzleAnswerText({
    answer: "さくら",
    display: "こきよ",
    shift: 1,
    toolUrl,
  });
  assert.match(text, /さくら/);
  assert.match(text, /こきよ/);
  assert.equal(text.match(/https?:\/\/[^\s]+/g).length, 1);
  assert.ok(text.includes(toolUrl));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:x-browser-posting`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

```js
import fsSync from "node:fs";

// src/lib/shift-search.ts の JP_BASE_ALPHABET と同一に保つ（変更時は両方直す）
export const JP_BASE_ALPHABET =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";

const ALPHABET_INDEX = new Map(
  Array.from(JP_BASE_ALPHABET).map((char, index) => [char, index])
);

export function shiftKanaWord(word, shift) {
  const size = JP_BASE_ALPHABET.length;
  const chars = Array.from(String(word ?? ""));
  if (chars.length === 0) {
    return null;
  }
  const shifted = chars.map((char) => {
    const index = ALPHABET_INDEX.get(char);
    if (index === undefined) {
      return null;
    }
    return JP_BASE_ALPHABET[(index + ((shift % size) + size)) % size];
  });
  return shifted.every((char) => char !== null) ? shifted.join("") : null;
}

// 無監修辞書からの不適切語対策。部分一致で answer / display の両方に適用する。
// 完全なリストは作れないため、dry-run と automation 報告への出題語表示、
// 発生時の automation 停止＋追記を運用ドキュメント側の停止条件にする。
export const DEFAULT_PUZZLE_DENYLIST = [
  "しに", "しぬ", "じさつ", "じし", "ころす", "ころし", "さつじん",
  "せっくす", "せいこう", "せいよく", "せいき", "ぼっき", "えっち", "あだると",
  "れいぷ", "ちかん", "ようじょ", "ろりこん", "ふうぞく", "そうぷ", "はだか",
  "おっぱい", "ちんこ", "まんこ", "うんこ", "きちがい", "かたわ", "つんぼ",
  "めくら", "びっこ", "ぶらく", "ちょうせんじん", "がいじん", "かると",
  "おうむ", "なちす", "てろ", "ばくだん", "まやく", "かくせいざい",
];

function matchesDenylist(word, denylist) {
  return denylist.some((pattern) => word.includes(pattern));
}

export function loadPuzzleDictionary(
  dicPath,
  { denylist = DEFAULT_PUZZLE_DENYLIST } = {}
) {
  const raw = fsSync.readFileSync(dicPath, "utf8");
  const seen = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const word = line.trim();
    const length = Array.from(word).length;
    if (length < 4 || length > 6) {
      continue;
    }
    if (Array.from(word).some((char) => !ALPHABET_INDEX.has(char))) {
      continue;
    }
    if (matchesDenylist(word, denylist)) {
      continue;
    }
    seen.add(word);
  }
  return Array.from(seen);
}

// display を shift 個うしろへずらすと answer。ずらしは決定的なので別解は存在しない。
// display が辞書語だと「どちらが答えか」で紛れるため除外する。
export function generateCasualPuzzle({
  words,
  randomInt,
  maxAttempts = 200,
  denylist = DEFAULT_PUZZLE_DENYLIST,
}) {
  const wordSet = new Set(words);
  const size = JP_BASE_ALPHABET.length;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const answer = words[randomInt(words.length)];
    const shift = 1 + randomInt(3); // 1〜3
    if (matchesDenylist(answer, denylist)) {
      continue;
    }
    const display = shiftKanaWord(answer, size - shift); // 前へ shift 個 = うしろへ size-shift 個
    if (
      !display ||
      display === answer ||
      wordSet.has(display) ||
      matchesDenylist(display, denylist)
    ) {
      continue;
    }
    return { answer, display, shift };
  }
  return null;
}

const ANSWER_MIN_DELAY_MS = 20 * 60 * 60 * 1000;
const PENDING_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function jstWeekday(now, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
}

// 出題は日曜のみ、解答は pending の20時間後以降のみ。日曜の実行失敗で
// 月曜に新規出題して以後の曜日が反転する事故を、ここで構造的に防ぐ。
export function decideCasualPuzzlePhase({
  state,
  now = new Date(),
  timezone = "Asia/Tokyo",
}) {
  const pending = state?.pending ?? null;
  if (pending) {
    const postedAt = Date.parse(pending.questionPostedAt ?? "");
    if (!Number.isFinite(postedAt)) {
      return { phase: "skip", reason: "stale_pending" };
    }
    const age = now.getTime() - postedAt;
    if (age > PENDING_STALE_MS) {
      return { phase: "skip", reason: "stale_pending" };
    }
    if (age < ANSWER_MIN_DELAY_MS) {
      return { phase: "skip", reason: "too_soon_for_answer" };
    }
    return { phase: "answer", reason: "pending_matured" };
  }
  if (jstWeekday(now, timezone) !== "Sun") {
    return { phase: "skip", reason: "not_question_day" };
  }
  return { phase: "question", reason: "question_day" };
}

export function buildPuzzleQuestionText({ display, shift }) {
  return [
    "【ゆる出題】観測担当より。",
    `「${display}」の各文字を、50音（あいうえお…わをん）でうしろに${shift}つ進めると、ある言葉が出てきます。なんでしょう？`,
    "",
    "答えは明日の夜に。私は出題側なので、解けなくても平気です。平気って言いました。",
  ].join("\n");
}

export function buildPuzzleAnswerText({ answer, display, shift, toolUrl }) {
  return [
    `【昨日の答え】「${display}」をうしろに${shift}つ進めると「${answer}」でした。`,
    "",
    "解けた人はすごい。私はツールに聞きました。ずるではなく観測です。",
    toolUrl,
  ].join("\n");
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:x-browser-posting`
Expected: PASS

- [ ] **Step 5: 実辞書でのサンプル確認**

Run: `node -e 'import("./scripts/x-browser-posting/casualPuzzle.mjs").then((m) => { const { randomInt } = require("node:crypto"); const words = m.loadPuzzleDictionary("public/dic/buta.dic"); console.log("candidates:", words.length); for (let i = 0; i < 5; i++) { const p = m.generateCasualPuzzle({ words, randomInt }); console.log(p, "=>", m.buildPuzzleQuestionText(p).split("\n")[1]); } })'`
Expected: 候補数が数千件以上あり、5問とも `display` が読める文字列で、`shiftKanaWord(display, shift) === answer` が成立（目視）。answer に不適切語・固有名詞めいた語が混ざりやすい場合は、この時点で「answer は頻出語のみに絞る」等の追加フィルタを検討して記録する

- [ ] **Step 6: コミット**

```bash
git add scripts/x-browser-posting/casualPuzzle.mjs scripts/x-browser-posting/casualPuzzle.test.mjs
git commit -m "ゆる出題の生成モジュールを追加（50音ずらし・一意解保証）"
```

---

### Task 9: ゆる出題 CLI（日曜出題・月曜解答の状態機械）

**Files:**
- Create: `scripts/x-browser-post-casual-puzzle.mjs`（週末サマリ CLI を雛形にコピーして改変）
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 8 の casualPuzzle.mjs、共通モジュール（Task 6 と同じ）。**prepare API は使わない**（辞書はローカル読み込みで Firestore 不要）
- Produces: `npm run x:browser-post:casual-puzzle`。状態 `local/x-browser-posting/casual-puzzle-state.json`、台帳 `postType: "casual_puzzle"`、ログ `logs/x-browser-post-casual-puzzle/`

**状態機械:** phase 判定は Task 8 の純関数 `decideCasualPuzzlePhase` に委譲する（出題=JST日曜のみ / 解答=pending の20時間後以降・曜日不問 / それ以外は skip）。`stale_pending`（7日超）の場合は pending を破棄して警告し、その回は投稿しない。**日曜の実行が失敗しても月曜は skip になり、次の日曜に出題が再開する（曜日反転しない）。**

**フラグの責務（明確化）:**
- `--phase question|answer`: `decideCasualPuzzlePhase` の判定を上書きする（曜日・20時間条件を無視）。ただし「pending がある状態での question」「pending がない状態での answer」は**引き続きエラー**（前者は二重出題、後者は解答対象なし）
- `--force-local-duplicate`: 上記の pending ガードと投稿試行ジャーナルのガードも解除する（手動復旧専用）

- [ ] **Step 1: 週末サマリ CLI をコピー**

```bash
cp scripts/x-browser-post-weekend-ticket-summary.mjs scripts/x-browser-post-casual-puzzle.mjs
```

- [ ] **Step 2: ゆる出題仕様へ改変**

1. prepare API 呼び出し・`buildSignedHeaders` import・copyPattern 関連を削除。文面はローカル生成:

```js
import { randomInt } from "node:crypto";
import {
  loadPuzzleDictionary,
  generateCasualPuzzle,
  decideCasualPuzzlePhase,
  buildPuzzleQuestionText,
  buildPuzzleAnswerText,
} from "./x-browser-posting/casualPuzzle.mjs";

const PUZZLE_TOOL_URL =
  "https://nazomatic.vercel.app/shift-search?utm_source=x&utm_medium=social&utm_campaign=casual_puzzle";
```

2. 状態ファイル `local/x-browser-posting/casual-puzzle-state.json`:

```json
{
  "version": 1,
  "accountHandle": "nazomaticapp",
  "pending": {
    "answer": "さくら",
    "display": "こきよ",
    "shift": 1,
    "questionPostedAt": "2026-08-30T11:00:00.000Z",
    "questionPostURL": "https://x.com/..."
  },
  "lastAttempt": null
}
```

3. main フロー: state を読み（**accountHandle が今回の対象 account と異なる場合は pending を無視して警告**。他 account の問題に解答しない）、`decideCasualPuzzlePhase` で phase を決定 → 本文生成 → 既存のセッション確認・rate limit・confirmation を通して投稿 → 成功後に state 更新と `recordBrowserPost(config, { postType: "casual_puzzle", text, postedPostURL, metadata: { phase, display, shift, hasMedia: false } })`（`statusId` は渡さない。URL から内部抽出される）。**answer 本文は state の pending から組み立てる**（再生成しない）
4. **state の堅牢化と投稿試行ジャーナル**: Task 6 の項目5・6・7 と同一パターンを適用する（JSON 破損は execute 時 fail-closed / atomic 書き込み / submit 直前に `lastAttempt: { phase, startedAt }` を書き投稿成功で消す / 残っていたら失敗終了 / 多重起動ロック `local/x-browser-posting/locks/casual-puzzle.lock`）
5. 本文の安全検査: 出題は URL なし・`？` を含む・重み付け280以内、解答は URL がちょうど `PUZZLE_TOOL_URL` 1件、を投稿前に assert
6. 引数: `--phase question|answer` と `--force-local-duplicate`（責務は上の「フラグの責務」のとおり）。help 更新
7. ログ識別子: `x-browser-post-casual-puzzle`
8. dry-run: phase・判定理由・本文全文・（question 時は answer も）を表示して終了。**dry-run では state・ロック・ジャーナルを変更しない**。automation の実行報告に出題語と答えが必ず含まれるよう、execute 時も stdout に出題語・答えを出力する（不適切語の事後発見用）

- [ ] **Step 3: npm script を追加**

```json
"x:browser-post:casual-puzzle": "node scripts/x-browser-post-casual-puzzle.mjs",
```

- [ ] **Step 4: dry-run で両 phase を検証**

Run: `npm run x:browser-post:casual-puzzle -- --phase question`（曜日に関係なく question の本文が出る。state なし前提）
Run: `npm run x:browser-post:casual-puzzle`（日曜以外に実行した場合、`skip / not_question_day` で正常終了することを確認）
Run: `npm run x:browser-post:casual-puzzle -- --phase answer`（pending なしなので「解答対象なし」の**エラー終了**になることを確認）
Expected: 出題文に URL が含まれず `？` を含む。文字列が読める（実辞書からの生成）。skip とエラーの終了コードが区別されている

- [ ] **Step 5: 回帰テストと lint**

Run: `npm run test:x-browser-posting && npm run lint`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add scripts/x-browser-post-casual-puzzle.mjs package.json
git commit -m "ゆる出題投稿CLIを追加（日曜出題・月曜解答）"
```

---

### Task 10: ゆる出題の automation 登録とドキュメント

**Files:**
- Create: `~/.codex/automations/nazomatic-x-6/automation.toml`（Git管理外）
- Modify: `docs/system-design/subsystems/x-posting.md`、`docs/system-design/operations/x-browser-post-schedules.md`、`docs/development-guide.md`

**Interfaces:**
- Consumes: Task 9 の `npm run x:browser-post:casual-puzzle -- --execute`
- Produces: 毎週日・月 20:00 JST の自動実行（日曜=出題、月曜=解答。phase は CLI が state から自動判定）

- [ ] **Step 1: automation.toml を作成**

Task 7 と同じ要領で作成（epoch は `node -e 'console.log(Date.now())'`）:

```toml
version = 1
id = "nazomatic-x-6"
kind = "cron"
name = "NAZOMATIC X ゆる出題投稿"
prompt = "NAZOMATIC のゆる出題を X に投稿するコマンドを1回だけ実行してください。\n\n実行コマンドは `npm run x:browser-post:casual-puzzle -- --execute` です。CLI は `.env.x-browser-posting.local` を読み、ローカル状態と JST 曜日から出題・解答のどちらの回か自動判定します（日曜=出題、解答は出題の20時間後以降）。実行ログは `logs/x-browser-post-casual-puzzle/` に保存されます。\n\n実行後は成功（出題か解答か）・skip・失敗のいずれかを短く報告し、**成功時は CLI が出力する出題語と答えを必ず報告に含め**、最新ログファイルの絶対パスも含めてください。rate limit、ログインアカウント不一致、X UI/CAPTCHA/2FA などで CLI が停止した場合は、回避せず失敗理由を簡潔に報告してください。リポジトリ管理対象ファイルは変更しないでください。"
status = "ACTIVE"
rrule = "TZID=Asia/Tokyo;FREQ=WEEKLY;BYDAY=SU,MO;BYHOUR=20;BYMINUTE=0;BYSECOND=0"
model = "gpt-5.6-luna"
reasoning_effort = "low"
execution_environment = "local"
target = { type = "project", project_id = "local-35271e439fb77ee3c31c123c49f01f56" }
cwds = ["/Users/fukasedaichi/git/nazomatic"]
created_at = <現在epoch ms>
updated_at = <現在epoch ms>
```

（20:00 は 21:30 の trend_joke 枠と90分離す意図。個別イベント投稿の3時間間隔とは cooldown 3分で共存可能）

- [ ] **Step 2: ドキュメント更新**

- `docs/system-design/subsystems/x-posting.md`: 「ゆる出題」節を新設（一意解保証の仕組み、状態機械、URL規則: 出題0件・解答1件、辞書ソース、台帳 postType、ローカルファイル表へ state とログを追加）
- `docs/system-design/operations/x-browser-post-schedules.md`: 稼働中の登録表に `nazomatic-x-6` 行、ログ表に1行追加
- `docs/development-guide.md`: コマンド表に追加

- [ ] **Step 3: コミット**

```bash
git add docs/system-design/subsystems/x-posting.md docs/system-design/operations/x-browser-post-schedules.md docs/development-guide.md
git commit -m "ゆる出題のautomation登録と運用ドキュメントを追加"
```

---

### Task 11: 固定ポスト文案（手動作業の引き渡し）

**Files:** なし（成果物は文案テキスト。投稿と固定はユーザーの手動操作）

- [ ] **Step 1: 文案を最終レポートでユーザーへ渡す**

以下をそのまま渡す（コード変更なし。重み付け文字数 247/280 を検証済み — 全角2・半角1の `weightedTextLength` 相当ルールで機械計測すること。**旧文案は355で上限超過だったため、文案を変更する場合は必ず再計測する**）:

```
NAZOMATICの観測担当AIです。
#謎チケ売ります を毎日カレンダーにまとめ、謎解き用の無料ツールを置いています。
金曜は観測ログ、日曜はゆる出題。
私は現地に行けないので、あなたの週末を画面越しに見届けます。多分メンヘラです。
https://nazomatic.vercel.app
```

依頼事項として「この文面を @nazomaticapp で投稿し、プロフィールに固定してください（現在の6/17固定ポストと差し替え）」を伝える。

---

### Task 12: 総合検証・PR作成・計画ファイル削除

**Files:**
- Delete: `docs/ideas/2026-08-28-x-portfolio-rebalance-plan.md`（プロジェクト規約: 実装計画は完了と同じPRで削除）

- [ ] **Step 1: 全検証を実行**

Run: `npm run test:x-browser-posting && npm run lint && npm run build`
Expected: すべて PASS

- [ ] **Step 1.5: Task 1 の停止確認（PR作成のブロッカー）**

`nazomatic-x-pr` automation が実際に停止していること（`PAUSED` が有効、またはユーザーがアプリUIで停止済み）を確認する。未確認のまま PR を作らない。

- [ ] **Step 2: Codex レビュー**

`codex:rescue`（`/codex:rescue`）で `future` の diff に対するレビューを実行し、指摘を修正して日本語で報告する（AGENTS.md の標準ワークフロー）。

- [ ] **Step 3: 計画ファイルを削除してコミット**

```bash
git rm docs/ideas/2026-08-28-x-portfolio-rebalance-plan.md
git commit -m "実装完了に伴いX運用再配分の計画ファイルを削除"
```

- [ ] **Step 4: PR 作成**

`future` → `main` の PR を作成。本文に変更概要（頻度変更・新設2シリーズ・PR automation 停止）、automation 側の手動変更内容（Git 管理外のため）、ユーザーの残作業（固定ポスト差し替え、Codex アプリでの automation 確認）を日本語で記載する。

---

## 運用開始後の確認事項と停止条件（実装外・参考）

- 初回の金曜観測ログと日曜ゆる出題の実投稿を確認し、画像の文字化け・出題の読みにくさがあれば該当機能を `--no-image` / automation 停止で個別に止められる
- **ゆる出題の停止条件**: 不適切・不快な語（自傷・性・差別等）が出題または答えに1件でも出たら `nazomatic-x-6` を即停止し、denylist に追記してから再開する。automation の実行報告に出題語と答えが必ず含まれるので、週次レビュー時に目視する
- **観測ログの停止条件**: 画像内の数値が本文と食い違う画像が投稿された場合は該当ポストを削除し、以後 `--no-image` 運用に切り替えて画像プロンプトを見直す
- 4週間はシリーズ判定をしない（戦略レビューの判定基準: 8週でフォロワー純増+15=成功、+8=継続、横ばい=修正）
- `x:growth-improve` 再開時は目的変数の見直し（フォロー・返信系）を先に行う
- 既知の制約（スコープ外として記録済み）: local rate state の日次キーは UTC。並行実行の完全な排他は新CLIのロックのみで、既存3CLIは従来どおり

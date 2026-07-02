# トレンドネタ投稿 最小修理(codex復旧+実イベント名織り込み) 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 壊れている codex 文案生成を復旧し、検索で取得済みの実イベント名を1つ織り込む・直近履歴の温度とオチを避けるプロンプトにして、トレンドネタ投稿の鮮度と検索露出を取り戻す。

**Architecture:** 変更は3ファイルのみ。CLI (`scripts/x-browser-post-trend-joke.mjs`) の codex 起動引数修正と provider プロンプトへの履歴ヒント追加、server (`src/server/x-browser-posting/trend-joke-post.ts`) の `buildTrendJokeCopyPrompt` への織り込み指示追加、設計ドキュメントの追随。validator・fallback プール・prepare API の形式は一切変えない。

**Tech Stack:** Node.js (.mjs スクリプト), Next.js App Router (TypeScript), Codex CLI (`codex exec`)

**Spec:** `docs/superpowers/specs/2026-07-02-trend-joke-codex-fix-design.md`

## Global Constraints

- validator は server / CLI とも変更しない。
- prepare API のリクエスト/レスポンス形式は不変(`copyPrompt` の文言だけ変わる)。
- Firestore read/write 0 を維持。ローカル state / 履歴ファイルの schema も不変。
- fallback 候補プール(25候補・10温度)は変更しない。
- 新規 npm dependency を追加しない。
- 対人インタラクション(返信・引用・メンション)機能は追加しない。
- `docs/` 配下は日本語。
- ブランチ `future` 上でタスクごとにコミットする。
- テストフレームワークは無いので、検証は `npm run lint`・`npx tsc --noEmit`・CLI dry-run で行う(プロジェクト規約)。
- dry-run は prepare API (`${apiBaseUrl}/api/internal/x/browser-post/trend-joke/prepare`) に接続する。毎日の automation が動いている環境なので通常はそのまま動く。`fetch failed` / `ECONNREFUSED` になる場合だけ、別ターミナルで `npm run dev` を起動してから再実行する。
- dry-run はログイン済み Chrome プロフィールで X の投稿画面を開き本文を入力するが、`--execute` を付けない限り投稿しない。

---

### Task 1: codex 起動フラグ修正

**Files:**
- Modify: `scripts/x-browser-post-trend-joke.mjs:549-566` (`runCodexTrendJokeProvider` 内の引数組み立て)

**Interfaces:**
- Consumes: なし(独立タスク)
- Produces: `codex exec` が exit 0 で動く invocation。後続タスクの dry-run 検証はこれに依存する。

- [ ] **Step 1: 現行の壊れ方を再現する(red)**

ブラウザを起動せず、CLI と同じ引数で codex を直接呼ぶ:

```bash
echo "テスト" | codex exec --sandbox read-only --ask-for-approval never --ephemeral - 2>&1 | head -3
```

期待: `error: unexpected argument '--ask-for-approval' found` が出る(exit 2)。

- [ ] **Step 2: フラグを削除する**

`scripts/x-browser-post-trend-joke.mjs` の `runCodexTrendJokeProvider` 内、以下の old を new に置換:

old:
```js
    args.push(
      "--cd",
      config.cwd,
      "--sandbox",
      "read-only",
      "--ask-for-approval",
      "never",
      "--ephemeral",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "-"
    );
```

new:
```js
    args.push(
      "--cd",
      config.cwd,
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "-"
    );
```

補足: 現行 Codex CLI の `codex exec` は非対話実行が既定なので、approval 系フラグ自体が不要。`--sandbox read-only`・`--ephemeral`・`--output-schema`・`--output-last-message`・`--cd` は現行 CLI に存在することを確認済み。

- [ ] **Step 3: 修正後の invocation が通ることを確認する(green)**

```bash
echo "「テスト成功」という文字列だけを返してください。" | codex exec --sandbox read-only --ephemeral - 2>&1 | tail -5
```

期待: エラーなく応答テキストが出力される(exit 0)。

- [ ] **Step 4: リポジトリに他の使用箇所が残っていないことを確認する**

```bash
grep -rn "ask-for-approval" scripts/ src/
```

期待: ヒット 0 件(docs 内の記述は Task 4 で更新する)。

- [ ] **Step 5: Commit**

```bash
git add scripts/x-browser-post-trend-joke.mjs
git commit -m "Fix codex provider invocation broken by Codex CLI flag removal"
```

---

### Task 2: server プロンプトに実イベント名織り込み指示を追加

**Files:**
- Modify: `src/server/x-browser-posting/trend-joke-post.ts:855` (`buildTrendJokeCopyPrompt` の「条件:」ブロック)

**Interfaces:**
- Consumes: なし(独立タスク。検証は Task 1 完了後の dry-run が楽)
- Produces: prepare API が返す `copyPrompt` に織り込み指示4行が含まれる。Task 5 の統合検証がこの文言を確認する。

- [ ] **Step 1: 条件行を置き換える**

`buildTrendJokeCopyPrompt` 内、以下の old(1行)を new(4行)に置換:

old:
```ts
    "- 実在イベント名に触れる場合も、作品批評ではなくタイトルの語感への反応に留める。具体的な流行やイベント名を捏造しない。",
```

new:
```ts
    "- 上の「イベント名サンプル」に実在の公演名として自然なものがあれば、その中から1つだけ選んで本文に織り込む。語感への憧れ・反応として褒め寄りにし、作品批評はしない。",
    "- サンプルにない名前は使わない（イベント名や流行の捏造禁止）。「〜募集」「〜繋がりたい」のような募集・交流の定型文はイベント名として扱わない。",
    "- 実在の公演名として自然なサンプルが1つもなければ、従来どおりイベント名なしで書く。",
    "- RT・拡散・フォローを求める文言は入れない。",
```

- [ ] **Step 2: 型・lint チェック**

```bash
npx tsc --noEmit && npm run lint
```

期待: 両方エラーなし。

- [ ] **Step 3: copyPrompt に新指示が載ることを確認する**

```bash
npm run x:browser-post:trend-joke -- --print-prompt
```

(既定 provider は fallback なので codex は呼ばれない。ブラウザが開き dry-run が走る。)

期待: 出力の `Copy prompt:` セクションに「1つだけ選んで本文に織り込む」「募集・交流の定型文はイベント名として扱わない」の行が含まれ、`Dry-run complete. No post was submitted.` で終わる。

- [ ] **Step 4: Commit**

```bash
git add src/server/x-browser-posting/trend-joke-post.ts
git commit -m "Instruct copy prompt to weave one real event title, praise-only"
```

---

### Task 3: CLI provider プロンプトに直近履歴ヒントを追加

**Files:**
- Modify: `scripts/x-browser-post-trend-joke.mjs:96-103` (main の `selectTrendJokeCopy` 呼び出し)
- Modify: `scripts/x-browser-post-trend-joke.mjs:409-437` (`selectTrendJokeCopy`)
- Modify: `scripts/x-browser-post-trend-joke.mjs:465-481` (`generateTrendJokeProviderCandidates`)
- Modify: `scripts/x-browser-post-trend-joke.mjs:516-536` (`buildTrendJokeProviderPrompt`)
- Modify: `scripts/x-browser-post-trend-joke.mjs` の `printHelp` 内 `--print-prompt` 説明行

**Interfaces:**
- Consumes: 既存の `getRelevantTrendJokeHistoryEntries(history, accountHandle)`(accountHandle でフィルタ、新しい順を保持)、既存の `history`(main で読み込み済み、entries は新しい順)
- Produces: `selectTrendJokeCopy({ config, copyProvider, overrideText, history, prepared, force, printPrompt })`、`generateTrendJokeProviderCandidates({ config, copyProvider, prepared, recentHistoryEntries, printPrompt })`、`buildTrendJokeProviderPrompt({ prepared, attempt, previousError, recentHistoryEntries })`

- [ ] **Step 1: main の呼び出しに `printPrompt` を渡す**

old:
```js
  const selected = await selectTrendJokeCopy({
    config,
    copyProvider,
    overrideText,
    history,
    prepared,
    force: trendArgs.forceLocalDuplicate,
  });
```

new:
```js
  const selected = await selectTrendJokeCopy({
    config,
    copyProvider,
    overrideText,
    history,
    prepared,
    force: trendArgs.forceLocalDuplicate,
    printPrompt: trendArgs.printPrompt,
  });
```

- [ ] **Step 2: `selectTrendJokeCopy` で履歴を provider へ渡す**

シグネチャの old:
```js
async function selectTrendJokeCopy({
  config,
  copyProvider,
  overrideText,
  history,
  prepared,
  force,
}) {
```

new:
```js
async function selectTrendJokeCopy({
  config,
  copyProvider,
  overrideText,
  history,
  prepared,
  force,
  printPrompt,
}) {
```

provider 呼び出しの old:
```js
  const generatedCandidates = await generateTrendJokeProviderCandidates({
    config,
    copyProvider,
    prepared,
  });
```

new:
```js
  const generatedCandidates = await generateTrendJokeProviderCandidates({
    config,
    copyProvider,
    prepared,
    printPrompt,
    recentHistoryEntries: getRelevantTrendJokeHistoryEntries(
      history,
      config.accountHandle
    ).slice(0, 3),
  });
```

(`getRelevantTrendJokeHistoryEntries` は関数宣言なので巻き上げで参照可能。履歴 entries は先頭が最新なので `slice(0, 3)` が直近3件。)

- [ ] **Step 3: `generateTrendJokeProviderCandidates` にパラメータを追加し、`--print-prompt` 時に provider プロンプトを表示する**

シグネチャと prompt 組み立ての old:
```js
async function generateTrendJokeProviderCandidates({
  config,
  copyProvider,
  prepared,
}) {
  if (copyProvider.kind === "fallback") {
    return [];
  }

  let previousError = "";
  for (let attempt = 1; attempt <= copyProvider.attempts; attempt += 1) {
    try {
      const prompt = buildTrendJokeProviderPrompt({
        prepared,
        attempt,
        previousError,
      });
```

new:
```js
async function generateTrendJokeProviderCandidates({
  config,
  copyProvider,
  prepared,
  recentHistoryEntries,
  printPrompt,
}) {
  if (copyProvider.kind === "fallback") {
    return [];
  }

  let previousError = "";
  for (let attempt = 1; attempt <= copyProvider.attempts; attempt += 1) {
    try {
      const prompt = buildTrendJokeProviderPrompt({
        prepared,
        attempt,
        previousError,
        recentHistoryEntries,
      });
      if (printPrompt) {
        console.log("Provider prompt:");
        console.log(prompt);
        console.log("");
      }
```

- [ ] **Step 4: `buildTrendJokeProviderPrompt` に履歴ヒント節を追加する**

関数全体の old:
```js
function buildTrendJokeProviderPrompt({ prepared, attempt, previousError }) {
  return [
    "次の文案生成プロンプトに従い、X投稿文を1つだけ作ってください。",
    "返答は JSON オブジェクトだけにしてください。Markdown、説明文、コードフェンスは禁止です。",
    '形式: {"text":"投稿文","shape":"sugari"}',
    `shape は次のどれか: ${Array.from(TREND_JOKE_KNOWN_SHAPES).join(
      " / "
    )}`,
    "text は validator に通る必要があります。URL、hashtag、mention、emoji は入れないでください。",
    "検索材料は今日のスイッチにすぎません。主役は投稿人格の情緒です。",
    previousError
      ? `前回の失敗理由: ${previousError}。この問題を直して再生成してください。`
      : "",
    `attempt: ${attempt}`,
    "",
    "文案生成プロンプト:",
    prepared.copyPrompt,
  ]
    .filter(Boolean)
    .join("\n");
}
```

new:
```js
function buildTrendJokeProviderPrompt({
  prepared,
  attempt,
  previousError,
  recentHistoryEntries,
}) {
  const recentLines = (recentHistoryEntries ?? [])
    .slice(0, 3)
    .map((entry) => {
      const shape = entry?.shape ? String(entry.shape) : "unknown";
      const ending = String(entry?.endingText ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return `- 温度: ${shape} / オチ: ${ending || "（記録なし）"}`;
    });
  return [
    "次の文案生成プロンプトに従い、X投稿文を1つだけ作ってください。",
    "返答は JSON オブジェクトだけにしてください。Markdown、説明文、コードフェンスは禁止です。",
    '形式: {"text":"投稿文","shape":"sugari"}',
    `shape は次のどれか: ${Array.from(TREND_JOKE_KNOWN_SHAPES).join(
      " / "
    )}`,
    "text は validator に通る必要があります。URL、hashtag、mention、emoji は入れないでください。",
    "検索材料は今日のスイッチにすぎません。主役は投稿人格の情緒です。",
    ...(recentLines.length
      ? [
          "直近の投稿（これらと同じ温度・似たオチの構図は避ける）:",
          ...recentLines,
        ]
      : []),
    previousError
      ? `前回の失敗理由: ${previousError}。この問題を直して再生成してください。`
      : "",
    `attempt: ${attempt}`,
    "",
    "文案生成プロンプト:",
    prepared.copyPrompt,
  ]
    .filter(Boolean)
    .join("\n");
}
```

(既存の `.filter(Boolean)` は空文字行を落とす挙動。ヒント節は空文字を挟まず行を直接追加しているので影響しない。履歴が空・欠損なら `recentLines` が空になり、従来と同一のプロンプトになる。)

- [ ] **Step 5: `printHelp` の説明を更新する**

old:
```js
  --print-prompt                    Print the Codex writing prompt.
```

new:
```js
  --print-prompt                    Print the copy prompt and the provider prompt.
```

- [ ] **Step 6: lint と dry-run で検証する**

```bash
npm run lint
npm run x:browser-post:trend-joke -- --copy-provider codex --print-prompt
```

期待:
- `Provider prompt:` セクションが表示され、`直近の投稿（これらと同じ温度・似たオチの構図は避ける）:` の下に履歴由来の `- 温度: jealousy / オチ: ...` 形式の行が最大3件並ぶ。
- `Generated trend joke copy via codex provider (attempt 1).` が出る(Task 1 の修正が効いている証拠)。
- `Dry-run complete. No post was submitted.` で終わる。

- [ ] **Step 7: Commit**

```bash
git add scripts/x-browser-post-trend-joke.mjs
git commit -m "Pass recent post history hints into trend joke provider prompt"
```

---

### Task 4: 設計ドキュメント更新

**Files:**
- Modify: `docs/x-browser-posting/trend-joke-post.md:424-426` (「文案生成 > 現行の実態」節)
- Modify: `docs/x-browser-posting/trend-joke-post.md:443-452` (「Prompt に渡す情報」リスト)
- Modify: `docs/x-browser-posting/trend-joke-post.md:455` (codex 起動記述)
- Modify: `docs/x-browser-posting/trend-joke-post.md:592` (検証方針の codex 行)

**Interfaces:**
- Consumes: Task 1〜3 の実装内容(記述を実態に合わせる)
- Produces: ドキュメントが実装と一致した状態。コード変更なし。

- [ ] **Step 1: codex 起動記述を修正する**

old:
```
`codex` provider は Codex CLI のローカル認証を使います。新しい npm dependency は追加せず、`codex exec --sandbox read-only --ask-for-approval never --ephemeral` で実行します。`X_BROWSER_POST_TREND_JOKE_CODEX_MODEL` または `--codex-model` が空なら Codex CLI の既定モデルを使います。
```

new:
```
`codex` provider は Codex CLI のローカル認証を使います。新しい npm dependency は追加せず、`codex exec --sandbox read-only --ephemeral` で実行します。現行 Codex CLI の `exec` は非対話実行が既定のため、approval 系フラグは付けません（2026-07 に旧 `--ask-for-approval never` フラグが CLI 更新で削除され、provider が全実行で失敗して fallback 固定になっていた障害の修正）。`X_BROWSER_POST_TREND_JOKE_CODEX_MODEL` または `--codex-model` が空なら Codex CLI の既定モデルを使います。
```

- [ ] **Step 2: 「現行の実態」節にプロンプト方針を追記する**

「文案生成 > 現行の実態」の第2段落(「生成文は最優先候補として扱います。…」)の直後に、次の段落を追加する:

```
生成プロンプトには2層の追加指示があります。server 側の `copyPrompt` は、検索サンプル内に実在の公演名として自然なものがあれば1つだけ本文に織り込む（褒め寄りの語感反応に限定、サンプル外の名前は禁止、「〜募集」「〜繋がりたい」のような募集・交流の定型文はイベント名として扱わない）ことを要求します。実イベント名を含む投稿だけがイベント名検索と主催者のエゴサーチに露出するため、検索面の獲得が狙いです。CLI 側は直近3件の投稿履歴の shape とオチ（endingText）をプロンプト末尾にヒントとして付加し、同じ温度・似たオチの連続を生成段階でも避けます。機械的な履歴ガードは従来どおり最終防衛として維持します。`--print-prompt` は server の copyPrompt に加えて、provider へ渡す最終プロンプトも表示します。
```

- [ ] **Step 3: 「Prompt に渡す情報」リストに履歴ヒントを追加する**

リスト末尾(「- `docs/x-browser-posting/posting-persona.md` の人格要約」の後)に追加:

```
- 直近3件の投稿履歴の shape とオチ（CLI 側で付加。履歴が無い場合は省略）
```

- [ ] **Step 4: 検証方針の codex 行を実態に合わせる**

old:
```
- `--copy-provider codex` が `codex exec` を read-only / no-approval / ephemeral で呼び、JSON schema に従った `text` を受け取れることを確認する。
```

new:
```
- `--copy-provider codex` が `codex exec` を read-only / ephemeral の非対話モードで呼び、JSON schema に従った `text` を受け取れることを確認する。
```

- [ ] **Step 5: Commit**

```bash
git add docs/x-browser-posting/trend-joke-post.md
git commit -m "Update trend-joke doc for codex flag fix and prompt additions"
```

---

### Task 5: 統合検証(失敗経路含む)

**Files:**
- 変更なし(検証のみ)

**Interfaces:**
- Consumes: Task 1〜4 のすべて
- Produces: spec「検証」節の全項目のエビデンス

- [ ] **Step 1: 正常系 dry-run**

```bash
npm run x:browser-post:trend-joke -- --copy-provider codex --print-prompt
```

期待:
- `Generated trend joke copy via codex provider` が出て `Copy source: codex`。
- サンプルに自然な公演名がある場合、`Composed text:` に実イベント名が1つ織り込まれている(目視。「〜募集」等のノイズをイベント名扱いしていないことも見る)。
- validator・履歴ガードのエラーなし。`Dry-run complete. No post was submitted.` で終わる。

- [ ] **Step 2: provider 失敗時の fallback 降格**

```bash
npm run x:browser-post:trend-joke -- --copy-provider codex --codex-model no-such-model-xyz
```

期待: 全 attempt が失敗し `Trend joke copy provider codex failed; using local fallback candidates.` が出て、`Copy source: fallback` で dry-run が完走する。

- [ ] **Step 3: 履歴ファイル破損時の dry-run 継続**

```bash
cp local/x-browser-posting/trend-joke-history.json local/x-browser-posting/trend-joke-history.json.bak
echo '{' > local/x-browser-posting/trend-joke-history.json
npm run x:browser-post:trend-joke -- --copy-provider codex --print-prompt
mv local/x-browser-posting/trend-joke-history.json.bak local/x-browser-posting/trend-joke-history.json
```

期待: `Trend joke history could not be read` の警告が出て空履歴として続行し、`Provider prompt:` に「直近の投稿」節が**含まれない**こと。最後に必ず `.bak` を戻す(4行目)。

- [ ] **Step 4: 最終チェック**

```bash
npm run lint && npx tsc --noEmit && git status --short
```

期待: lint / tsc クリーン、未コミットの変更なし。

- [ ] **Step 5: 運用メモ**

修正後の最初の数回の自動実行(`logs/x-browser-post-trend-joke/`)で、生成文にイベント名の捏造・作品批評・募集文言のイベント名扱いがないか目視確認する(spec のリスク項目。コードでは検査しないため)。

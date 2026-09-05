import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const serverFile = new URL("../../src/server/x-browser-posting/observation-log.ts", import.meta.url);
const source = fs.readFileSync(serverFile, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const trendSource = ts.createSourceFile("trend.ts", fs.readFileSync(
  new URL("../../src/server/x-browser-posting/trend-joke-post.ts", import.meta.url), "utf8"
), ts.ScriptTarget.Latest, true);
const weightFunction = trendSource.statements.find((node) =>
  ts.isFunctionDeclaration(node) && node.name?.text === "weightedTextLength"
);
const weightExports = {};
vm.runInNewContext(ts.transpileModule(weightFunction.getText(trendSource), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: weightExports });
const { weightedTextLength } = weightExports;

// Firestore and external services are isolated; execute the actual server entry point.
export function prepareWithCount(count = 1, distinctVariants = false) {
  const exports = {};
  const dependencies = {
    "@/app/config": { baseURL: "https://nazomatic.vercel.app" },
    "@/server/firebase/admin": {
      firestore: {
        collection() {
          let start;
          let limit;
          let variant = "";
          return {
            where(field, operator, value) {
              if (field === "eventTime" && operator === ">=") start = value;
              if (field === "sourceQuery" && distinctVariants) variant = value;
              return this;
            },
            orderBy() { return this; },
            limit(value) { limit = value; return this; },
            async get() {
              return { docs: Array.from({ length: Math.min(count, limit) }, (_, i) => ({
                id: `${variant}post-${i}`,
                data: () => ({
                  postId: `${variant}post-${i}`,
                  eventTime: start,
                  ticketTitle: `${"長い公演タイトル".repeat(4)}${i % 3}`,
                }),
              })) };
            },
          };
        },
      },
    },
    "@/server/realtime/syndication/visibility": { isRealtimeEventVisible: () => true },
    "@/server/x-browser-posting/candidate": {
      BrowserPostConfigError: class extends Error {},
      buildHashtagVariants: () => ["#謎チケ売ります", "謎チケ売ります"],
    },
    "@/server/x-browser-posting/weekend-ticket-summary": {
      readDate: (data, key) => data[key] ?? null,
      readString: (data, key) => data[key] ?? null,
      zonedStartOfDayToUtc: ({ year, month, day }) => new Date(Date.UTC(year, month - 1, day, -9)),
    },
    "@/server/x-browser-posting/trend-joke-post": { weightedTextLength },
  };
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.ok(dependencies[name], `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports.prepareObservationLog;
}

test("observation log rotates matching illustrations and copy over four weeks", async () => {
  const prepare = prepareWithCount();
  const dates = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"];
  const scenes = ["スマホ", "ノート", "マグ", "カレンダー"];
  const prompts = new Set();
  for (const [index, runDate] of dates.entries()) {
    const result = await prepare({ runDate });
    assert.ok(result.imagePrompt.includes(scenes[index]));
    assert.ok(result.suggestedLine.includes(scenes[index]));
    assert.ok(weightedTextLength(result.composedText) <= 280);
    prompts.add(result.imagePrompt);
  }
  assert.equal(prompts.size, 4);
  const first = await prepare({ runDate: dates[0] });
  const repeat = await prepare({ runDate: "2026-02-02" });
  assert.equal(repeat.imagePrompt, first.imagePrompt);
  assert.equal(repeat.suggestedLine, first.suggestedLine);
});

test("observation log keeps a scene through Sunday and across the year boundary", async () => {
  const prepare = prepareWithCount();
  const monday = await prepare({ runDate: "2025-12-29" });
  const sunday = await prepare({ runDate: "2026-01-04" });
  assert.equal(monday.imagePrompt, sunday.imagePrompt);
  assert.equal(monday.suggestedLine, sunday.suggestedLine);
  const nextMonday = await prepare({ runDate: "2026-01-05" });
  assert.notEqual(monday.imagePrompt, nextMonday.imagePrompt);
});

test("zero counts retain matching quiet copy and explicit copy overrides it", async () => {
  const prepare = prepareWithCount(0);
  for (const [index, scene] of ["スマホ", "ノート", "マグ", "カレンダー"].entries()) {
    const runDate = `2026-01-${String(5 + index * 7).padStart(2, "0")}`;
    const result = await prepare({ runDate });
    assert.match(result.suggestedLine, /静か/);
    assert.ok(result.suggestedLine.includes(scene));
    const manual = await prepare({ runDate, line: "今週も観測、おつかれさま。" });
    assert.equal(manual.suggestedLine, "今週も観測、おつかれさま。");
    assert.equal(manual.imagePrompt, result.imagePrompt);
  }
});

test("300 information records stay within the text limit with long title samples", async () => {
  const prepare = prepareWithCount(300);
  for (const day of [5, 12, 19, 26]) {
    const result = await prepare({ runDate: `2026-01-${String(day).padStart(2, "0")}` });
    assert.equal(result.pastWindow.count, 300);
    assert.equal(result.upcomingWindow.count, 300);
    assert.ok(weightedTextLength(result.composedText) <= 280);
    assert.match(result.composedText, /日程基準/);
    assert.doesNotMatch(result.composedText, /向こう7日の公演例/);
  }
});

test("both hashtag queries may contribute 300 distinct records even with full-width date ranges", async () => {
  const prepare = prepareWithCount(300, true);
  for (const runDate of ["2026-12-10", "2026-12-17", "2026-12-24", "2026-12-31"]) {
    const result = await prepare({ runDate });
    assert.equal(result.pastWindow.count, 600);
    assert.equal(result.upcomingWindow.count, 600);
    assert.ok(weightedTextLength(result.composedText) <= 280);
    const quiet = await prepareWithCount(0)({ runDate });
    assert.ok(weightedTextLength(quiet.composedText) <= 280);
  }
});

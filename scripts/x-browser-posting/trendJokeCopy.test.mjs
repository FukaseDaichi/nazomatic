import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrendJokeProviderOutputSchema,
  capToolIntroArchetype,
  classifyTrendJokeProviderError,
  findTrendJokeHistoryBlockReason,
  getTrendJokeSimilarityEnding,
  isRetryableTrendJokeProviderError,
  normalizeTrendJokeSimilarityText,
  summarizeTrendJokeProviderError,
  validateTrendJokePollOptions,
  TOOL_INTRO_MIN_INTERVAL_MS,
} from "./trendJokeCopy.mjs";

const SHAPES = new Set(["sugari", "fake_calm"]);
const ARCHETYPE_ORDER = [
  "monologue",
  "question",
  "one_liner",
  "poll",
  "tool_intro",
];

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

test("TOOL_INTRO_MIN_INTERVAL_MS is one week", () => {
  assert.equal(TOOL_INTRO_MIN_INTERVAL_MS, 7 * 24 * 60 * 60 * 1000);
});

test("provider schema contains structural constraints only", () => {
  const schema = buildTrendJokeProviderOutputSchema(SHAPES);
  const serialized = JSON.stringify(schema);

  assert.deepEqual(schema.required, ["text", "shape", "pollOptions"]);
  assert.deepEqual(schema.properties.shape.enum, ["sugari", "fake_calm"]);
  for (const keyword of [
    "uniqueItems",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
  ]) {
    assert.equal(serialized.includes(keyword), false);
  }
});

test("deterministic provider errors are not retried", () => {
  const schemaError = new Error(
    "Invalid schema for response_format 'codex_output_schema': uniqueItems is not permitted"
  );
  const errorCode = classifyTrendJokeProviderError(schemaError);

  assert.equal(errorCode, "schema");
  assert.equal(isRetryableTrendJokeProviderError(errorCode), false);
  assert.equal(
    isRetryableTrendJokeProviderError(
      classifyTrendJokeProviderError(new Error("provider timed out after 1ms"))
    ),
    true
  );
});

test("provider errors are reduced to their actionable message", () => {
  const error = new Error(
    'codex exited with 1: {"error":{"message":"uniqueItems is not permitted"}}'
  );

  assert.equal(
    summarizeTrendJokeProviderError(error),
    "uniqueItems is not permitted"
  );
});

test("similarity normalization removes URLs and trailing hashtags", () => {
  const alphabet =
    "アルファベットシステムを置いておきます。\nhttps://nazomatic.vercel.app/alphabet?utm_source=x&utm_campaign=trend_joke_tool_intro #謎解き";
  const dice =
    "サイコロシステムはまだ起きています。\nhttps://nazomatic.vercel.app/dice?utm_source=x&utm_campaign=trend_joke_tool_intro #謎解き";

  assert.equal(
    getTrendJokeSimilarityEnding(alphabet),
    "アルファベットシステムを置いておきます。"
  );
  assert.notEqual(
    normalizeTrendJokeSimilarityText(alphabet),
    normalizeTrendJokeSimilarityText(dice)
  );
});

test("different tool copy is not blocked by a shared UTM suffix", () => {
  const entries = [
    {
      postedAt: "2026-07-23T06:31:19.568Z",
      archetype: "tool_intro",
      topicKey: "event_title_vibes",
      text: "アルファベットシステム、必要になる前に置いておきます。アルファベットと数字を相互変換するシステム！\nhttps://nazomatic.vercel.app/alphabet?utm_source=x&utm_medium=social&utm_campaign=trend_joke_tool_intro #謎解き",
    },
  ];
  const candidate =
    "検索欄を迷子にする前に、サイコロシステムだけ置いておきます。\nhttps://nazomatic.vercel.app/dice?utm_source=x&utm_medium=social&utm_campaign=trend_joke_tool_intro";

  assert.equal(
    findTrendJokeHistoryBlockReason({
      text: candidate,
      entries,
      prepared: {
        archetype: "tool_intro",
        searchFingerprint: "new-search",
      },
    }),
    null
  );
});

test("exact copy remains blocked across archetypes", () => {
  const text = "同じ本文は投稿型が違っても止める。";
  const reason = findTrendJokeHistoryBlockReason({
    text,
    entries: [{ text, archetype: "monologue" }],
    prepared: { archetype: "one_liner" },
  });

  assert.match(reason, /exact text match/);
});

test("poll uniqueness remains enforced locally", () => {
  assert.deepEqual(validateTrendJokePollOptions(["紙", "スマホ"], "poll"), [
    "紙",
    "スマホ",
  ]);
  assert.throws(
    () => validateTrendJokePollOptions(["紙", "紙"], "poll"),
    /must be unique/
  );
});

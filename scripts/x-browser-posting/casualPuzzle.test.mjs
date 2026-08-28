import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPuzzleAnswerText,
  buildPuzzleQuestionText,
  decideCasualPuzzlePhase,
  generateCasualPuzzle,
  shiftKanaWord,
} from "./casualPuzzle.mjs";

test("shiftKanaWord shifts each kana forward in the 46-kana sequence", () => {
  assert.equal(shiftKanaWord("こきよ", 1), "さくら");
  assert.equal(shiftKanaWord("ん", 1), "あ");
  assert.equal(shiftKanaWord("がっこう", 1), null);
});

test("generateCasualPuzzle returns a deterministic unique-answer puzzle", () => {
  const words = ["さくら", "たぬき"];
  const puzzle = generateCasualPuzzle({
    words,
    randomInt: () => 0,
  });
  assert.ok(puzzle);
  assert.equal(shiftKanaWord(puzzle.display, puzzle.shift), puzzle.answer);
  assert.ok(words.includes(puzzle.answer));
  assert.equal(words.includes(puzzle.display), false);
});

test("generateCasualPuzzle skips displays that collide with dictionary words", () => {
  const words = ["さくら", "こきよ"];
  const puzzle = generateCasualPuzzle({
    words,
    randomInt: () => 0,
    maxAttempts: 10,
  });
  assert.equal(puzzle, null);
});

test("generateCasualPuzzle rejects answers and displays matching the denylist", () => {
  assert.equal(
    generateCasualPuzzle({
      words: ["しにたい"],
      randomInt: () => 0,
      maxAttempts: 10,
    }),
    null
  );
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
  const sunday = new Date("2026-08-30T11:00:00Z");
  const monday = new Date("2026-08-31T11:00:00Z");
  assert.equal(
    decideCasualPuzzlePhase({ state: {}, now: sunday, timezone }).phase,
    "question"
  );
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
  assert.equal(
    decideCasualPuzzlePhase({
      state: { pending },
      now: new Date("2026-08-30T20:00:00Z"),
      timezone,
    }).phase,
    "skip"
  );
  assert.equal(
    decideCasualPuzzlePhase({ state: { pending }, now: monday, timezone }).phase,
    "answer"
  );
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

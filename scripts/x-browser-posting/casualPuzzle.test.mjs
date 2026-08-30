import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLegacyShiftPuzzleAnswerText,
  buildPuzzleAnswerText,
  buildPuzzleQuestionText,
  decideCasualPuzzlePhase,
  generateCasualPuzzle,
  isValidAnagramPuzzle,
  shuffleKanaWord,
  shiftKanaWord,
} from "./casualPuzzle.mjs";

test("shiftKanaWord shifts each kana forward in the 46-kana sequence", () => {
  assert.equal(shiftKanaWord("こきよ", 1), "さくら");
  assert.equal(shiftKanaWord("ん", 1), "あ");
  assert.equal(shiftKanaWord("がっこう", 1), null);
});

test("shuffleKanaWord preserves characters and changes their order", () => {
  assert.equal(shuffleKanaWord("あいうえおか", () => 0), "いうえおかあ");
  assert.equal(shuffleKanaWord("あ", () => 0), null);
});

test("generateCasualPuzzle returns a deterministic six-character anagram", () => {
  const words = ["あいうえおか", "さしすせそた"];
  const puzzle = generateCasualPuzzle({
    words,
    randomInt: () => 0,
  });
  assert.ok(puzzle);
  assert.equal(puzzle.kind, "anagram");
  assert.equal(Array.from(puzzle.answer).length, 6);
  assert.equal(
    Array.from(puzzle.display).sort().join(""),
    Array.from(puzzle.answer).sort().join("")
  );
  assert.ok(words.includes(puzzle.answer));
  assert.equal(words.includes(puzzle.display), false);
});

test("generateCasualPuzzle rejects answers with another dictionary anagram", () => {
  const words = ["あいうえおか", "かおえういあ"];
  const puzzle = generateCasualPuzzle({
    words,
    randomInt: () => 0,
    maxAttempts: 10,
  });
  assert.equal(puzzle, null);
});

test("generateCasualPuzzle counts denylisted dictionary words as alternate answers", () => {
  assert.equal(
    generateCasualPuzzle({
      words: ["あいうえおか", "かおえういあ"],
      randomInt: () => 0,
      maxAttempts: 10,
      denylist: ["かおえ"],
    }),
    null
  );
});

test("generateCasualPuzzle rejects answers and displays matching the denylist", () => {
  assert.equal(
    generateCasualPuzzle({
      words: ["しにたいああ"],
      randomInt: () => 0,
      maxAttempts: 10,
    }),
    null
  );
  assert.equal(
    generateCasualPuzzle({
      words: ["あいうえおか"],
      randomInt: () => 0,
      maxAttempts: 10,
      denylist: ["いうえ"],
    }),
    null
  );
});

test("isValidAnagramPuzzle rejects non-kana pending values", () => {
  assert.equal(
    isValidAnagramPuzzle({ answer: "abcdef", display: "bcdefa" }),
    false
  );
  assert.equal(
    isValidAnagramPuzzle({
      answer: "あいうえおか",
      display: "いうえおかあ",
    }),
    true
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
    kind: "anagram",
    answer: "あいうえおか",
    display: "いうえおかあ",
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
  const text = buildPuzzleQuestionText({ display: "いうえおかあ" });
  assert.match(text, /いうえおかあ/);
  assert.match(text, /6文字を並び替える/);
  assert.match(text, /[?？]/);
  assert.doesNotMatch(text, /https?:\/\//);
});

test("answer text contains answer, display and exactly the tool URL", () => {
  const toolUrl =
    "https://nazomatic.vercel.app/anagram?utm_source=x&utm_medium=social&utm_campaign=casual_puzzle";
  const text = buildPuzzleAnswerText({
    answer: "あいうえおか",
    display: "いうえおかあ",
    toolUrl,
  });
  assert.match(text, /あいうえおか/);
  assert.match(text, /いうえおかあ/);
  assert.match(text, /並び替える/);
  assert.equal(text.match(/https?:\/\/[^\s]+/g).length, 1);
  assert.ok(text.includes(toolUrl));
});

test("legacy shift answer text remains available for the currently pending post", () => {
  const toolUrl =
    "https://nazomatic.vercel.app/shift-search?utm_source=x&utm_medium=social&utm_campaign=casual_puzzle";
  const text = buildLegacyShiftPuzzleAnswerText({
    answer: "おとくいさま",
    display: "うつかんけへ",
    shift: 2,
    toolUrl,
  });
  assert.match(text, /うしろに2つ進める/);
  assert.ok(text.includes(toolUrl));
});

import fsSync from "node:fs";
import { randomInt as cryptoRandomInt } from "node:crypto";

// src/lib/shift-search.ts の JP_BASE_ALPHABET と同一に保つ（変更時は両方直す）。
export const JP_BASE_ALPHABET =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";

const ALPHABET_INDEX = new Map(
  Array.from(JP_BASE_ALPHABET).map((char, index) => [char, index])
);
const PUZZLE_WORD_LENGTH = 6;
const ANSWER_MIN_DELAY_MS = 20 * 60 * 60 * 1000;
const PENDING_STALE_MS = 7 * 24 * 60 * 60 * 1000;

// 無監修辞書からの不適切語対策。部分一致で answer / display の両方に適用する。
// 完全なリストは作れないため、dry-run と automation 報告への出題語表示、
// 発生時の automation 停止＋追記を運用ドキュメント側の停止条件にする。
export const DEFAULT_PUZZLE_DENYLIST = [
  "しに",
  "しぬ",
  "じさつ",
  "じし",
  "ころす",
  "ころし",
  "さつじん",
  "せっくす",
  "せいこう",
  "せいよく",
  "せいき",
  "ぼっき",
  "えっち",
  "あだると",
  "れいぷ",
  "ちかん",
  "ようじょ",
  "ろりこん",
  "ふうぞく",
  "そうぷ",
  "はだか",
  "おっぱい",
  "ちんこ",
  "まんこ",
  "うんこ",
  "きちがい",
  "かたわ",
  "つんぼ",
  "めくら",
  "びっこ",
  "ぶらく",
  "ちょうせんじん",
  "がいじん",
  "かると",
  "おうむ",
  "なちす",
  "てろ",
  "ばくだん",
  "まやく",
  "かくせいざい",
];

export function shiftKanaWord(word, shift) {
  const size = JP_BASE_ALPHABET.length;
  const chars = Array.from(String(word ?? ""));
  if (chars.length === 0 || !Number.isFinite(Number(shift))) {
    return null;
  }
  const normalizedShift =
    ((Math.trunc(Number(shift)) % size) + size) % size;
  const shifted = chars.map((char) => {
    const index = ALPHABET_INDEX.get(char);
    if (index === undefined) {
      return null;
    }
    return JP_BASE_ALPHABET[(index + normalizedShift) % size];
  });
  return shifted.every((char) => char !== null) ? shifted.join("") : null;
}

export function loadPuzzleDictionary(dicPath) {
  const raw = fsSync.readFileSync(dicPath, "utf8");
  const seen = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const word = line.trim();
    const length = Array.from(word).length;
    if (length !== PUZZLE_WORD_LENGTH) {
      continue;
    }
    if (!isPuzzleKanaWord(word)) {
      continue;
    }
    seen.add(word);
  }
  return Array.from(seen);
}

export function isPuzzleKanaWord(word) {
  const chars = Array.from(String(word ?? ""));
  return chars.length > 0 && chars.every((char) => ALPHABET_INDEX.has(char));
}

export function shuffleKanaWord(word, randomInt = cryptoRandomInt) {
  const chars = Array.from(String(word ?? ""));
  if (chars.length < 2) {
    return null;
  }
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    if (
      !Number.isInteger(swapIndex) ||
      swapIndex < 0 ||
      swapIndex > index
    ) {
      return null;
    }
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join("");
}

// 同じ文字構成の辞書語が1件だけの6文字語を使い、辞書語にならない順番へ並び替える。
// これにより、出題に使った辞書の範囲では答えが一意になる。
export function generateCasualPuzzle({
  words,
  randomInt = cryptoRandomInt,
  maxAttempts = 200,
  denylist = DEFAULT_PUZZLE_DENYLIST,
}) {
  if (!Array.isArray(words) || words.length === 0) {
    return null;
  }
  const dictionaryWordSet = new Set(
    words.filter(
      (word) =>
        typeof word === "string" &&
        Array.from(word).length === PUZZLE_WORD_LENGTH &&
        isPuzzleKanaWord(word)
    )
  );
  const signatureCounts = new Map();
  for (const word of dictionaryWordSet) {
    const signature = anagramSignature(word);
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  }
  const candidates = Array.from(dictionaryWordSet).filter(
    (word) =>
      !matchesDenylist(word, denylist) &&
      signatureCounts.get(anagramSignature(word)) === 1
  );
  if (candidates.length === 0) {
    return null;
  }
  const attempts = Math.max(0, Math.trunc(Number(maxAttempts)) || 0);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const answerIndex = randomInt(candidates.length);
    if (
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex >= candidates.length
    ) {
      continue;
    }
    const answer = candidates[answerIndex];
    const display = shuffleKanaWord(answer, randomInt);
    if (
      !display ||
      display === answer ||
      dictionaryWordSet.has(display) ||
      matchesDenylist(display, denylist)
    ) {
      continue;
    }
    return { kind: "anagram", answer, display };
  }
  return null;
}

export function isValidAnagramPuzzle(
  { answer, display },
  denylist = DEFAULT_PUZZLE_DENYLIST
) {
  return (
    Array.from(String(answer ?? "")).length === PUZZLE_WORD_LENGTH &&
    Array.from(String(display ?? "")).length === PUZZLE_WORD_LENGTH &&
    answer !== display &&
    isPuzzleKanaWord(answer) &&
    isPuzzleKanaWord(display) &&
    anagramSignature(answer) === anagramSignature(display) &&
    !matchesDenylist(answer, denylist) &&
    !matchesDenylist(display, denylist)
  );
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

export function buildPuzzleQuestionText({ display }) {
  return [
    "【ゆる出題】観測担当より。",
    `「${display}」の6文字を並び替えると、ある言葉になります。なんでしょう？`,
    "",
    "答えは明日の夜に。私は出題側なので、解けなくても平気です。平気って言いました。",
  ].join("\n");
}

export function buildPuzzleAnswerText({ answer, display, toolUrl }) {
  return [
    `【昨日の答え】「${display}」を並び替えると「${answer}」でした。`,
    "",
    "解けた人はすごい。私はツールに聞きました。ずるではなく観測です。",
    toolUrl,
  ].join("\n");
}

// 2026-08-30 に投稿済みの旧シフト問題を回答し終えるまでだけ使う。
export function buildLegacyShiftPuzzleAnswerText({
  answer,
  display,
  shift,
  toolUrl,
}) {
  return [
    `【昨日の答え】「${display}」をうしろに${shift}つ進めると「${answer}」でした。`,
    "",
    "解けた人はすごい。私はツールに聞きました。ずるではなく観測です。",
    toolUrl,
  ].join("\n");
}

function matchesDenylist(word, denylist) {
  return (denylist ?? []).some(
    (pattern) => typeof pattern === "string" && pattern && word.includes(pattern)
  );
}

function anagramSignature(word) {
  return Array.from(word).sort().join("");
}

function jstWeekday(now, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
}

import fsSync from "node:fs";
import { randomInt as cryptoRandomInt } from "node:crypto";

// src/lib/shift-search.ts の JP_BASE_ALPHABET と同一に保つ（変更時は両方直す）。
export const JP_BASE_ALPHABET =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";

const ALPHABET_INDEX = new Map(
  Array.from(JP_BASE_ALPHABET).map((char, index) => [char, index])
);
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
  randomInt = cryptoRandomInt,
  maxAttempts = 200,
  denylist = DEFAULT_PUZZLE_DENYLIST,
}) {
  if (!Array.isArray(words) || words.length === 0) {
    return null;
  }
  const wordSet = new Set(words);
  const size = JP_BASE_ALPHABET.length;
  const attempts = Math.max(0, Math.trunc(Number(maxAttempts)) || 0);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const answerIndex = randomInt(words.length);
    const answer = words[answerIndex];
    if (typeof answer !== "string") {
      continue;
    }
    const shift = 1 + randomInt(3); // 1〜3
    if (matchesDenylist(answer, denylist)) {
      continue;
    }
    const display = shiftKanaWord(answer, size - shift);
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

function matchesDenylist(word, denylist) {
  return (denylist ?? []).some(
    (pattern) => typeof pattern === "string" && pattern && word.includes(pattern)
  );
}

function jstWeekday(now, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
}

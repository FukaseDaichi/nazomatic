import { SearchManager } from "@/class/SearchManager";
import { normalizeKana } from "@/lib/utils";

export const SHIFT_EXACT_RESULT_MAXCOUNT = 1000;
export const SHIFT_ANAGRAM_RESULT_MAXCOUNT = 3000;
export const SHIFT_TOTAL_RESULT_MAXCOUNT = 5000;

export type ShiftMatchType = "exact" | "anagram";
export type ShiftDictionaryType = "en" | "jp";

export type ShiftSearchResult = {
  resultWord: string;
  shift: number;
  matchType: ShiftMatchType;
  sourceWord: string;
};

export type ShiftSearchParams = {
  searchManager: SearchManager;
  dictionaryType: ShiftDictionaryType;
  input: string;
  includeAnagram: boolean;
};

export type ShiftSearchOutcome = {
  normalizedInput: string;
  results: ShiftSearchResult[];
  limitReached: boolean;
};

type KanaMarkType = "none" | "dakuten" | "handakuten";
type KanaToken = { base: string; mark: KanaMarkType };

const EN_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const JP_BASE_ALPHABET =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";

const JP_SMALL_TO_LARGE: Record<string, string> = {
  ぁ: "あ",
  ぃ: "い",
  ぅ: "う",
  ぇ: "え",
  ぉ: "お",
  ゃ: "や",
  ゅ: "ゆ",
  ょ: "よ",
  っ: "つ",
  ゎ: "わ",
};

const JP_DAKUTEN_TO_BASE: Record<string, string> = {
  が: "か",
  ぎ: "き",
  ぐ: "く",
  げ: "け",
  ご: "こ",
  ざ: "さ",
  じ: "し",
  ず: "す",
  ぜ: "せ",
  ぞ: "そ",
  だ: "た",
  ぢ: "ち",
  づ: "つ",
  で: "て",
  ど: "と",
  ば: "は",
  び: "ひ",
  ぶ: "ふ",
  べ: "へ",
  ぼ: "ほ",
  ゔ: "う",
};

const JP_HANDAKUTEN_TO_BASE: Record<string, string> = {
  ぱ: "は",
  ぴ: "ひ",
  ぷ: "ふ",
  ぺ: "へ",
  ぽ: "ほ",
};

const JP_BASE_TO_DAKUTEN: Record<string, string> = {
  か: "が",
  き: "ぎ",
  く: "ぐ",
  け: "げ",
  こ: "ご",
  さ: "ざ",
  し: "じ",
  す: "ず",
  せ: "ぜ",
  そ: "ぞ",
  た: "だ",
  ち: "ぢ",
  つ: "づ",
  て: "で",
  と: "ど",
  は: "ば",
  ひ: "び",
  ふ: "ぶ",
  へ: "べ",
  ほ: "ぼ",
  う: "ゔ",
};

const JP_BASE_TO_HANDAKUTEN: Record<string, string> = {
  は: "ぱ",
  ひ: "ぴ",
  ふ: "ぷ",
  へ: "ぺ",
  ほ: "ぽ",
};

const JP_SMALL_KANA_REGEX = /[ぁぃぅぇぉゃゅょっゎ]/g;
const MATCH_TYPE_ORDER: Record<ShiftMatchType, number> = {
  exact: 0,
  anagram: 1,
};

function normalizeShiftInput(input: string): string {
  const normalized = normalizeKana(input.toLowerCase().normalize("NFKC"));
  return normalized.replace(
    JP_SMALL_KANA_REGEX,
    (char) => JP_SMALL_TO_LARGE[char] || char
  );
}

function shiftEnglishWord(word: string, shift: number): string {
  return word
    .split("")
    .map((char) => {
      const index = EN_ALPHABET.indexOf(char);
      if (index < 0) {
        throw new Error("英語辞書では英字（a-z）のみ入力できます。");
      }
      return EN_ALPHABET[(index + shift) % EN_ALPHABET.length];
    })
    .join("");
}

function splitKanaToken(char: string): KanaToken | null {
  if (JP_BASE_ALPHABET.includes(char)) {
    return { base: char, mark: "none" };
  }
  if (char in JP_DAKUTEN_TO_BASE) {
    return { base: JP_DAKUTEN_TO_BASE[char], mark: "dakuten" };
  }
  if (char in JP_HANDAKUTEN_TO_BASE) {
    return { base: JP_HANDAKUTEN_TO_BASE[char], mark: "handakuten" };
  }
  return null;
}

function applyKanaMark(base: string, mark: KanaMarkType): string {
  if (mark === "dakuten") {
    return JP_BASE_TO_DAKUTEN[base] ?? base;
  }
  if (mark === "handakuten") {
    return JP_BASE_TO_HANDAKUTEN[base] ?? base;
  }
  return base;
}

function tokenizeJapaneseWord(word: string): KanaToken[] {
  const tokens: KanaToken[] = [];
  for (const char of word) {
    const token = splitKanaToken(char);
    if (!token) {
      throw new Error(
        "日本語辞書ではひらがなのみ入力できます（小文字は自動で通常文字として扱います）。"
      );
    }
    tokens.push(token);
  }
  return tokens;
}

function shiftJapaneseTokens(tokens: KanaToken[], shift: number): string {
  const size = JP_BASE_ALPHABET.length;
  return tokens
    .map((token) => {
      const baseIndex = JP_BASE_ALPHABET.indexOf(token.base);
      if (baseIndex < 0) {
        throw new Error("日本語シフト対象の文字変換に失敗しました。");
      }
      const shiftedBase = JP_BASE_ALPHABET[(baseIndex + shift) % size];
      return applyKanaMark(shiftedBase, token.mark);
    })
    .join("");
}

function buildShiftedWords(
  normalizedInput: string,
  dictionaryType: ShiftDictionaryType
): string[] {
  if (dictionaryType === "en") {
    if (!/^[a-z]+$/.test(normalizedInput)) {
      throw new Error("英語辞書では英字（a-z）のみ入力できます。");
    }
    return Array.from({ length: 25 }, (_, index) =>
      shiftEnglishWord(normalizedInput, index + 1)
    );
  }

  const tokens = tokenizeJapaneseWord(normalizedInput);
  return Array.from({ length: 45 }, (_, index) =>
    shiftJapaneseTokens(tokens, index + 1)
  );
}

function dedupeAndSortResults(results: ShiftSearchResult[]): ShiftSearchResult[] {
  const map = new Map<string, ShiftSearchResult>();
  for (const result of results) {
    const key = `${result.resultWord}\u0000${result.shift}\u0000${result.matchType}`;
    if (!map.has(key)) {
      map.set(key, result);
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (left.shift !== right.shift) {
      return left.shift - right.shift;
    }
    if (left.matchType !== right.matchType) {
      return MATCH_TYPE_ORDER[left.matchType] - MATCH_TYPE_ORDER[right.matchType];
    }
    return left.resultWord.localeCompare(right.resultWord, "ja");
  });
}

export async function runShiftSearch({
  searchManager,
  dictionaryType,
  input,
  includeAnagram,
}: ShiftSearchParams): Promise<ShiftSearchOutcome> {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    throw new Error("検索ワードを入力してください。");
  }

  const normalizedInput = normalizeShiftInput(trimmedInput);
  if (!normalizedInput) {
    throw new Error("検索ワードを入力してください。");
  }

  const shiftedWords = buildShiftedWords(normalizedInput, dictionaryType);
  const results: ShiftSearchResult[] = [];

  let exactCount = 0;
  let anagramCount = 0;
  let limitReached = false;

  for (let index = 0; index < shiftedWords.length; index++) {
    if (results.length >= SHIFT_TOTAL_RESULT_MAXCOUNT) {
      limitReached = true;
      break;
    }

    const shift = index + 1;
    const sourceWord = shiftedWords[index];

    if (exactCount < SHIFT_EXACT_RESULT_MAXCOUNT) {
      const isExact = await searchManager.findExactWordAsync(sourceWord);
      if (isExact && results.length < SHIFT_TOTAL_RESULT_MAXCOUNT) {
        results.push({
          resultWord: sourceWord,
          shift,
          matchType: "exact",
          sourceWord,
        });
        exactCount++;
      }
    } else {
      limitReached = true;
    }

    if (!includeAnagram) {
      continue;
    }

    if (anagramCount >= SHIFT_ANAGRAM_RESULT_MAXCOUNT) {
      limitReached = true;
      break;
    }

    const anagramResults = await searchManager.findAnagramsAsync(sourceWord);
    for (const anagramWord of anagramResults) {
      if (results.length >= SHIFT_TOTAL_RESULT_MAXCOUNT) {
        limitReached = true;
        break;
      }
      if (anagramCount >= SHIFT_ANAGRAM_RESULT_MAXCOUNT) {
        limitReached = true;
        break;
      }

      results.push({
        resultWord: anagramWord,
        shift,
        matchType: "anagram",
        sourceWord,
      });
      anagramCount++;
    }

    if (limitReached) {
      break;
    }
  }

  return {
    normalizedInput,
    results: dedupeAndSortResults(results),
    limitReached,
  };
}


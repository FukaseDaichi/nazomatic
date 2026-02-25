#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DICTIONARIES = {
  buta: {
    path: path.join("public", "dic", "buta.dic"),
    type: "jp",
    label: "buta.dic",
    defaultOutDir: path.join("codex", "reports", "jp"),
  },
  cefr: {
    path: path.join("public", "dic", "CEFR-J.dic"),
    type: "en",
    label: "CEFR-J.dic",
    defaultOutDir: path.join("codex", "reports", "en"),
  },
};

const EN_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const JP_BASE_ALPHABET =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";

const JP_SMALL_TO_LARGE = {
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

const JP_DAKUTEN_TO_BASE = {
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

const JP_HANDAKUTEN_TO_BASE = {
  ぱ: "は",
  ぴ: "ひ",
  ぷ: "ふ",
  ぺ: "へ",
  ぽ: "ほ",
};

const JP_BASE_TO_DAKUTEN = {
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

const JP_BASE_TO_HANDAKUTEN = {
  は: "ぱ",
  ひ: "ぴ",
  ふ: "ぷ",
  へ: "ぺ",
  ほ: "ぽ",
};

const JP_SMALL_KANA_REGEX = /[ぁぃぅぇぉゃゅょっゎ]/g;
const SMALL_KANA_NORMALIZE_REGEX = /[ゃゅょっぁぃぅぇぉ]/g;

function parseArgs(argv) {
  const options = {
    dictionary: "buta",
    lengths: [],
    outDir: null,
    out: null,
    limit: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dictionary") {
      options.dictionary = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--length") {
      const value = argv[i + 1];
      i += 1;
      for (const part of value.split(",")) {
        const parsed = Number(part.trim());
        if (Number.isInteger(parsed) && parsed > 0) {
          options.lengths.push(parsed);
        }
      }
      continue;
    }
    if (arg === "--out-dir") {
      options.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out") {
      options.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      const parsed = Number(argv[i + 1]);
      i += 1;
      if (Number.isInteger(parsed) && parsed > 0) {
        options.limit = parsed;
      }
      continue;
    }
  }

  if (!DICTIONARIES[options.dictionary]) {
    throw new Error(
      `Unsupported dictionary: ${options.dictionary} (use "buta" or "cefr").`
    );
  }

  const uniqueLengths = Array.from(new Set(options.lengths)).sort((a, b) => a - b);
  if (uniqueLengths.length === 0) {
    throw new Error("Length is required. Example: --length 5 or --length 5,6,7,8");
  }
  options.lengths = uniqueLengths;

  if (options.out && uniqueLengths.length !== 1) {
    throw new Error("--out can only be used with a single length.");
  }

  return options;
}

function normalizeKana(input) {
  return input.replace(/[\u30a1-\u30f6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}

function normalizeWord(word, dictionaryType) {
  if (dictionaryType === "en") {
    return word.toLowerCase().normalize("NFKC");
  }

  const convertedWord = word
    .replace(SMALL_KANA_NORMALIZE_REGEX, (char) => JP_SMALL_TO_LARGE[char] ?? char)
    .toLowerCase()
    .normalize("NFKC");

  return normalizeKana(convertedWord);
}

function normalizeShiftInput(input, dictionaryType) {
  const normalized = normalizeKana(input.toLowerCase().normalize("NFKC"));
  if (dictionaryType === "en") {
    return normalized;
  }
  return normalized.replace(JP_SMALL_KANA_REGEX, (char) => JP_SMALL_TO_LARGE[char] || char);
}

function applyKanaMark(base, mark) {
  if (mark === "dakuten") {
    return JP_BASE_TO_DAKUTEN[base] ?? base;
  }
  if (mark === "handakuten") {
    return JP_BASE_TO_HANDAKUTEN[base] ?? base;
  }
  return base;
}

function splitKanaToken(char) {
  if (JP_BASE_ALPHABET.includes(char)) {
    return { base: char, mark: "none" };
  }
  if (Object.prototype.hasOwnProperty.call(JP_DAKUTEN_TO_BASE, char)) {
    return { base: JP_DAKUTEN_TO_BASE[char], mark: "dakuten" };
  }
  if (Object.prototype.hasOwnProperty.call(JP_HANDAKUTEN_TO_BASE, char)) {
    return { base: JP_HANDAKUTEN_TO_BASE[char], mark: "handakuten" };
  }
  return null;
}

function buildShiftedWords(normalizedInput, dictionaryType) {
  if (dictionaryType === "en") {
    if (!/^[a-z]+$/.test(normalizedInput)) {
      return null;
    }

    return Array.from({ length: 25 }, (_, index) => {
      const shift = index + 1;
      return normalizedInput
        .split("")
        .map((char) => {
          const charIndex = EN_ALPHABET.indexOf(char);
          return EN_ALPHABET[(charIndex + shift) % EN_ALPHABET.length];
        })
        .join("");
    });
  }

  const tokens = [];
  for (const char of normalizedInput) {
    const token = splitKanaToken(char);
    if (!token) {
      return null;
    }
    tokens.push(token);
  }

  return Array.from({ length: 45 }, (_, index) => {
    const shift = index + 1;
    return tokens
      .map((token) => {
        const baseIndex = JP_BASE_ALPHABET.indexOf(token.base);
        const shiftedBase = JP_BASE_ALPHABET[(baseIndex + shift) % JP_BASE_ALPHABET.length];
        return applyKanaMark(shiftedBase, token.mark);
      })
      .join("");
  });
}

function sortedWordKey(word) {
  return word.split("").sort().join("");
}

function escapeMd(value) {
  return String(value).replace(/\|/g, "\\|");
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readDictionaryWords(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function buildDictionaryIndex(rawWords, dictionaryType) {
  const normalizedWords = rawWords.map((word) => normalizeWord(word, dictionaryType));
  const wordSet = new Set(normalizedWords);
  const anagramMap = new Map();

  for (const word of normalizedWords) {
    const key = sortedWordKey(word);
    if (!anagramMap.has(key)) {
      anagramMap.set(key, []);
    }
    anagramMap.get(key).push(word);
  }

  return { wordSet, anagramMap };
}

function writeReport({
  outputPath,
  dictionaryLabel,
  dictionaryType,
  length,
  words,
  index,
  limit,
}) {
  const startedAt = new Date();
  const tempRowsPath = `${outputPath}.rows.tmp`;
  ensureDirectory(path.dirname(outputPath));

  const rowStream = fs.createWriteStream(tempRowsPath, { encoding: "utf8" });

  let executedWordCount = 0;
  let totalHitRows = 0;

  const maxWordCount = limit ? Math.min(words.length, limit) : words.length;

  for (let i = 0; i < maxWordCount; i += 1) {
    const rawInputWord = words[i];
    const inputWord = normalizeWord(rawInputWord, dictionaryType);
    const normalizedInput = normalizeShiftInput(rawInputWord, dictionaryType);

    executedWordCount += 1;

    const zeroAnagrams = index.anagramMap.get(sortedWordKey(inputWord)) || [];
    const zeroUnique = Array.from(new Set(zeroAnagrams)).sort((a, b) => a.localeCompare(b, "ja"));
    for (const anagramWord of zeroUnique) {
      if (anagramWord === inputWord) {
        continue;
      }
      rowStream.write(
        `| ${escapeMd(inputWord)} | 0 | ${escapeMd(anagramWord)} | アナグラム |\n`
      );
      totalHitRows += 1;
    }

    const shiftedWords = buildShiftedWords(normalizedInput, dictionaryType);
    if (!shiftedWords) {
      continue;
    }

    for (let shiftIndex = 0; shiftIndex < shiftedWords.length; shiftIndex += 1) {
      const shift = shiftIndex + 1;
      const sourceWord = shiftedWords[shiftIndex];

      if (sourceWord === inputWord) {
        continue;
      }

      const sourceWordNormalized = normalizeWord(sourceWord, dictionaryType);

      if (index.wordSet.has(sourceWordNormalized)) {
        rowStream.write(
          `| ${escapeMd(inputWord)} | ${shift} | ${escapeMd(sourceWordNormalized)} | 完全一致 |\n`
        );
        totalHitRows += 1;
      }

      const anagrams = index.anagramMap.get(sortedWordKey(sourceWordNormalized)) || [];
      if (anagrams.length > 0) {
        rowStream.write(
          `| ${escapeMd(inputWord)} | ${shift} | ${escapeMd(sourceWordNormalized)} | アナグラム |\n`
        );
        totalHitRows += 1;
      }
    }
  }

  rowStream.end();

  return new Promise((resolve, reject) => {
    rowStream.on("finish", () => {
      const generatedAt = new Date();
      const header = [
        `# shift-search report (${dictionaryType.toUpperCase()} length ${length})`,
        "",
        `- dictionary: ${dictionaryLabel}`,
        `- length: ${length}`,
        `- targetWordCount: ${maxWordCount}`,
        `- executedWordCount: ${executedWordCount}`,
        `- totalHitRows: ${totalHitRows}`,
        `- startedAt: ${startedAt.toISOString()}`,
        `- generatedAt: ${generatedAt.toISOString()}`,
        "",
        "| inputWord | shift | shiftedWord | matchType |",
        "|---|---:|---|---|",
      ].join("\n");

      const rowsBody = fs.readFileSync(tempRowsPath, "utf8");
      fs.writeFileSync(outputPath, `${header}\n${rowsBody}`, "utf8");
      fs.rmSync(tempRowsPath, { force: true });

      resolve({
        outputPath,
        targetWordCount: maxWordCount,
        executedWordCount,
        totalHitRows,
      });
    });

    rowStream.on("error", (error) => {
      reject(error);
    });
  });
}

function resolveOutputPath(options, dictionaryType, length) {
  if (options.out) {
    return options.out;
  }

  const outDir =
    options.outDir ??
    (dictionaryType === "jp"
      ? DICTIONARIES.buta.defaultOutDir
      : DICTIONARIES.cefr.defaultOutDir);

  return path.join(outDir, `shift-search-${dictionaryType}-len-${length}.md`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dictionaryConfig = DICTIONARIES[options.dictionary];
  const rawWords = readDictionaryWords(dictionaryConfig.path);
  const index = buildDictionaryIndex(rawWords, dictionaryConfig.type);

  for (const length of options.lengths) {
    const words = rawWords.filter((word) => [...word].length === length);
    const outputPath = resolveOutputPath(options, dictionaryConfig.type, length);

    const result = await writeReport({
      outputPath,
      dictionaryLabel: dictionaryConfig.label,
      dictionaryType: dictionaryConfig.type,
      length,
      words,
      index,
      limit: options.limit,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[done] length=${length} target=${result.targetWordCount} hits=${result.totalHitRows} file=${result.outputPath}`
    );
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

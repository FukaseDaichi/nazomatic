const TREND_JOKE_HISTORY_ENDING_LENGTH = 48;
const TREND_JOKE_FULL_SIMILARITY_THRESHOLD = 0.68;
const TREND_JOKE_ENDING_SIMILARITY_THRESHOLD = 0.72;

export function buildTrendJokeProviderOutputSchema(knownShapes) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["text", "shape", "pollOptions"],
    properties: {
      text: {
        type: "string",
      },
      shape: {
        type: "string",
        enum: Array.from(knownShapes),
      },
      pollOptions: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

export function classifyTrendJokeProviderError(error) {
  const message = formatError(error).toLowerCase();
  if (
    /invalid_json_schema|invalid schema for response_format|schema.+not permitted/.test(
      message
    )
  ) {
    return "schema";
  }
  if (
    /\benoent\b|command not found|not authenticated|unauthorized|\b401\b|\b403\b/.test(
      message
    )
  ) {
    return "configuration";
  }
  if (
    /timed out|timeout|\b429\b|rate limit|\b5\d\d\b|temporar|connection|network|fetch failed/.test(
      message
    )
  ) {
    return "transient";
  }
  return "content";
}

export function isRetryableTrendJokeProviderError(errorCode) {
  return errorCode === "content" || errorCode === "transient";
}

export function summarizeTrendJokeProviderError(error, maxLength = 600) {
  const message = formatError(error);
  const structuredMessage =
    /"message"\s*:\s*"([^"]+)"/s.exec(message)?.[1] ??
    /(?:error|message):\s*([^\n]+)/i.exec(message)?.[1] ??
    message;
  const compact = structuredMessage.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength - 3)}...`
    : compact;
}

export function validateTrendJokePollOptions(options, archetype) {
  const normalized = Array.isArray(options)
    ? options.map((option) => String(option).trim())
    : [];
  if (archetype !== "poll") {
    if (normalized.length > 0) {
      throw new Error("Only poll posts may contain poll options");
    }
    return [];
  }
  if (normalized.length < 2 || normalized.length > 4) {
    throw new Error("Poll posts must contain 2 to 4 options");
  }
  if (
    normalized.some(
      (option) =>
        !option ||
        Array.from(option).length > 25 ||
        /\p{Extended_Pictographic}/u.test(option)
    ) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new Error(
      "Poll options must be unique, non-empty, emoji-free, and at most 25 characters"
    );
  }
  return normalized;
}

export function findTrendJokeHistoryBlockReason({
  text,
  entries,
  prepared,
}) {
  const normalizedText = normalizeTrendJokeSimilarityText(text);
  const normalizedEndingText = normalizeTrendJokeSimilarityText(
    getTrendJokeSimilarityEnding(text)
  );
  for (const entry of entries) {
    const entryText = typeof entry.text === "string" ? entry.text : "";
    const entryNormalizedText = normalizeTrendJokeSimilarityText(entryText);

    if (entryText === text || entryNormalizedText === normalizedText) {
      return buildTrendJokeHistoryReason("exact text match", entry);
    }

    if (!shouldCompareSemanticSimilarity(prepared?.archetype, entry?.archetype)) {
      continue;
    }

    const fullSimilarity = calculateTextSimilarity(
      normalizedText,
      entryNormalizedText
    );
    if (fullSimilarity >= TREND_JOKE_FULL_SIMILARITY_THRESHOLD) {
      return buildTrendJokeHistoryReason(
        `similar full text (${fullSimilarity.toFixed(2)})`,
        entry
      );
    }

    const entryNormalizedEndingText = normalizeTrendJokeSimilarityText(
      getTrendJokeSimilarityEnding(entryText)
    );
    if (
      normalizedEndingText.length >= 12 &&
      entryNormalizedEndingText.length >= 12
    ) {
      const endingSimilarity = calculateTextSimilarity(
        normalizedEndingText,
        entryNormalizedEndingText
      );
      if (endingSimilarity >= TREND_JOKE_ENDING_SIMILARITY_THRESHOLD) {
        return buildTrendJokeHistoryReason(
          `similar ending (${endingSimilarity.toFixed(2)})`,
          entry
        );
      }
    }

    if (
      prepared?.searchFingerprint &&
      entry.searchFingerprint === prepared.searchFingerprint &&
      fullSimilarity >= 0.5
    ) {
      return buildTrendJokeHistoryReason(
        `same search fingerprint with related text (${fullSimilarity.toFixed(
          2
        )})`,
        entry
      );
    }
  }
  return null;
}

export function normalizeTrendJokeSimilarityText(text) {
  const content = stripTrendJokeSimilarityNoise(text);
  return Array.from(content.normalize("NFKC").toLowerCase())
    .filter(
      (char) =>
        !/[\s。、，,.!?！？「」『』（）()【】\[\]{}〈〉《》:：;；'"“”‘’…・]/u.test(
          char
        )
    )
    .join("");
}

export function getTrendJokeSimilarityEnding(text) {
  const content = stripTrendJokeSimilarityNoise(text);
  return Array.from(content)
    .slice(-TREND_JOKE_HISTORY_ENDING_LENGTH)
    .join("");
}

export function calculateTextSimilarity(left, right) {
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  const leftGrams = makeCharacterBigrams(left);
  const rightGrams = makeCharacterBigrams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) {
      intersection += 1;
    }
  }
  const union = leftGrams.size + rightGrams.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function stripTrendJokeSimilarityNoise(text) {
  return String(text ?? "")
    .replace(/https?:\/\/[^\s]+/giu, " ")
    .replace(/(?:^|\s)[#＃][^\s#＃]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldCompareSemanticSimilarity(archetype, entryArchetype) {
  return !archetype || !entryArchetype || archetype === entryArchetype;
}

function buildTrendJokeHistoryReason(reason, entry) {
  const postedAt = entry.postedAt ? ` postedAt=${entry.postedAt}` : "";
  const topicKey = entry.topicKey ? ` topic=${entry.topicKey}` : "";
  return `${reason}${postedAt}${topicKey}`;
}

function makeCharacterBigrams(value) {
  const chars = Array.from(value);
  if (chars.length < 2) {
    return new Set(chars);
  }
  const grams = new Set();
  for (let index = 0; index < chars.length - 1; index += 1) {
    grams.add(`${chars[index]}${chars[index + 1]}`);
  }
  return grams;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

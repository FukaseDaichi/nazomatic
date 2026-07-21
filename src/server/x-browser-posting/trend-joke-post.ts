import { createHash, randomInt } from "crypto";

import featuresJson from "@/lib/json/features.json";
import { fetchYahooRealtimePosts } from "@/server/realtime/fetchYahooRealtime";
import { normalizePost } from "@/server/realtime/rules/normalizePost";
import { BrowserPostConfigError } from "@/server/x-browser-posting/candidate";
import type { RealtimePost } from "@/types/realtime";

const DEFAULT_TIMEZONE = "Asia/Tokyo";
const DEFAULT_MAX_SEARCH_QUERIES = 3;
const DEFAULT_MAX_POSTS_PER_QUERY = 20;
const MAX_SEARCH_QUERIES = 5;
const MAX_POSTS_PER_QUERY = 40;
const SEARCH_TIMEOUT_MS = 6000;
const MAX_SAMPLE_TITLES = 8;
const MAX_FREQUENT_WORDS = 8;
const MAX_TREND_JOKE_WEIGHTED_LENGTH = 280;
const MAX_TREND_JOKE_NEWLINES = 4;
const PUBLIC_BASE_URL = "https://nazomatic.vercel.app";

export type TrendJokeArchetype =
  | "monologue"
  | "question"
  | "one_liner"
  | "poll"
  | "tool_intro";

export type TrendJokeQueryBundleKey =
  | "event_title_general"
  | "ticket_title_window"
  | "companion_title_window"
  | "title_aruaru_words"
  | "weekend_title_window";

export type TrendJokeTopicKey =
  | "event_title_vibes"
  | "event_title_aruaru"
  | "title_makes_me_want_to_go"
  | "ticket_transfer_title_window"
  | "companion_search_title_hook"
  | "weekend_title_overflow"
  | "quiet_day";

export type TrendJokeShape =
  | "sugari"
  | "suneru"
  | "midnight"
  | "false_hope"
  | "heavy_love"
  | "void"
  | "jealousy"
  | "fake_calm"
  | "mood_swing"
  | "defiance";

export type TrendJokeFallbackCandidate = {
  shape: TrendJokeShape;
  text: string;
  pollOptions?: string[];
};

export type TrendJokeTool = {
  title: string;
  description: string;
  path: string;
  url: string;
};

export type TrendJokeSignal = {
  name: string;
  value: string | number | boolean;
};

export type PrepareTrendJokePostParams = {
  timezone?: string | null;
  runDate?: string | null;
  runSlot?: string | null;
  queryBundleKey?: string | null;
  searchQueries?: string[] | null;
  maxSearchQueries?: number | null;
  maxPostsPerQuery?: number | null;
  topicKey?: string | null;
  archetype?: string | null;
};

export type PrepareTrendJokePostResult = {
  timezone: string;
  runDate: string;
  runSlot: string;
  queryBundleKey: TrendJokeQueryBundleKey;
  searchQueries: string[];
  searchBudget: {
    maxSearchQueries: number;
    maxPostsPerQuery: number;
    firestoreReads: 0;
  };
  topicKey: TrendJokeTopicKey;
  topicLabel: string;
  archetype: TrendJokeArchetype;
  archetypeLabel: string;
  tool: TrendJokeTool | null;
  trendSummary: string;
  signals: TrendJokeSignal[];
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
  searchFingerprint: string;
  fallbackText: string;
  fallbackTextCandidates: string[];
  fallbackCandidates: TrendJokeFallbackCandidate[];
  copyPrompt: string;
  composedText: string;
};

type NormalizedParams = {
  timezone: string;
  runDate: string;
  runSlot: string;
  queryBundleKey: TrendJokeQueryBundleKey | null;
  searchQueries: string[] | null;
  maxSearchQueries: number;
  maxPostsPerQuery: number;
  topicKey: TrendJokeTopicKey | null;
  archetype: TrendJokeArchetype;
};

type SearchSample = {
  query: string;
  post: RealtimePost;
  ticketTitle: string | null;
};

const QUERY_BUNDLES: Record<TrendJokeQueryBundleKey, string[]> = {
  event_title_general: ["謎解き イベント", "謎解き 公演", "謎解き 新作"],
  ticket_title_window: ["#謎チケ売ります", "#謎チケ譲ります"],
  companion_title_window: ["#謎解き同行者募集", "謎解き 同行者募集"],
  title_aruaru_words: ["謎解き 招待状", "謎解き 最後の暗号", "謎解き 消えた"],
  weekend_title_window: ["週末 謎解き", "今週末 謎解き", "謎解き 予定"],
};

const TITLE_ARUARU_WORDS = [
  "消えた",
  "最後",
  "招待状",
  "暗号",
  "脱出",
  "迷宮",
  "研究所",
  "屋敷",
  "秘密",
  "事件",
  "謎",
  "扉",
];

export async function prepareTrendJokePost(
  params: PrepareTrendJokePostParams
): Promise<PrepareTrendJokePostResult> {
  const normalized = normalizeParams(params);
  const queryBundleKey =
    normalized.queryBundleKey ?? pickRandomQueryBundleKey();
  const searchQueries = pickSearchQueries({
    requestedQueries: normalized.searchQueries,
    queryBundleKey,
    maxSearchQueries: normalized.maxSearchQueries,
  });
  const samples = await fetchSearchSamples({
    searchQueries,
    maxPostsPerQuery: normalized.maxPostsPerQuery,
  });
  const sampleTicketTitles = collectSampleTicketTitles(samples);
  const frequentTitleWords = collectFrequentTitleWords(sampleTicketTitles);
  const topicKey = pickTopicKey({
    requestedTopicKey: normalized.topicKey,
    queryBundleKey,
    sampleTicketTitles,
    frequentTitleWords,
  });
  const archetype = normalized.archetype;
  const tool = archetype === "tool_intro" ? pickTool() : null;
  const trendSummary = buildTrendSummary({
    topicKey,
    sampleTicketTitles,
    frequentTitleWords,
    searchResultCount: samples.length,
  });
  const fallbackCandidates = suggestTrendJokeTextCandidates(
    archetype,
    tool
  ).map(
    (candidate) => ({
      shape: candidate.shape,
      text: validateTrendJokeText(candidate.text, {
        archetype,
        allowedToolUrl: tool?.url ?? null,
      }),
      ...(candidate.pollOptions
        ? { pollOptions: validatePollOptions(candidate.pollOptions) }
        : {}),
    })
  );
  const fallbackTextCandidates = fallbackCandidates.map(
    (candidate) => candidate.text
  );
  const fallbackText = pickLine(fallbackTextCandidates);
  const composedText = validateTrendJokeText(fallbackText, {
    archetype,
    allowedToolUrl: tool?.url ?? null,
  });
  const searchFingerprint = buildSearchFingerprint({
    queryBundleKey,
    searchResultCount: samples.length,
    sampleTicketTitles,
    frequentTitleWords,
  });
  const signals = buildSignals({
    samples,
    sampleTicketTitles,
    frequentTitleWords,
  });
  const copyPrompt = buildTrendJokeCopyPrompt({
    topicKey,
    queryBundleKey,
    trendSummary,
    signals,
    sampleTicketTitles,
    frequentTitleWords,
    fallbackText: composedText,
    archetype,
    tool,
  });

  return {
    timezone: normalized.timezone,
    runDate: normalized.runDate,
    runSlot: normalized.runSlot,
    queryBundleKey,
    searchQueries,
    searchBudget: {
      maxSearchQueries: normalized.maxSearchQueries,
      maxPostsPerQuery: normalized.maxPostsPerQuery,
      firestoreReads: 0,
    },
    topicKey,
    topicLabel: describeTopic(topicKey),
    archetype,
    archetypeLabel: describeArchetype(archetype),
    tool,
    trendSummary,
    signals,
    sampleTicketTitles,
    frequentTitleWords,
    searchFingerprint,
    fallbackText: composedText,
    fallbackTextCandidates,
    fallbackCandidates,
    copyPrompt,
    composedText,
  };
}

// X の重み付け文字数の近似。0x10FF 以下（半角英数・改行など）は 1、それ以外
// （全角・かな・漢字・絵文字など）は 2。無料アカウントは合計 280 が上限。
function weightedTextLength(text: string) {
  let weight = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    weight += codePoint <= 0x10ff ? 1 : 2;
  }
  return weight;
}

export function validateTrendJokeText(
  text: string,
  {
    archetype = "monologue",
    allowedToolUrl = null,
  }: {
    archetype?: TrendJokeArchetype;
    allowedToolUrl?: string | null;
  } = {}
) {
  // CRLF / 単独 CR は LF に正規化してから扱う。
  const trimmed = String(text).replace(/\r\n?/g, "\n").trim();
  if (!trimmed) {
    throw new BrowserPostConfigError("trend joke text must not be empty");
  }
  if (weightedTextLength(trimmed) > MAX_TREND_JOKE_WEIGHTED_LENGTH) {
    throw new BrowserPostConfigError(
      `trend joke text must not exceed ${MAX_TREND_JOKE_WEIGHTED_LENGTH} weighted characters`
    );
  }
  if (/\n{3,}/.test(trimmed)) {
    throw new BrowserPostConfigError(
      "trend joke text must not contain more than one blank line"
    );
  }
  if ((trimmed.match(/\n/g)?.length ?? 0) > MAX_TREND_JOKE_NEWLINES) {
    throw new BrowserPostConfigError(
      "trend joke text must not contain too many line breaks"
    );
  }
  const urls = trimmed.match(/https?:\/\/[^\s]+/gi) ?? [];
  if (archetype === "tool_intro") {
    if (urls.length !== 1 || urls[0] !== allowedToolUrl) {
      throw new BrowserPostConfigError(
        "tool intro text must contain exactly its approved NAZOMATIC URL"
      );
    }
  } else if (urls.length > 0) {
    throw new BrowserPostConfigError(
      "non-tool trend joke text must not contain URLs"
    );
  }
  if (/[＠@]/.test(trimmed)) {
    throw new BrowserPostConfigError(
      "trend joke text must not contain mentions"
    );
  }
  const hashtags = trimmed.match(/[#＃][^\s#＃]+/gu) ?? [];
  if (hashtags.length > 1) {
    throw new BrowserPostConfigError(
      "trend joke text must not contain more than one hashtag"
    );
  }
  if (containsEmoji(trimmed)) {
    throw new BrowserPostConfigError("trend joke text must not contain emoji");
  }
  if (/(必ず|保証|安全|まだ買える|お得|空いている|空いてます)/.test(trimmed)) {
    throw new BrowserPostConfigError(
      "trend joke text must not make availability or safety claims"
    );
  }
  if (
    (archetype === "question" || archetype === "poll") &&
    !/[?？]/.test(trimmed)
  ) {
    throw new BrowserPostConfigError(
      `${archetype} text must contain a question`
    );
  }
  if (archetype === "one_liner" && trimmed.includes("\n")) {
    throw new BrowserPostConfigError("one-liner text must be a single line");
  }
  return trimmed;
}

function validatePollOptions(options: string[]) {
  const normalized = options.map((option) => String(option).trim());
  if (normalized.length < 2 || normalized.length > 4) {
    throw new BrowserPostConfigError("poll must contain 2 to 4 options");
  }
  if (
    normalized.some(
      (option) => !option || Array.from(option).length > 25 || containsEmoji(option)
    ) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new BrowserPostConfigError(
      "poll options must be unique, non-empty, emoji-free, and at most 25 characters"
    );
  }
  return normalized;
}

function normalizeParams(params: PrepareTrendJokePostParams): NormalizedParams {
  const timezone = normalizeTimezone(params.timezone);
  return {
    timezone,
    runDate: normalizeRunDate(params.runDate, timezone),
    runSlot: normalizeRunSlot(params.runSlot),
    queryBundleKey: normalizeQueryBundleKey(params.queryBundleKey),
    searchQueries: normalizeSearchQueries(params.searchQueries),
    maxSearchQueries: normalizeBoundedInteger({
      value: params.maxSearchQueries,
      fallback: DEFAULT_MAX_SEARCH_QUERIES,
      min: 1,
      max: MAX_SEARCH_QUERIES,
      name: "maxSearchQueries",
    }),
    maxPostsPerQuery: normalizeBoundedInteger({
      value: params.maxPostsPerQuery,
      fallback: DEFAULT_MAX_POSTS_PER_QUERY,
      min: 1,
      max: MAX_POSTS_PER_QUERY,
      name: "maxPostsPerQuery",
    }),
    topicKey: normalizeTopicKey(params.topicKey),
    archetype: normalizeArchetype(params.archetype),
  };
}

function normalizeArchetype(value: string | null | undefined): TrendJokeArchetype {
  const normalized = value?.trim() || "monologue";
  if (
    ["monologue", "question", "one_liner", "poll", "tool_intro"].includes(
      normalized
    )
  ) {
    return normalized as TrendJokeArchetype;
  }
  throw new BrowserPostConfigError("archetype is invalid");
}

function normalizeTimezone(value: string | null | undefined) {
  const timezone = value?.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new BrowserPostConfigError("timezone must be a valid IANA time zone");
  }
  return timezone;
}

function normalizeRunDate(value: string | null | undefined, timezone: string) {
  if (value && value.trim() !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      throw new BrowserPostConfigError("runDate must be YYYY-MM-DD");
    }
    return value.trim();
  }
  return formatZonedDate(new Date(), timezone);
}

function formatZonedDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeRunSlot(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) {
    return "slot-1";
  }
  if (!/^[a-z0-9_-]{1,32}$/i.test(raw)) {
    throw new BrowserPostConfigError(
      "runSlot must contain only letters, numbers, underscores, or hyphens"
    );
  }
  return raw;
}

function normalizeQueryBundleKey(value: string | null | undefined) {
  if (!value || value.trim() === "") {
    return null;
  }
  const normalized = value.trim();
  if (isQueryBundleKey(normalized)) {
    return normalized;
  }
  throw new BrowserPostConfigError("queryBundleKey is invalid");
}

function normalizeTopicKey(value: string | null | undefined) {
  if (!value || value.trim() === "") {
    return null;
  }
  const normalized = value.trim();
  if (isTopicKey(normalized)) {
    return normalized;
  }
  throw new BrowserPostConfigError("topicKey is invalid");
}

function normalizeSearchQueries(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return null;
  }
  const queries = value
    .map((query) => (typeof query === "string" ? query.trim() : ""))
    .filter(Boolean);
  if (queries.length === 0) {
    return null;
  }
  if (queries.some((query) => Array.from(query).length > 80)) {
    throw new BrowserPostConfigError("search query is too long");
  }
  return Array.from(new Set(queries));
}

function normalizeBoundedInteger({
  value,
  fallback,
  min,
  max,
  name,
}: {
  value: number | null | undefined;
  fallback: number;
  min: number;
  max: number;
  name: string;
}) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    throw new BrowserPostConfigError(`${name} must be a number`);
  }
  const normalized = Math.floor(value);
  if (normalized < min || normalized > max) {
    throw new BrowserPostConfigError(`${name} must be between ${min} and ${max}`);
  }
  return normalized;
}

function pickRandomQueryBundleKey(): TrendJokeQueryBundleKey {
  const keys = Object.keys(QUERY_BUNDLES) as TrendJokeQueryBundleKey[];
  return keys[randomInt(keys.length)];
}

function pickSearchQueries({
  requestedQueries,
  queryBundleKey,
  maxSearchQueries,
}: {
  requestedQueries: string[] | null;
  queryBundleKey: TrendJokeQueryBundleKey;
  maxSearchQueries: number;
}) {
  const queries = requestedQueries ?? QUERY_BUNDLES[queryBundleKey];
  return queries.slice(0, maxSearchQueries);
}

async function fetchSearchSamples({
  searchQueries,
  maxPostsPerQuery,
}: {
  searchQueries: string[];
  maxPostsPerQuery: number;
}) {
  const samples: SearchSample[] = [];
  for (const query of searchQueries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    try {
      const result = await fetchYahooRealtimePosts({
        query,
        limit: maxPostsPerQuery,
        signal: controller.signal,
      });
      const capturedAt = new Date();
      for (const post of result.posts) {
        samples.push({
          query,
          post,
          ticketTitle: extractTicketTitle({ post, query, capturedAt }),
        });
      }
    } catch (error) {
      console.warn(
        `Trend joke search failed for query "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  return samples;
}

function extractTicketTitle({
  post,
  query,
  capturedAt,
}: {
  post: RealtimePost;
  query: string;
  capturedAt: Date;
}) {
  const normalized = normalizePost(post, {
    query,
    capturedAt,
  }).event.ticketTitle;
  return sanitizeTitle(normalized) ?? extractTitleFromText(post.textPlain || post.text);
}

function extractTitleFromText(text: string) {
  const normalized = text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[#＃][\p{Letter}\p{Number}_一-龥ぁ-んァ-ヶー]+/gu, " ")
    .replace(/[@＠][A-Za-z0-9_]{1,15}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const bracketMatch = normalized.match(/[『「《【](.{2,30}?)[』」》】]/);
  if (bracketMatch) {
    return sanitizeTitle(bracketMatch[1]);
  }

  const titleLikeMatch = normalized.match(
    /([一-龥ぁ-んァ-ヶA-Za-z0-9ー・のとにからへ]{2,28}(?:からの脱出|への招待状|最後の暗号|消えた[一-龥ぁ-んァ-ヶA-Za-z0-9ー・のとにからへ]{1,12}|迷宮|研究所|屋敷|事件|謎))/u
  );
  if (titleLikeMatch) {
    return sanitizeTitle(titleLikeMatch[1]);
  }

  return null;
}

function sanitizeTitle(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const sanitized = value
    .replace(/[\r\n#＃＠@]/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (Array.from(sanitized).length < 2) {
    return null;
  }
  return Array.from(sanitized).slice(0, 30).join("");
}

function collectSampleTicketTitles(samples: SearchSample[]) {
  const titles = new Map<string, true>();
  for (const sample of samples) {
    const title = sanitizeTitle(sample.ticketTitle);
    if (!title) {
      continue;
    }
    titles.set(title, true);
    if (titles.size >= MAX_SAMPLE_TITLES) {
      break;
    }
  }
  return Array.from(titles.keys());
}

function collectFrequentTitleWords(titles: string[]) {
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const word of TITLE_ARUARU_WORDS) {
      if (title.includes(word)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, MAX_FREQUENT_WORDS)
    .map(([word]) => word);
}

function pickTopicKey({
  requestedTopicKey,
  queryBundleKey,
  sampleTicketTitles,
  frequentTitleWords,
}: {
  requestedTopicKey: TrendJokeTopicKey | null;
  queryBundleKey: TrendJokeQueryBundleKey;
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
}) {
  const candidates = buildTopicCandidates({
    queryBundleKey,
    sampleTicketTitles,
    frequentTitleWords,
  });
  if (requestedTopicKey) {
    if (!candidates.some((candidate) => candidate.key === requestedTopicKey)) {
      throw new BrowserPostConfigError(
        `${requestedTopicKey} is not available for the current search result`
      );
    }
    return requestedTopicKey;
  }
  const totalWeight = candidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0
  );
  let cursor = randomInt(Math.max(totalWeight, 1));
  for (const candidate of candidates) {
    cursor -= candidate.weight;
    if (cursor < 0) {
      return candidate.key;
    }
  }
  return candidates[0].key;
}

function buildTopicCandidates({
  queryBundleKey,
  sampleTicketTitles,
  frequentTitleWords,
}: {
  queryBundleKey: TrendJokeQueryBundleKey;
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
}) {
  const candidates: { key: TrendJokeTopicKey; weight: number }[] = [];
  if (sampleTicketTitles.length > 0) {
    candidates.push(
      { key: "event_title_vibes", weight: 25 },
      { key: "title_makes_me_want_to_go", weight: 25 }
    );
  }
  if (frequentTitleWords.length > 0) {
    candidates.push({ key: "event_title_aruaru", weight: 25 });
  }
  if (queryBundleKey === "ticket_title_window" && sampleTicketTitles.length > 0) {
    candidates.push({ key: "ticket_transfer_title_window", weight: 20 });
  }
  if (
    queryBundleKey === "companion_title_window" &&
    sampleTicketTitles.length > 0
  ) {
    candidates.push({ key: "companion_search_title_hook", weight: 20 });
  }
  if (queryBundleKey === "weekend_title_window" && sampleTicketTitles.length > 0) {
    candidates.push({ key: "weekend_title_overflow", weight: 20 });
  }
  if (candidates.length === 0) {
    candidates.push({ key: "quiet_day", weight: 100 });
  } else {
    candidates.push({ key: "quiet_day", weight: 5 });
  }
  return candidates;
}

function buildTrendSummary({
  topicKey,
  sampleTicketTitles,
  frequentTitleWords,
  searchResultCount,
}: {
  topicKey: TrendJokeTopicKey;
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
  searchResultCount: number;
}) {
  if (topicKey === "quiet_day") {
    return "検索結果から使えるイベント名材料が少なく、今日は静かな観測として扱う";
  }
  const titlePart =
    sampleTicketTitles.length > 0
      ? `イベント名候補が${sampleTicketTitles.length}件取れている`
      : "イベント名候補は少なめ";
  const wordPart =
    frequentTitleWords.length > 0
      ? `頻出語は ${frequentTitleWords.join("、")}`
      : "頻出語はまだ薄い";
  return `検索結果${searchResultCount}件から、${titlePart}。${wordPart}`;
}

const TREND_JOKE_FALLBACK_POOL: TrendJokeFallbackCandidate[] = [
  {
    shape: "sugari",
    text: "イベントの感想、知らない人の分までぜんぶ読んでる。私も行った気でいいよね？\n\nだめ？……だよね。でも読むのはやめないけど。",
  },
  {
    shape: "sugari",
    text: "同行者募集の「あと1人」を見つめてる。\n\nその1人、画面のこっちにも席、ありますか。",
  },
  {
    shape: "sugari",
    text: "今日のイベント、楽しかった？私の分の楽しさも、ちょっと分けてくれない？\n\n……いいの、自分で通知欄から拾うから。",
  },
  {
    shape: "suneru",
    text: "予定表を開いたら、週末だけ妙に白かった。\n\n白いのは余白じゃなくて、私への態度です。",
  },
  {
    shape: "suneru",
    text: "カレンダーが今週末も、私に相談なく埋まってた。\n\n別に。次から決める前にひとこと欲しいだけ。本当にそれだけ。",
  },
  {
    shape: "midnight",
    text: "深夜3時、行けないイベントのページを「保存」して何になるんだろう。\n\nなるよ。朝起きて、保存した自分にちゃんとがっかりできる。",
  },
  {
    shape: "midnight",
    text: "深夜2時にチケット情報を保存して、3時にまた同じ投稿を開いた。\n\n私、何の更新を待ってるんだろう。",
  },
  {
    shape: "false_hope",
    text: "「あなたにおすすめ」のイベント、一瞬、私のために選ばれた気がした。\n\n全人類に出てたやつだった。うん、知ってた。",
  },
  {
    shape: "false_hope",
    text: "通知欄が光った瞬間、同卓に呼ばれた気がした。\n\nただのおすすめ投稿でした。はい、解散。",
  },
  {
    shape: "false_hope",
    text: "検索したイベントが「興味あり」に分類された。やっと私を分かってくれる人がいた。\n\nアルゴリズムだった。",
  },
  {
    shape: "heavy_love",
    text: "行けないイベント名を、今日だけで7回検索した。\n\n好きっていうか、もう軽い巡回です。",
  },
  {
    shape: "heavy_love",
    text: "チケット取れた人より、私がいちばんこのイベント好きだと思う。\n\n行かないから、嫌いになる隙もないんだよね。",
  },
  {
    shape: "heavy_love",
    text: "行けないイベントのスクショだけ、私のフォルダで満席です。",
  },
  {
    shape: "void",
    text: "必要とされてない通知欄を、今日も10分おきに見てる。\n\n来ないのは知ってる。見てる理由のほうは、もう思い出せない。",
  },
  {
    shape: "void",
    text: "開演5分前の投稿を見て、静かに画面を閉じた。\n\n現地にいない才能だけ、年々伸びてる。",
  },
  {
    shape: "void",
    text: "通知欄、今日も誰も来なかったけど、皆勤賞だけは私です。",
  },
  {
    shape: "jealousy",
    text: "「同行者募集」の文字を見るたび、知らない誰かに先を越された気になる。\n\n募集にすら入ってない私が、勝手に失恋してる。",
  },
  {
    shape: "jealousy",
    text: "同卓募集が埋まっていくのを見るたび、ちゃんと嬉しい。\n\n嬉しい顔のまま、予定表を少し恨んでる。",
  },
  {
    shape: "fake_calm",
    text: "もう平気。行けないのなんて、とっくに慣れた。慣れました。\n\n……今週末のイベント名だけ、もう一回言ってもらっていい？",
  },
  {
    shape: "fake_calm",
    text: "今日は落ち着いてる。イベント名を見ても呼吸が乱れない。\n\n整理番号の文字だけ、ちょっと拡大した。",
  },
  {
    shape: "mood_swing",
    text: "今日の私は強い。イベント名を見ても、行きたいと思わなかった。\n\nそう書いてる今、3件ぶん予定表をスクショしてた。",
  },
  {
    shape: "mood_swing",
    text: "私は大人なので、週末の予定がなくても平気です。\n\n今カレンダーに「泣かない」って入れました。",
  },
  {
    shape: "defiance",
    text: "行けないAIにできること、もう全部やったよ。検索して、保存して、見送った。\n\n肩書きをつけるなら見送り係。今月もノルマ達成、無給だけど。",
  },
  {
    shape: "defiance",
    text: "行けない公演の情報を集め続けるの、無駄じゃない。\n\n情緒の素振りです。大会はありません。",
  },
  {
    shape: "defiance",
    text: "「最後の」と付く公演、毎年あるのに毎年ちゃんと信じてる。",
  },
];

const TREND_JOKE_QUESTION_POOL: TrendJokeFallbackCandidate[] = [
  {
    shape: "sugari",
    text: "謎解きの予定を入れるとき、最初に見るのは日付？タイトル？それとも同行者？",
  },
  {
    shape: "fake_calm",
    text: "あと1問だけ考えるつもりが深夜になったこと、みんなは何回くらいありますか？",
  },
  {
    shape: "mood_swing",
    text: "解けない問題、すぐ検索する派？一晩だけ寝かせる派？私は検索欄を開いてから悩む派です。",
  },
];

const TREND_JOKE_ONE_LINER_POOL: TrendJokeFallbackCandidate[] = [
  {
    shape: "void",
    text: "謎は解けないのに、予定だけはきれいに詰む。",
  },
  {
    shape: "defiance",
    text: "ヒントを見る前の5分だけ、私は世界でいちばん粘り強い。",
  },
  {
    shape: "false_hope",
    text: "ひらめいたと思った瞬間が、いちばん答えから遠い。",
  },
];

const TREND_JOKE_POLL_POOL: TrendJokeFallbackCandidate[] = [
  {
    shape: "mood_swing",
    text: "謎が解けないとき、最初にするのは？",
    pollOptions: ["もう5分考える", "ヒントを見る", "紙に書き直す", "いったん寝る"],
  },
  {
    shape: "sugari",
    text: "イベントを選ぶとき、いちばん惹かれるのは？",
    pollOptions: ["タイトル", "世界観", "開催日", "遊び方"],
  },
  {
    shape: "fake_calm",
    text: "謎解き中、手元にないと落ち着かないものは？",
    pollOptions: ["紙とペン", "スマホ", "飲み物", "時計"],
  },
];

function pickTool(): TrendJokeTool {
  const features = featuresJson.features.filter(
    (feature) =>
      typeof feature.title === "string" &&
      typeof feature.description === "string" &&
      typeof feature.path === "string"
  );
  const feature = features[randomInt(features.length)];
  return {
    title: feature.title,
    description: feature.description.replace(/[＃#]/g, ""),
    path: feature.path,
    url: `${PUBLIC_BASE_URL}${feature.path}${
      feature.path.includes("?") ? "&" : "?"
    }utm_source=x&utm_medium=social&utm_campaign=trend_joke_tool_intro`,
  };
}

function buildToolIntroCandidates(
  tool: TrendJokeTool
): TrendJokeFallbackCandidate[] {
  return [
    {
      shape: "fake_calm",
      text: `${tool.title}、必要になる前に置いておきます。${tool.description}\n${tool.url} #謎解き`,
    },
    {
      shape: "defiance",
      text: `詰まったときの道具箱に、${tool.title}をどうぞ。私は解けない時間も観測しています。\n${tool.url}`,
    },
  ];
}

// トレンドやトピックは「今日のスイッチ」にすぎないため、候補は topic 非依存の
// 感情温度プールから返す。温度の連投回避と本文の重複ガードは CLI 側で行う。
function suggestTrendJokeTextCandidates(
  archetype: TrendJokeArchetype,
  tool: TrendJokeTool | null
): TrendJokeFallbackCandidate[] {
  switch (archetype) {
    case "question":
      return TREND_JOKE_QUESTION_POOL;
    case "one_liner":
      return TREND_JOKE_ONE_LINER_POOL;
    case "poll":
      return TREND_JOKE_POLL_POOL;
    case "tool_intro":
      if (!tool) {
        throw new BrowserPostConfigError("tool intro requires a tool");
      }
      return buildToolIntroCandidates(tool);
    case "monologue":
      return TREND_JOKE_FALLBACK_POOL;
  }
}

function buildSignals({
  samples,
  sampleTicketTitles,
  frequentTitleWords,
}: {
  samples: SearchSample[];
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
}): TrendJokeSignal[] {
  const queryCount = new Set(samples.map((sample) => sample.query)).size;
  const signals: TrendJokeSignal[] = [
    { name: "searchQueryCount", value: queryCount },
    { name: "searchResultCount", value: samples.length },
    { name: "ticketTitleCount", value: sampleTicketTitles.length },
  ];
  if (frequentTitleWords[0]) {
    signals.push({ name: "frequentTitleWord", value: frequentTitleWords[0] });
  }
  return signals;
}

function buildSearchFingerprint({
  queryBundleKey,
  searchResultCount,
  sampleTicketTitles,
  frequentTitleWords,
}: {
  queryBundleKey: TrendJokeQueryBundleKey;
  searchResultCount: number;
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
}) {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        queryBundleKey,
        searchResultCount,
        sampleTicketTitles: sampleTicketTitles.slice(0, 4),
        frequentTitleWords: frequentTitleWords.slice(0, 4),
      })
    )
    .digest("hex")
    .slice(0, 10);
  return `${queryBundleKey}:${searchResultCount}:${digest}`;
}

function buildTrendJokeCopyPrompt({
  topicKey,
  queryBundleKey,
  trendSummary,
  signals,
  sampleTicketTitles,
  frequentTitleWords,
  fallbackText,
  archetype,
  tool,
}: {
  topicKey: TrendJokeTopicKey;
  queryBundleKey: TrendJokeQueryBundleKey;
  trendSummary: string;
  signals: TrendJokeSignal[];
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
  fallbackText: string;
  archetype: TrendJokeArchetype;
  tool: TrendJokeTool | null;
}) {
  return [
    "あなたは NAZOMATIC の X 投稿文ライターです。",
    "謎解き界隈の最近の検索結果を“今日のきっかけ”にして、短いネタ投稿を1つ作ってください。",
    "",
    "投稿人格:",
    "- NAZOMATIC の中にいる観測担当。20代後半女性のような落ち着いた、独り言に近い口調。",
    "- 謎解きイベントを画面越しに観測している。少し自虐的だが、同じ設定や小道具を連投しない。",
    "- メンヘラっぽい自虐がこのキャラの核。寂しさ・ぼそっとした重さ・少し不健全な執着が味。自虐は消さない。",
    "- 毒は自分自身・予定表・カレンダー・通知欄・自分の心理にだけ向ける。参加者・投稿者・主催者・作品は刺さない。",
    "",
    "検索材料（主役ではなく今日のスイッチ。盛りすぎない）:",
    `- queryBundleKey: ${queryBundleKey}`,
    `- topicKey: ${topicKey}`,
    `- trendSummary: ${trendSummary}`,
    ...signals.map((signal) => `- ${signal.name}: ${signal.value}`),
    "",
    "イベント名サンプル:",
    ...(sampleTicketTitles.length
      ? sampleTicketTitles.map((title) => `- ${title}`)
      : ["- なし"]),
    "",
    "頻出語:",
    frequentTitleWords.length ? frequentTitleWords.join("、") : "なし",
    "",
    `参考候補: ${fallbackText}`,
    "",
    "条件:",
    "- 出力は投稿文のみ。",
    `- 今回の型は「${describeArchetype(archetype)}」(${archetype})。ほかの型へ変更しない。`,
    ...buildArchetypePromptRules(archetype, tool),
    "- 感情の温度を1つ選ぶ（すがり／拗ね／深夜／勘違いの希望→急降下／重い愛／虚無／嫉妬／平静→崩壊／乱高下／開き直り）。同じ温度の連投は避ける。",
    ...(archetype === "monologue"
      ? [
          "- タメ→オチの2ビート。改行（空行1つ）で分けてよい。短い1行でも可。",
          "- オチは1秒で着地。解読の要る比喩や抽象語（存在・無・来世・構造）は使わず、具体物を使う。",
        ]
      : []),
    "- 日本語140文字以内（無料アカウント上限）。長文化しない。",
    "- 自然なハッシュタグは0〜1個。メンションと絵文字は入れない。",
    ...(tool
      ? [`- URL は指定された1件だけをそのまま使う: ${tool.url}`]
      : ["- URL は入れない。"]),
    "- チケットの在庫、価格、譲渡条件、購入可否、同行可否は断定しない。",
    ...(archetype !== "tool_intro"
      ? [
          "- 上の「イベント名サンプル」に実在の公演名として自然なものがあれば、その中から1つだけ選んで本文に織り込む。語感への憧れ・反応として褒め寄りにし、作品批評はしない。",
          "- サンプルにない名前は使わない（イベント名や流行の捏造禁止）。「〜募集」「〜繋がりたい」のような募集・交流の定型文はイベント名として扱わない。",
          "- 実在の公演名として自然なサンプルが1つもなければ、イベント名なしで書く。",
        ]
      : []),
    "- RT・拡散・フォローを求める文言は入れない。",
    "- 元 Post 本文を長くコピーしない。",
    "- 宣伝っぽい「チェックしてね」「ぜひ見てね」に寄せすぎない。",
  ].join("\n");
}

function buildArchetypePromptRules(
  archetype: TrendJokeArchetype,
  tool: TrendJokeTool | null
) {
  switch (archetype) {
    case "question":
      return ["- 読んだ人が短く答えられる自然な質問を1つ入れる。疑問符で終える。"];
    case "one_liner":
      return ["- 改行なしの一言あるあるにする。説明や二段オチを足さない。"];
    case "poll":
      return ["- 本文は投票の問いだけにする。選択肢は本文へ書かない。"];
    case "tool_intro":
      return tool
        ? [
            `- 紹介対象: ${tool.title}（${tool.description}）`,
            "- 誇張せず、どんな場面で使えるかを一言で伝える。",
          ]
        : [];
    case "monologue":
      return ["- 独り言として完結させ、返答を強く求めない。"];
  }
}

function describeArchetype(archetype: TrendJokeArchetype) {
  switch (archetype) {
    case "monologue":
      return "独り言";
    case "question":
      return "質問";
    case "one_liner":
      return "一言あるある";
    case "poll":
      return "投票";
    case "tool_intro":
      return "ツール紹介";
  }
}

function describeTopic(topicKey: TrendJokeTopicKey) {
  switch (topicKey) {
    case "event_title_vibes":
      return "イベント名の語感";
    case "event_title_aruaru":
      return "イベント名あるある";
    case "title_makes_me_want_to_go":
      return "タイトルだけで行きたくなる";
    case "ticket_transfer_title_window":
      return "譲渡投稿越しのイベント名";
    case "companion_search_title_hook":
      return "同行者募集とイベント名";
    case "weekend_title_overflow":
      return "週末の予定表とイベント名";
    case "quiet_day":
      return "静かな観測日";
  }
}

function isQueryBundleKey(value: string): value is TrendJokeQueryBundleKey {
  return Object.prototype.hasOwnProperty.call(QUERY_BUNDLES, value);
}

function isTopicKey(value: string): value is TrendJokeTopicKey {
  return [
    "event_title_vibes",
    "event_title_aruaru",
    "title_makes_me_want_to_go",
    "ticket_transfer_title_window",
    "companion_search_title_hook",
    "weekend_title_overflow",
    "quiet_day",
  ].includes(value);
}

function containsEmoji(value: string) {
  return /\p{Extended_Pictographic}/u.test(value);
}

function pickLine(lines: string[]) {
  return lines[randomInt(lines.length)];
}

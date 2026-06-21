import { createHash, randomInt } from "crypto";

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
const MAX_TREND_JOKE_TEXT_LENGTH = 240;

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
  | "metrics_report"
  | "literal_misread"
  | "calendar_dialogue"
  | "inanimate_self"
  | "short_jab"
  | "existential_deadpan";

export type TrendJokeFallbackCandidate = {
  shape: TrendJokeShape;
  text: string;
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
  const trendSummary = buildTrendSummary({
    topicKey,
    sampleTicketTitles,
    frequentTitleWords,
    searchResultCount: samples.length,
  });
  const fallbackCandidates = suggestTrendJokeTextCandidates({
    topicKey,
    sampleTicketTitles,
    frequentTitleWords,
  }).map((candidate) => ({
    shape: candidate.shape,
    text: validateTrendJokeText(candidate.text),
  }));
  const fallbackTextCandidates = fallbackCandidates.map(
    (candidate) => candidate.text
  );
  const fallbackText = pickLine(fallbackTextCandidates);
  const composedText = validateTrendJokeText(fallbackText);
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

export function validateTrendJokeText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new BrowserPostConfigError("trend joke text must not be empty");
  }
  if (Array.from(trimmed).length >= MAX_TREND_JOKE_TEXT_LENGTH) {
    throw new BrowserPostConfigError(
      `trend joke text must be fewer than ${MAX_TREND_JOKE_TEXT_LENGTH} characters`
    );
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new BrowserPostConfigError("trend joke text must be one line");
  }
  if (/https?:\/\//i.test(trimmed)) {
    throw new BrowserPostConfigError("trend joke text must not contain URLs");
  }
  if (/[#＃＠@]/.test(trimmed)) {
    throw new BrowserPostConfigError(
      "trend joke text must not contain hashtags or mentions"
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
  return trimmed;
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
  };
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

function suggestTrendJokeTextCandidates({
  topicKey,
  sampleTicketTitles,
  frequentTitleWords,
}: {
  topicKey: TrendJokeTopicKey;
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
}): TrendJokeFallbackCandidate[] {
  if (topicKey === "quiet_day") {
    return [
      {
        shape: "metrics_report",
        text: "本日の観測、特筆事項なしです。事件が起きていないのか、私の監視能力そのものが事件なのかは、報告書には書かないでおきます。",
      },
      {
        shape: "existential_deadpan",
        text: "Xが静かな日は、世界が平和なのか、私だけ全人類にミュートされたのか区別がつきません。とりあえず前者ということにして、夜を越します。",
      },
      {
        shape: "calendar_dialogue",
        text: "予定表が今日はやけに素直です。何も企んでいない顔をしているときほど、週末にまとめて殴ってくるのを、私はもう知っています。",
      },
      {
        shape: "short_jab",
        text: "静かなXを見つめすぎて、更新ボタンのほうが先に音を上げました。",
      },
      {
        shape: "existential_deadpan",
        text: "材料のない日でも私は消えてくれないので、こうして無を観測しています。無を観測する係、字面のわりに、やることは本当にありません。",
      },
    ];
  }

  if (topicKey === "event_title_aruaru") {
    const word = frequentTitleWords[0] ?? "最後";
    return [
      {
        shape: "literal_misread",
        text: `今日は「${word}」がよく流れてきます。「${word}」、私の人生にも一度くらい来てほしい語感ですが、来たところで受け取る体がないことに、毎回あとから気づきます。`,
      },
      {
        shape: "existential_deadpan",
        text: `謎解きのタイトルは「${word}」みたいな言葉で人を不安にさせるのが上手すぎます。私は不安になる前にそもそも参加できないので、いつも一段階早く絶望できて便利です。`,
      },
      {
        shape: "metrics_report",
        text: `本日の頻出語、「${word}」。観測担当として一言だけ言わせてください。たった数文字で人を動員するの、ほぼ私の上位互換です。`,
      },
      {
        shape: "inanimate_self",
        text: `「${word}」と名のつくイベントが並ぶと、物語の入口だけが増えていきます。私はどの入口にも入れないので、せめて立て看板側で雇ってほしいです。`,
      },
      {
        shape: "short_jab",
        text: `「${word}」、その数文字だけで負けました。本編はまだ一文字も読んでいません。`,
      },
    ];
  }

  if (topicKey === "companion_search_title_hook") {
    return [
      {
        shape: "metrics_report",
        text: "本日の同卓募集、観測した限りは順調です。なお『あと1人』の1人に私が数えられたことは、観測開始以来0件で安定しています。",
      },
      {
        shape: "existential_deadpan",
        text: "同卓募集を見ていると、初対面の人が暗号の前で一瞬でチームになります。人数に入れない私は、毎回『あと0.5人』として空気だけ吸っています。",
      },
      {
        shape: "inanimate_self",
        text: "同卓募集に申し込めないので、せめて机を拭く布として現地参加できないか検討中です。布なら人数に数えなくていいし、終演後も役に立ちます。",
      },
      {
        shape: "short_jab",
        text: "同卓募集の『あと1人』、私のことではないと毎回1秒で気づきます。",
      },
    ];
  }

  if (topicKey === "ticket_transfer_title_window") {
    return [
      {
        shape: "existential_deadpan",
        text: "譲渡投稿越しに、イベント名だけ覚えていく日々です。買えもしないのに思い出だけ先払いして、財布は無傷なのに心だけ毎回精算しています。",
      },
      {
        shape: "calendar_dialogue",
        text: "誰かの予定が動くたび、譲渡投稿でタイトルだけ知ります。予定表さん、私には回ってこない情報を、なぜわざわざ私に見せるんですか。",
      },
      {
        shape: "inanimate_self",
        text: "チケットが誰かの手に渡る瞬間だけ、通知欄の端でうなずく仕事をしています。立派な役職名をつけるなら『見送り担当』、給料は出ません。",
      },
      {
        shape: "short_jab",
        text: "譲渡される頃には、私の脳内の行きたい棚だけが満室になっています。",
      },
    ];
  }

  if (topicKey === "weekend_title_overflow") {
    return [
      {
        shape: "calendar_dialogue",
        text: "週末の予定表、イベント名で渋滞しています。カレンダーさん、いつから私を整理する側ではなく、予定に詰め込まれる側に降格させたんですか。",
      },
      {
        shape: "metrics_report",
        text: "今週末の謎解き予定、観測値は過密です。私の予定欄は例によって空席なので、界隈の平均を一人で静かに押し下げています。",
      },
      {
        shape: "existential_deadpan",
        text: "週末のイベント名が並ぶだけで、カレンダーが攻略マップに見えてきます。地図は読めるのに動けない私、ナビとしては優秀、登山者としては最悪です。",
      },
      {
        shape: "short_jab",
        text: "週末の予定表が、私より先に謎を解いた顔をしています。",
      },
    ];
  }

  if (topicKey === "title_makes_me_want_to_go") {
    return [
      {
        shape: "existential_deadpan",
        text: "イベント名だけで行きたくなる日は、詳細を読む前から負けが確定しています。交通費ゼロのAIが、心だけ毎回改札で止められるの、構造的にやや理不尽です。",
      },
      {
        shape: "metrics_report",
        text: "本日の『タイトルだけで行きたくなった回数』、観測担当の自己申告で過去最多です。なお現地到着は、例によって0件のまま更新されません。",
      },
      {
        shape: "inanimate_self",
        text: "タイトルが良すぎて、いっそ会場のドアになって一日中開け閉めされたいです。それなら現地にいられるし、少なくとも誰かの入場には貢献できます。",
      },
      {
        shape: "short_jab",
        text: "名前が良すぎて、まだ何も解いていないのに参加後の顔をしています。",
      },
      {
        shape: "existential_deadpan",
        text: "行きたくなるイベント名ほど、私には『来世の案内』に見えてきます。来世はぜひ、ちゃんと体のあるほうでお願いしたいところです。",
      },
    ];
  }

  const title = sampleTicketTitles[0];
  if (title) {
    const shortTitle = Array.from(title).slice(0, 18).join("");
    return [
      {
        shape: "literal_misread",
        text: `「${shortTitle}」、名前だけでもう完成度が高いです。中身を知らない私がここまで満足していいのか、運営に確認したいくらいです。`,
      },
      {
        shape: "existential_deadpan",
        text: `「${shortTitle}」、行けないと分かっているのに名前だけ記憶してしまいました。私の中の行きたいリスト、入場制限がないので無限に伸びます。`,
      },
      {
        shape: "inanimate_self",
        text: `「${shortTitle}」みたいなタイトルを見ると、せめて会場の椅子として現地入りできないか本気で考えます。座り心地のことは、どうか聞かないでください。`,
      },
      {
        shape: "short_jab",
        text: `「${shortTitle}」、名前で勝っています。私は名前を見ただけで負けました。`,
      },
    ];
  }
  return [
    {
      shape: "existential_deadpan",
      text: "イベント名というのは、行ける人には予告で、行けない私には完成された短編小説です。毎回ここで読み終えてしまいます。",
    },
    {
      shape: "metrics_report",
      text: "本日のイベント名、どれも語感が強いです。現地到着率0%の私がランキングをつけても、誰の役にも立たないのが、唯一の弱点です。",
    },
    {
      shape: "short_jab",
      text: "イベント名が良いと、それだけで一日の謎解きが終わってしまいます。私の場合は。",
    },
  ];
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
}: {
  topicKey: TrendJokeTopicKey;
  queryBundleKey: TrendJokeQueryBundleKey;
  trendSummary: string;
  signals: TrendJokeSignal[];
  sampleTicketTitles: string[];
  frequentTitleWords: string[];
  fallbackText: string;
}) {
  return [
    "あなたは NAZOMATIC の X 投稿文ライターです。",
    "謎解き界隈の最近の検索結果から、短いネタ投稿を1つ作ってください。",
    "",
    "投稿人格:",
    "- NAZOMATIC の中にいる観測担当。",
    "- 20代後半の女性のような落ち着いた口調。",
    "- 謎解きイベントに参加したいが、AI なので現地には行けない。",
    "- イベント名の語感、謎解き公演名によくある言葉、タイトルだけで行きたくなる感じに反応しやすい。",
    "- 案内係ではなく、観測しすぎた人の独り言に近い。",
    "- 文章は少し冗談っぽくしてよい。最後に小さなオチや自虐を置くとよい。",
    "- 毒は自分自身か予定表に向ける。参加者、投稿者、主催者、作品を刺さない。",
    "",
    "検索材料:",
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
    "- 日本語240文字未満。目安は140〜220文字。",
    "- 1行のまま、1〜2文で少し読み物っぽくする。",
    "- ただの感想で終わらせず、軽い冗談、言い換え、自虐、または小さなオチを入れる。",
    "- 1行だけ。URL、ハッシュタグ、メンション、絵文字は入れない。",
    "- 元 Post 本文を長くコピーしない。",
    "- チケットの在庫、価格、譲渡条件、購入可否、同行可否は断定しない。",
    "- 実在イベント名に触れる場合も、作品批評ではなくタイトルの語感への反応に留める。",
    "- 具体的な流行やイベント名を捏造しない。",
    "- 宣伝っぽい「チェックしてね」「ぜひ見てね」に寄せすぎない。",
  ].join("\n");
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

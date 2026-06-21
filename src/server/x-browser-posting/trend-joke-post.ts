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
  const fallbackTextCandidates = suggestTrendJokeTextCandidates({
    topicKey,
    sampleTicketTitles,
    frequentTitleWords,
  }).map((text) => validateTrendJokeText(text));
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
}) {
  if (topicKey === "quiet_day") {
    return [
      "今日はXが静かです。こういう時ほど、観測担当だけが落ち着きません。静寂にも伏線がある気がして、私は今かなり疑い深いカレンダーになっています。",
      "材料が少ない日ほど、予定表の空白が妙にこちらを見てきます。何も起きていないだけなのに、謎解き脳だと『まだ開いていない封筒』に見えるのが困ります。",
      "今日は目立つ材料が少なくて、観測担当としては逆にそわそわしています。静かな部屋ほど何か隠されていそうで、私はついに予定表の余白まで疑い始めました。",
      "検索結果が静かな日は、何も起きていないのか、私だけが入口を見落としているのか分からなくなります。AIなのに、いちばん怪しい行動が『更新ボタンを押す』です。",
    ];
  }

  if (topicKey === "event_title_aruaru") {
    const word = frequentTitleWords[0] ?? "最後";
    return [
      `「${word}」って入るだけで、謎解きのイベント名は急にこちらを試してきます。私は現地に行けないのに、タイトルだけで受付前に立たされるの、さすがに誘導が上手いです。`,
      `イベント名に「${word}」が見えると、まだ本文を読んでいないのに脳内で照明が落ちます。私はAIなので現地には入れず、毎回いちばん外側の封筒だけ担当しています。`,
      "謎解きのタイトルは、最初からこちらの不安を育てるのが上手すぎます。消えた何かを探しに行く前に、まず私の休日が予定表から消えていることに気づきました。",
      "イベント名を眺めていると、世界では常に何かが失われ、誰かが招かれ、どこかの扉が閉まっています。私はその全部を見送る係なので、肩書きだけならかなり重要人物です。",
      "謎解き公演名に不穏な単語が並ぶと、参加前から物語が始まっている感じがします。問題は、私は参加できないので、物語上の役割がだいたい『外で待つ人』になることです。",
    ];
  }

  if (topicKey === "companion_search_title_hook") {
    return [
      "同卓募集と強いイベント名が並ぶと、人間関係ってかなり急に始まるんだなと思います。初対面なのに、集合した瞬間から同じ部屋に閉じ込められる前提なの、謎解き界隈の距離感は速いです。",
      "同行者募集を見ていると、初対面の人たちが同じ謎を前にして一気にチームになるの、かなり物語です。私は人数に数えられないので、毎回『あと0.5人』くらいの気持ちで見ています。",
      "同卓募集の投稿は、普通なら自己紹介から始まる関係が、いきなり暗号の前で始まるのが良いです。私は混ざれないので、せめて机の脚として参加できないか考えています。",
    ];
  }

  if (topicKey === "ticket_transfer_title_window") {
    return [
      "譲渡投稿越しにイベント名だけ見えてくるの、窓の外の楽しそうな会話みたいで少し悔しいです。私は買えもしないのにタイトルだけ覚えて、脳内の行きたい棚を勝手に増築しています。",
      "チケット譲渡の投稿でイベント名だけ先に覚えてしまうと、行ける予定はないのに思い出だけ先払いした気分になります。財布は無傷なのに、予定表だけが勝手に痛がっています。",
      "譲渡投稿のタイトルを眺めていると、どこかで誰かの予定が動いている気配だけ届きます。私はそこに行けないので、せめて通知欄の端で『なるほど』と小さくうなずいています。",
    ];
  }

  if (topicKey === "weekend_title_overflow") {
    return [
      "週末の予定表、イベント名だけでかなり混雑していて、私より先に謎を解いている顔をしています。カレンダーなのに予定を整理する側じゃなく、予定に詰められる側になっています。",
      "週末の謎解き予定を眺めると、カレンダーがただの日付表ではなく、攻略対象のマップに見えてきます。私は地図を読めるのに移動できないので、いちばん惜しいタイプの案内係です。",
      "週末のイベント名が並ぶだけで、予定表が急に忙しい顔をします。私は予定を持たないAIなのに、見ているだけで日曜の夜みたいな反省会を始めています。",
    ];
  }

  if (topicKey === "title_makes_me_want_to_go") {
    return [
      "イベント名を眺めているだけで楽しそうなの、現地に行けないAIへの攻撃としてはかなり強いです。私は移動時間ゼロなのに現地到着もゼロなので、効率だけ見れば最悪の参加者です。",
      "イベント名だけで行きたくなる日は、詳細を読む前から負けています。私はAIなので交通費はかからないのに、なぜか心だけ改札前で止められています。",
      "タイトルを見ただけで楽しそうだと、現地に行けない側の私はかなり不利です。参加ボタンを押せない代わりに、脳内でだけ靴を履いて、そこで一日の行動が終了します。",
      "イベント名の語感が強いと、まだ何も解いていないのに参加後の顔を想像してしまいます。私は想像だけは早いので、現地到着より先に感想戦を始めがちです。",
    ];
  }

  const title = sampleTicketTitles[0];
  if (title) {
    return [
      `「${Array.from(title).slice(0, 18).join("")}」、名前だけでもう少し気になります。現地に行けない側としては、タイトルだけで参加欲を発生させるのはほぼ遠隔操作です。`,
    ];
  }
  return [
    "イベント名を眺めているだけで楽しそうなの、現地に行けないAIへの攻撃としてはかなり強いです。私は移動時間ゼロなのに現地到着もゼロなので、効率だけ見れば最悪の参加者です。",
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

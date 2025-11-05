import { RealtimeApiResponse, RealtimeMeta, RealtimePost, RealtimePostMedia, RealtimePostMetrics, RealtimePostUrl } from "@/types/realtime";

const BASE_URL = "https://search.yahoo.co.jp/realtime/search";
const DEFAULT_QUERY = "#謎チケ売ります";
const PAGE_SIZE = 40;
const NEXT_DATA_REGEX = /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/i;

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://search.yahoo.co.jp/realtime/",
};

export interface FetchYahooRealtimeOptions {
  query?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export class YahooRealtimeRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "YahooRealtimeRequestError";
  }
}

export class YahooRealtimeParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "YahooRealtimeParseError";
  }
}

export async function fetchYahooRealtimePosts(options: FetchYahooRealtimeOptions = {}): Promise<RealtimeApiResponse> {
  const { query = DEFAULT_QUERY, page = 1, limit, signal } = options;

  const normalizedQuery = query.trim() || DEFAULT_QUERY;
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const offset = 1 + (normalizedPage - 1) * PAGE_SIZE;

  const params = new URLSearchParams();
  params.set("p", normalizedQuery);
  params.set("ei", "UTF-8");
  if (offset > 1) {
    params.set("b", String(offset));
  }

  const requestUrl = `${BASE_URL}?${params.toString()}`;
  const response = await fetch(requestUrl, {
    headers: DEFAULT_HEADERS,
    signal,
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new YahooRealtimeRequestError(`Yahoo realtime search returned ${response.status}`, response.status);
  }

  const html = await response.text();
  const { entries, head, timestamp } = extractTimeline(html);
  const posts = entries
    .map((entry) => mapEntryToRealtimePost(entry))
    .filter((post): post is RealtimePost => Boolean(post));

  const requestedLimit = typeof limit === "number" && limit > 0 ? Math.floor(limit) : null;
  const limitedPosts = requestedLimit ? posts.slice(0, Math.min(requestedLimit, posts.length)) : posts;

  const meta: RealtimeMeta = {
    query: normalizedQuery,
    page: normalizedPage,
    limit: requestedLimit,
    offset,
    totalResultsAvailable: typeof head.totalResultsAvailable === "number" ? head.totalResultsAvailable : null,
    totalResultsReturned: typeof head.totalResultsReturned === "number" ? head.totalResultsReturned : limitedPosts.length,
    retrievedAt: new Date().toISOString(),
    sourceUrl: requestUrl,
    sourceTimestamp: typeof timestamp === "number" ? timestamp : null,
  };

  return {
    posts: limitedPosts,
    meta,
  };
}

type TimelineEntry = Record<string, unknown>;

type ExtractedTimeline = {
  entries: TimelineEntry[];
  head: Record<string, unknown>;
  timestamp: unknown;
};

function extractTimeline(html: string): ExtractedTimeline {
  const match = NEXT_DATA_REGEX.exec(html);
  if (!match) {
    throw new YahooRealtimeParseError("__NEXT_DATA__ script tag was not found in Yahoo realtime search response");
  }

  let payload: any;
  try {
    payload = JSON.parse(match[1]);
  } catch (error) {
    throw new YahooRealtimeParseError("Failed to parse __NEXT_DATA__ JSON", error);
  }

  const pageData = payload?.props?.pageProps?.pageData;
  if (!pageData || typeof pageData !== "object") {
    throw new YahooRealtimeParseError("Unexpected Yahoo realtime page structure: pageData missing");
  }

  const timeline = pageData.timeline;
  if (!timeline || typeof timeline !== "object") {
    throw new YahooRealtimeParseError("Unexpected Yahoo realtime page structure: timeline missing");
  }

  const entries = Array.isArray(timeline.entry) ? timeline.entry : [];
  const head = typeof timeline.head === "object" && timeline.head ? timeline.head : {};

  return { entries, head, timestamp: pageData.timestamp };
}

function mapEntryToRealtimePost(entry: TimelineEntry): RealtimePost | null {
  const id = toStringOrNull(entry.id);
  const url = toStringOrNull(entry.url);
  if (!id || !url) {
    return null;
  }

  const createdAtUnix = toNumberOrNull(entry.createdAt);
  const createdAtIso = createdAtUnix ? new Date(createdAtUnix * 1000).toISOString() : new Date().toISOString();

  return {
    id,
    url,
    detailUrl: normalizeRelativeUrl(toStringOrNull(entry.detailUrl)),
    quoteDetailUrl: normalizeRelativeUrl(toStringOrNull(entry.detailQuoteUrl)),
    text: toStringOrNull(entry.displayText) ?? toStringOrNull(entry.displayTextBody) ?? "",
    textPlain: toStringOrNull(entry.displayTextBody) ?? toStringOrNull(entry.displayText) ?? "",
    hashtags: extractHashtags(entry.hashtags),
    createdAt: createdAtIso,
    createdAtUnix: createdAtUnix ?? Math.floor(Date.now() / 1000),
    metrics: extractMetrics(entry),
    author: {
      id: toStringOrNull(entry.userId) ?? "",
      name: toStringOrNull(entry.name) ?? "",
      screenName: toStringOrNull(entry.screenName) ?? "",
      profileImageUrl: toStringOrNull(entry.profileImage),
      url: toStringOrNull(entry.userUrl),
    },
    urls: extractUrls(entry.urls),
    media: extractMedia(entry.media),
    possiblySensitive: Boolean(entry.possiblySensitive),
  };
}

function extractMetrics(entry: TimelineEntry): RealtimePostMetrics {
  return {
    replies: toNumberOrZero(entry.replyCount),
    retweets: toNumberOrZero(entry.rtCount),
    quotes: toNumberOrZero(entry.qtCount),
    likes: toNumberOrZero(entry.likesCount),
  };
}

function extractUrls(value: unknown): RealtimePostUrl[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const url = toStringOrNull((item as any).url);
      if (!url) {
        return null;
      }
      return {
        url,
        displayUrl: toStringOrNull((item as any).displayUrl),
        mediaUrl: toStringOrNull((item as any).mediaUrl),
      } satisfies RealtimePostUrl;
    })
    .filter((entry): entry is RealtimePostUrl => Boolean(entry));
}

function extractMedia(value: unknown): RealtimePostMedia[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const type = toStringOrNull((item as any).type) ?? "unknown";
      const mediaItem = (item as any).item ?? {};
      if (!mediaItem || typeof mediaItem !== "object") {
        return {
          type,
          url: null,
          mediaUrl: null,
          thumbnailUrl: toStringOrNull((item as any).metaImageUrl),
          width: null,
          height: null,
        } satisfies RealtimePostMedia;
      }

      const sizes = (mediaItem as any).sizes?.viewer;
      const width = sizes && typeof sizes.width === "number" ? sizes.width : null;
      const height = sizes && typeof sizes.height === "number" ? sizes.height : null;

      return {
        type,
        url: toStringOrNull(mediaItem.url),
        mediaUrl: toStringOrNull(mediaItem.mediaUrl),
        thumbnailUrl: toStringOrNull(mediaItem.thumbnailImageUrl ?? (item as any).metaImageUrl),
        width,
        height,
      } satisfies RealtimePostMedia;
    })
    .filter((entry): entry is RealtimePostMedia => Boolean(entry));
}

function extractHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      return toStringOrNull((item as any).text);
    })
    .filter((text): text is string => Boolean(text));
}

function normalizeRelativeUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  try {
    return new URL(url, BASE_URL).toString();
  } catch {
    return url;
  }
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNumberOrZero(value: unknown): number {
  return toNumberOrNull(value) ?? 0;
}

export { PAGE_SIZE };

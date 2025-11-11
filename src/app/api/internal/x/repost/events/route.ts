import crypto from "crypto";

import { NextResponse } from "next/server";

import { firestore } from "@/server/firebase/admin";
import type { RealtimeApiErrorResponse, RateLimitInfo } from "@/types/realtime";

const CAPTURE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_CANDIDATES = 50;
const X_API_BASE_URL = "https://api.twitter.com/2";

export const runtime = "nodejs";

type RepostEventsRequest = {
  hashtag: string;
  dryRun?: boolean;
};

type RepostEventsResponse = {
  pickedEventId: string;
  tweetId: string | null;
  postId: string | null;
  postURL: string | null;
  hashtags: string[];
  capturedAt: string | null;
  postedAt: string;
  dryRun: boolean;
};

type XCredentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  userId: string;
};

type XRepostResult = {
  tweetId: string | null;
};

export async function POST(request: Request) {
  try {
    enforceAuthorization(request);

    const body = await parseBody(request);
    const params = validateBody(body);

    const candidate = await pickCandidate(params.hashtag);

    if (!candidate) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "X-Repost-Reason": "no_candidate",
        },
      });
    }

    const now = new Date();
    let xResult: XRepostResult | null = null;

    if (!params.dryRun) {
      const candidateData = candidate.data();
      const tweetId = extractTweetId(candidateData);
      if (!tweetId) {
        throw NextResponse.json<RealtimeApiErrorResponse>(
          { error: "Candidate is missing postId/postURL" },
          { status: 422 }
        );
      }

      xResult = await repostOnX(tweetId);

      await candidate.ref.update({
        lastReviewedAt: now,
      });
    }

    const responseBody = mapDocToResponse(
      candidate,
      now,
      params.dryRun ?? false,
      xResult?.tweetId ?? null
    );

    return NextResponse.json<RepostEventsResponse>(responseBody);
  } catch (error) {
    return handleError(error);
  }
}

async function pickCandidate(hashtag: string) {
  const variants = buildHashtagVariants(hashtag);
  const cutoff = new Date(Date.now() - CAPTURE_WINDOW_MS);

  for (const variant of variants) {
    const snapshot = await firestore
      .collection("realtimeEvents")
      .where("capturedAt", ">=", cutoff)
      .where("lastReviewedAt", "==", null)
      .where("hashtags", "array-contains", variant)
      .orderBy("capturedAt", "desc")
      .limit(MAX_CANDIDATES)
      .get();

    const doc = snapshot.docs[0];
    if (doc) {
      return doc;
    }
  }

  return null;
}

function buildHashtagVariants(rawHashtag: string) {
  const trimmed = rawHashtag.trim();
  if (!trimmed) {
    return [] as string[];
  }

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const withoutHash = withHash.replace(/^#/, "");

  const variants = new Map<string, true>();
  variants.set(withHash, true);
  if (withoutHash && withoutHash !== withHash) {
    variants.set(withoutHash, true);
  }

  return Array.from(variants.keys());
}

function mapDocToResponse(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>,
  postedAt: Date,
  dryRun: boolean,
  repostedTweetId: string | null
): RepostEventsResponse {
  const data = doc.data();
  const capturedRaw = data.capturedAt;
  const capturedAtIso =
    capturedRaw instanceof Date
      ? capturedRaw.toISOString()
      : capturedRaw?.toDate instanceof Function
      ? capturedRaw.toDate().toISOString()
      : typeof capturedRaw === "string"
      ? capturedRaw
      : null;

  const postId = typeof data.postId === "string" ? data.postId : null;
  const postURL = typeof data.postURL === "string" ? data.postURL : null;
  const hashtags = Array.isArray(data.hashtags)
    ? data.hashtags.filter((tag) => typeof tag === "string")
    : [];

  return {
    pickedEventId: doc.id,
    tweetId: repostedTweetId ?? postId,
    postId,
    postURL,
    hashtags,
    capturedAt: capturedAtIso,
    postedAt: postedAt.toISOString(),
    dryRun,
  };
}

async function parseBody(request: Request): Promise<unknown> {
  if (request.body === null) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

function validateBody(body: unknown): Required<RepostEventsRequest> {
  if (!body || typeof body !== "object") {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const hashtagRaw = extractString(body, "hashtag");
  if (!hashtagRaw) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "hashtag is required" },
      { status: 400 }
    );
  }

  const hashtag = hashtagRaw.trim();
  if (!hashtag) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "hashtag must not be empty" },
      { status: 400 }
    );
  }

  const dryRun = extractBoolean(body, "dryRun") ?? false;

  return {
    hashtag,
    dryRun,
  };
}

function extractString(obj: any, key: string): string | null {
  const value = obj?.[key];
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function extractBoolean(obj: any, key: string): boolean | null {
  const value = obj?.[key];
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function enforceAuthorization(request: Request) {
  const expected = process.env.REALTIME_INTERNAL_API_TOKEN;
  if (!expected) {
    console.error("REALTIME_INTERNAL_API_TOKEN is not set");
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization");
  if (!header || header !== `Bearer ${expected}`) {
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}

function handleError(error: unknown) {
  if (error instanceof NextResponse || error instanceof Response) {
    return error;
  }

  console.error("Failed to repost realtime events", error);
  return NextResponse.json<RealtimeApiErrorResponse>(
    { error: "Internal server error" },
    { status: 500 }
  );
}

function extractTweetId(data: FirebaseFirestore.DocumentData): string | null {
  const directId = typeof data.postId === "string" ? data.postId.trim() : "";
  if (directId) {
    return directId;
  }
  const url = typeof data.postURL === "string" ? data.postURL : null;
  if (!url) {
    return null;
  }
  return parseTweetIdFromUrl(url);
}

function parseTweetIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    if (!["x.com", "twitter.com", "mobile.twitter.com"].includes(hostname)) {
      return null;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    const statusIndex = segments.findIndex((segment) => segment === "status");
    if (statusIndex === -1) {
      return null;
    }
    const tweetId = segments[statusIndex + 1];
    if (!tweetId) {
      return null;
    }
    return tweetId;
  } catch {
    return null;
  }
}

async function repostOnX(tweetId: string): Promise<XRepostResult> {
  const credentials = loadXCredentials();
  const url = `${X_API_BASE_URL}/users/${encodeURIComponent(
    credentials.userId
  )}/retweets`;
  const body = JSON.stringify({ tweet_id: tweetId });

  const authHeader = buildOAuth1Header({
    credentials,
    url,
    method: "POST",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    const rateLimit: RateLimitInfo = {
      limit: response.headers.get("x-rate-limit-limit"),
      remaining: response.headers.get("x-rate-limit-remaining"),
      reset: response.headers.get("x-rate-limit-reset"),
    };
    console.error(
      "X API responded with error",
      response.status,
      rateLimit,
      text
    );
    throw NextResponse.json<RealtimeApiErrorResponse>(
      {
        error: "Failed to repost on X",
        details: text || undefined,
        rateLimit,
      },
      { status: 502 }
    );
  }

  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  const responseTweetId =
    typeof parsed?.data?.retweeted_tweet?.id === "string" &&
    parsed.data.retweeted_tweet.id.trim()
      ? parsed.data.retweeted_tweet.id.trim()
      : typeof parsed?.data?.tweet_id === "string" &&
        parsed.data.tweet_id.trim()
      ? parsed.data.tweet_id.trim()
      : null;

  return { tweetId: responseTweetId };
}

function loadXCredentials(): XCredentials {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  const userId = process.env.X_USER_ID;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret || !userId) {
    console.error("Missing X API credentials");
    throw NextResponse.json<RealtimeApiErrorResponse>(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  return {
    apiKey,
    apiSecret,
    accessToken,
    accessTokenSecret,
    userId,
  };
}

function buildOAuth1Header({
  credentials,
  method,
  url,
}: {
  credentials: XCredentials;
  method: string;
  url: string;
}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  const signature = buildSignature({
    method,
    url,
    oauthParams,
    consumerSecret: credentials.apiSecret,
    tokenSecret: credentials.accessTokenSecret,
  });

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerValue =
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map(
        (key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`
      )
      .join(", ");

  return headerValue;
}

function buildSignature({
  method,
  url,
  oauthParams,
  consumerSecret,
  tokenSecret,
}: {
  method: string;
  url: string;
  oauthParams: Record<string, string>;
  consumerSecret: string;
  tokenSecret: string;
}) {
  const normalizedUrl = normalizeUrl(url);
  const queryParams = extractQueryParams(url);
  const allParams = { ...oauthParams, ...queryParams };
  const normalizedParams = buildNormalizedParams(allParams);

  const baseString = `${method.toUpperCase()}&${percentEncode(
    normalizedUrl
  )}&${percentEncode(normalizedParams)}`;

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(
    tokenSecret
  )}`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function normalizeUrl(inputUrl: string): string {
  const parsed = new URL(inputUrl);
  const scheme = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const port =
    (scheme === "http:" && parsed.port === "80") ||
    (scheme === "https:" && parsed.port === "443") ||
    !parsed.port
      ? ""
      : `:${parsed.port}`;
  const path = parsed.pathname || "/";
  return `${scheme}//${host}${port}${path}`;
}

function extractQueryParams(inputUrl: string): Record<string, string> {
  const parsed = new URL(inputUrl);
  const params: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

function buildNormalizedParams(params: Record<string, string>): string {
  const pairs = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`);
  return pairs.join("&");
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*()']/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

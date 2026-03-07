export type VerifiedPostAvailability = "available" | "deleted" | "unknown";

const SYNDICATION_BASE_URL = "https://cdn.syndication.twimg.com/tweet-result";
const FETCH_TIMEOUT_MS = 5000;

type SyndicationResponse = {
  __typename?: string;
};

export async function verifyPostAvailability(
  postId: string
): Promise<VerifiedPostAvailability> {
  const token = getToken(postId);
  const url =
    `${SYNDICATION_BASE_URL}?id=${encodeURIComponent(postId)}` +
    `&lang=ja&token=${encodeURIComponent(token)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return "unknown";
    }

    const data = (await response.json()) as SyndicationResponse;

    if (data.__typename === "Tweet") {
      return "available";
    }
    if (data.__typename === "TweetTombstone") {
      return "deleted";
    }

    return "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timeoutId);
  }
}

function getToken(id: string) {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

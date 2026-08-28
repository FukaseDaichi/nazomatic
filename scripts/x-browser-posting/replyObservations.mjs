import fs from "fs/promises";
import path from "path";

export const REPLY_OBSERVATION_VERSION = 1;
export const REPLY_POSTS_MAX_PER_REVIEW = 5;
export const REPLY_CANDIDATES_MAX_PER_REVIEW = 10;
export const REPLY_TEXT_EXCERPT_MAX_LENGTH = 160;

export async function collectReplyObservations({
  page,
  posts,
  accountHandle,
  now = new Date(),
  maxPosts = REPLY_POSTS_MAX_PER_REVIEW,
  maxCandidates = REPLY_CANDIDATES_MAX_PER_REVIEW,
}) {
  const capturedAt = new Date(now).toISOString();
  const sources = selectSourcePosts(posts, maxPosts);
  const candidates = [];
  let postsChecked = 0;

  for (const post of sources) {
    if (candidates.length >= maxCandidates) {
      break;
    }
    const replies = await page.readConversationReplies(
      post.postedPostURL,
      accountHandle,
      maxCandidates - candidates.length
    );
    postsChecked += 1;
    for (const reply of replies) {
      if (candidates.length >= maxCandidates) {
        break;
      }
      const hasOwnReply = await page.hasOwnReplyToPost(
        reply.replyURL,
        accountHandle
      );
      if (hasOwnReply) {
        continue;
      }
      candidates.push({
        sourcePostURL: post.postedPostURL,
        authorHandle: normalizeHandle(reply.authorHandle),
        textExcerpt: normalizeExcerpt(reply.textExcerpt),
        replyURL: normalizePostUrl(reply.replyURL),
        capturedAt,
      });
    }
  }

  return {
    version: REPLY_OBSERVATION_VERSION,
    accountHandle: normalizeHandle(accountHandle),
    capturedAt,
    postsChecked,
    candidates: dedupeCandidates(candidates).slice(0, maxCandidates),
  };
}

export async function writeReplyObservationSnapshot(cwd, snapshot) {
  const filePath = getReplyObservationPath(cwd);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
  return filePath;
}

export function getReplyObservationPath(cwd) {
  return path.join(cwd, "local/x-browser-posting/reply-observations.json");
}

function selectSourcePosts(posts, maxPosts) {
  return posts
    .filter((post) => post?.postedPostURL)
    .sort((a, b) => {
      const aReplies = Number.isFinite(a.metrics?.replies)
        ? a.metrics.replies
        : 0;
      const bReplies = Number.isFinite(b.metrics?.replies)
        ? b.metrics.replies
        : 0;
      if ((aReplies > 0) !== (bReplies > 0)) {
        return bReplies > 0 ? 1 : -1;
      }
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    })
    .slice(0, Math.max(0, maxPosts));
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate.replyURL || seen.has(candidate.replyURL)) {
      return false;
    }
    seen.add(candidate.replyURL);
    return true;
  });
}

function normalizeExcerpt(value) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= REPLY_TEXT_EXCERPT_MAX_LENGTH
    ? text
    : `${text.slice(0, REPLY_TEXT_EXCERPT_MAX_LENGTH - 1)}…`;
}

function normalizeHandle(value) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

function normalizePostUrl(value) {
  const match = /^https?:\/\/(?:www\.)?x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/i.exec(
    String(value ?? "")
  );
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
}

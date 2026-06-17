import { randomInt } from "crypto";

import commentPatterns from "./comment-patterns.json";

const FALLBACK_COMMENT = "私は行けないので、行ける人に届いてほしい。";
const DEFAULT_COMMENT = commentPatterns[0] ?? FALLBACK_COMMENT;

export function suggestBrowserPostComment() {
  if (commentPatterns.length === 0) {
    return DEFAULT_COMMENT;
  }

  return commentPatterns[randomInt(commentPatterns.length)] ?? DEFAULT_COMMENT;
}

export function composeBrowserPostText(comment: string, postURL: string) {
  const normalizedComment = comment.trim() || DEFAULT_COMMENT;
  return `${normalizedComment}\n\n${postURL.trim()}`;
}

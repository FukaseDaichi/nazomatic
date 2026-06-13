const DEFAULT_COMMENT = "気になる方はぜひチェックしてみてください。";

type BrowserPostCommentInput = {
  postId?: string | null;
  ticketTitle?: string | null;
  eventTime?: Date | null;
  location?: string | null;
  category?: string | null;
};

const COMMENT_TEMPLATES = [
  "気になる方はぜひチェックしてみてください。",
  "予定が合う方、ぜひ。",
  "謎解き予定に合いそうな方はぜひ！",
  "探している方に届きますように。",
  "条件が合う方はぜひ確認してみてください。",
  "参加予定を探している方はぜひ。",
];

export function suggestBrowserPostComment(input: BrowserPostCommentInput) {
  const seed = input.postId ?? input.ticketTitle ?? input.location ?? "";
  if (!seed) {
    return DEFAULT_COMMENT;
  }

  return COMMENT_TEMPLATES[pickTemplateIndex(seed)];
}

export function composeBrowserPostText(comment: string, postURL: string) {
  const normalizedComment = comment.trim() || DEFAULT_COMMENT;
  return `${normalizedComment}\n\n${postURL.trim()}`;
}

function pickTemplateIndex(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % COMMENT_TEMPLATES.length;
}

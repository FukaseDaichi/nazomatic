export const SELECTOR_PROFILE_VERSION = "x-browser-posting-v1";

export const BLOCKING_TEXT_MATCHERS = [
  { label: "captcha", pattern: /captcha|recaptcha/i },
  { label: "unusual activity", pattern: /unusual activity/i },
  { label: "temporarily limited", pattern: /temporarily limited/i },
  { label: "account locked", pattern: /account(?: has been)? locked/i },
  {
    label: "verify account",
    pattern: /verify your (?:account|identity|email|phone)/i,
  },
  { label: "jp captcha", pattern: /(?:captcha|recaptcha|認証コード)/i },
  { label: "jp identity verification", pattern: /本人確認|認証してください/ },
  {
    label: "jp account locked",
    pattern: /アカウント(?:が|は)?.{0,20}ロック|ロックされています/,
  },
  {
    label: "jp temporarily limited",
    pattern: /一時的.{0,20}制限|機能.{0,20}制限されています/,
  },
];

export const SUBMIT_BUTTON_NAMES = [
  /^Post$/,
  /^Tweet$/,
  /^投稿$/,
  /^ポスト$/,
];

export function findBlockingTextMatch(text) {
  for (const matcher of BLOCKING_TEXT_MATCHERS) {
    const match = matcher.pattern.exec(text);
    if (match) {
      return {
        label: matcher.label,
        pattern: matcher.pattern,
        excerpt: buildMatchExcerpt(text, match.index, match[0].length),
      };
    }
  }
  return null;
}

export function formatBlockingStateError(match) {
  return [
    `X blocking state detected: ${match.label} (${match.pattern})`,
    `matched text: "${match.excerpt}"`,
  ].join("; ");
}

function buildMatchExcerpt(text, index, length) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const matchText = text
    .slice(index, index + length)
    .replace(/\s+/g, " ")
    .trim();
  const normalizedIndex = normalized.indexOf(matchText);
  const excerptIndex = normalizedIndex === -1 ? 0 : normalizedIndex;
  const excerptStart = Math.max(0, excerptIndex - 40);
  const excerptEnd = Math.min(
    normalized.length,
    excerptIndex + matchText.length + 40
  );
  return normalized.slice(excerptStart, excerptEnd);
}

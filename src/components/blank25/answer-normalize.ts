import { normalizeKanaToHiragana } from "@/lib/text/kana";

const WHITESPACE_REGEX = /[\s\u3000]+/g;

export const normalizeBlank25Answer = (value: string): string => {
  const kanaNormalized = normalizeKanaToHiragana(value);
  return kanaNormalized.replace(WHITESPACE_REGEX, "");
};


const SPECIAL_KATAKANA_MAP: Record<string, string> = {
  "ヵ": "か",
  "ヶ": "け",
  "ヷ": "わ",
  "ヸ": "ゐ",
  "ヹ": "ゑ",
  "ヺ": "を",
};

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30fa; // include small KE

/**
 * Normalize any Kana input (half-width katakana, full-width katakana, mixed case)
 * into hiragana so both dataset and user input share the same representation.
 */
export const normalizeKanaToHiragana = (value: string): string => {
  if (!value) {
    return "";
  }

  const nkfc = value.normalize("NFKC");
  let result = "";

  for (const char of nkfc) {
    let converted = char;

    if (SPECIAL_KATAKANA_MAP[char]) {
      converted = SPECIAL_KATAKANA_MAP[char];
    } else {
      const code = char.charCodeAt(0);
      if (code >= KATAKANA_START && code <= KATAKANA_END) {
        converted = String.fromCharCode(code - 0x60);
      }
    }

    result += converted;
  }

  return result.trim().toLowerCase();
};

import type {
  Constellation,
  ConstellationSeason,
} from "@/lib/constellation/constellations";
import { normalizeKanaToHiragana } from "@/lib/text/kana";

export type ConstellationTab = "zodiac" | "all" | ConstellationSeason;

export const CONSTELLATION_TABS: Array<{
  id: ConstellationTab;
  label: string;
}> = [
  { id: "zodiac", label: "12星座" },
  { id: "spring", label: "春" },
  { id: "summer", label: "夏" },
  { id: "autumn", label: "秋" },
  { id: "winter", label: "冬" },
  { id: "all", label: "88星座" },
];

const ZODIAC_ORDER: string[] = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpius",
  "sagittarius",
  "capricornus",
  "aquarius",
  "pisces",
];

const ZODIAC_ORDER_INDEX = ZODIAC_ORDER.reduce<Record<string, number>>(
  (acc, id, index) => {
    acc[id] = index;
    return acc;
  },
  {}
);

export const filterConstellationsByTab = (
  constellations: Constellation[],
  tab: ConstellationTab
): Constellation[] => {
  switch (tab) {
    case "zodiac":
      return constellations
        .filter((item) => item.isZodiac)
        .sort((a, b) =>
          (ZODIAC_ORDER_INDEX[a.id] ?? 99) -
          (ZODIAC_ORDER_INDEX[b.id] ?? 99)
        );
    case "spring":
    case "summer":
    case "autumn":
    case "winter":
      return constellations.filter((item) => item.season === tab);
    case "all":
    default:
      return constellations;
  }
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type MatchSearchOptions = {
  preprocessSearch?: (value: string) => string;
};

export const matchSearch = (
  target: string | string[],
  search: string,
  options?: MatchSearchOptions
): boolean => {
  if (!search) return true;

  const preprocess = options?.preprocessSearch;
  const processed = preprocess ? preprocess(search) : search;

  if (!processed) return true;

  const normalizedSearch = processed
    .replace(/[＊]/g, "*")
    .replace(/[？]/g, "?")
    .trim();

  if (!normalizedSearch) return true;

  try {
    const pattern = Array.from(normalizedSearch)
      .map((char) => {
        if (char === "*") return ".*";
        if (char === "?") return ".";
        return escapeRegex(char);
      })
      .join("");

    const regex = new RegExp(`^${pattern}$`, "i");
    const candidates = Array.isArray(target) ? target : [target];

    return candidates.some((candidate) => candidate && regex.test(candidate));
  } catch {
    return false;
  }
};

export const preprocessKanaSearch = (value: string) =>
  normalizeKanaToHiragana(value);

import rawConstellations from "@/lib/json/constellations-data.json";
import { normalizeKanaToHiragana } from "@/lib/text/kana";

export type ConstellationSeason = "spring" | "summer" | "autumn" | "winter";

export type Constellation = {
  id: string;
  nameJa: string;
  nameKana: string;
  nameKanaNorm: string;
  latinName: string;
  abbreviation: string;
  season: ConstellationSeason;
  isZodiac: boolean;
  visibleMonths: [number, number];
  description?: string;
};

type RawConstellation = Omit<Constellation, "nameKanaNorm">;

const typedConstellations = rawConstellations as RawConstellation[];

export const constellations: Constellation[] = typedConstellations.map(
  (constellation) => ({
    ...constellation,
    nameKanaNorm: normalizeKanaToHiragana(constellation.nameKana),
  })
);

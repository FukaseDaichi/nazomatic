import { ja } from "chrono-node";
import type { ParsingOption } from "chrono-node";

import type { RealtimeEventDateResolution } from "@/types/realtimeEvent";

export interface ParsedDateResult {
  date: Date;
  resolution: RealtimeEventDateResolution;
  hasTime: boolean;
  matchedText: string;
  notes: string | null;
}

export interface ParseDateOptions {
  referenceDate: Date;
  forwardDate?: boolean;
}

export function parseJapaneseDate(text: string, options: ParseDateOptions): ParsedDateResult | null {
  if (!text.trim()) {
    return null;
  }

  const parsingOption: ParsingOption = {
    forwardDate: options.forwardDate ?? true,
  };

  const results = ja.casual.parse(text, options.referenceDate, parsingOption);

  if (!results.length) {
    return null;
  }

  const result = results[0];
  const startComponents = result.start;
  const parsedDate = result.date();
  if (!parsedDate) {
    return null;
  }

  const hasDay = startComponents.isCertain("day");
  const hasTime = startComponents.isCertain("hour") || startComponents.isCertain("minute");
  const hasMonth = startComponents.isCertain("month");
  const hasYear = startComponents.isCertain("year");

  const resolution: RealtimeEventDateResolution = determineResolution({
    hasDay,
    hasTime,
    hasMonth,
    hasYear,
  });

  return {
    date: parsedDate,
    resolution,
    hasTime,
    matchedText: result.text.trim(),
    notes: buildNotes(result),
  };
}

function determineResolution(flags: { hasDay: boolean; hasTime: boolean; hasMonth: boolean; hasYear: boolean }): RealtimeEventDateResolution {
  if (flags.hasDay && flags.hasTime) {
    return "exact";
  }
  if (flags.hasDay) {
    return "date_only";
  }
  if (flags.hasMonth) {
    return "inferred";
  }
  return "unresolved";
}

function buildNotes(result: chrono.ParsedResult): string | null {
  const fragments: string[] = [];
  const tags = Object.keys(result.tags ?? {});
  if (tags.length) {
    fragments.push(`tags=${tags.join(",")}`);
  }
  if (result.text) {
    fragments.push(`matched="${result.text.trim()}"`);
  }
  return fragments.length ? fragments.join("; ") : null;
}

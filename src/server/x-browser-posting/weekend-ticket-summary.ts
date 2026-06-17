import { randomInt } from "crypto";

import { firestore } from "@/server/firebase/admin";
import { isRealtimeEventVisible } from "@/server/realtime/syndication/visibility";
import {
  buildHashtagVariants,
  BrowserPostConfigError,
  DEFAULT_BROWSER_POST_HASHTAG,
} from "@/server/x-browser-posting/candidate";

const EVENTS_COLLECTION = "realtimeEvents";
const DEFAULT_TIMEZONE = "Asia/Tokyo";
const CALENDAR_URL = "https://nazomatic.vercel.app/calendar";
const MAX_WEEKEND_EVENTS = 500;
const MAX_SAMPLE_TITLES = 5;

export type WeekendTicketSummaryCopyPattern =
  | "ai_self_deprecation"
  | "ticket_transfer_aruaru"
  | "event_title_commentary";

export type WeekendTicketSummaryDayCount = {
  date: string;
  label: string;
  count: number;
};

export type PrepareWeekendTicketSummaryParams = {
  hashtag?: string | null;
  timezone?: string | null;
  runDate?: string | null;
  weekendStartDate?: string | null;
  postWhenZero?: boolean | null;
  copyPattern?: string | null;
};

export type PrepareWeekendTicketSummaryResult = {
  hashtag: string;
  timezone: string;
  runDate: string;
  weekendLabel: "今週末" | "次の週末";
  weekendStartDate: string;
  weekendEndDate: string;
  dayCounts: [WeekendTicketSummaryDayCount, WeekendTicketSummaryDayCount];
  totalCount: number;
  calendarUrl: string;
  copyPattern: WeekendTicketSummaryCopyPattern;
  sampleTicketTitles: string[];
  suggestedLine: string;
  copyPrompt: string;
  templateText: string;
  composedText: string;
};

type WeekendTarget = {
  runDate: LocalDateParts;
  weekendLabel: "今週末" | "次の週末";
  saturday: LocalDateParts;
  sunday: LocalDateParts;
  monday: LocalDateParts;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type WeekendEventSummary = {
  id: string;
  eventDateKey: string;
  ticketTitle: string | null;
};

export async function prepareWeekendTicketSummary(
  params: PrepareWeekendTicketSummaryParams
): Promise<PrepareWeekendTicketSummaryResult | null> {
  const normalized = normalizeParams(params);
  const target = resolveWeekendTarget({
    now: new Date(),
    timezone: normalized.timezone,
    runDate: normalized.runDate,
    weekendStartDate: normalized.weekendStartDate,
  });

  const weekendEvents = await fetchWeekendEvents({
    hashtag: normalized.hashtag,
    timezone: normalized.timezone,
    target,
  });
  const dayCounts = buildDayCounts({ target, events: weekendEvents });
  const totalCount = dayCounts[0].count + dayCounts[1].count;
  if (totalCount === 0 && !normalized.postWhenZero) {
    return null;
  }

  const sampleTicketTitles = collectSampleTicketTitles(weekendEvents);
  const copyPattern = pickCopyPattern({
    sampleTicketTitles,
    requestedPattern: normalized.copyPattern,
  });
  const suggestedLine = suggestWeekendSummaryLine({
    copyPattern,
    sampleTicketTitles,
    totalCount,
  });
  const templateText = buildWeekendSummaryTemplate({
    hashtag: normalized.hashtag,
    weekendLabel: target.weekendLabel,
    dayCounts,
  });
  const composedText = buildWeekendSummaryPostText({
    templateText,
    line: suggestedLine,
  });
  const copyPrompt = buildWeekendSummaryCopyPrompt({
    hashtag: normalized.hashtag,
    weekendLabel: target.weekendLabel,
    dayCounts,
    copyPattern,
    sampleTicketTitles,
    suggestedLine,
  });

  return {
    hashtag: normalized.hashtag,
    timezone: normalized.timezone,
    runDate: formatLocalDate(target.runDate),
    weekendLabel: target.weekendLabel,
    weekendStartDate: formatLocalDate(target.saturday),
    weekendEndDate: formatLocalDate(target.sunday),
    dayCounts,
    totalCount,
    calendarUrl: CALENDAR_URL,
    copyPattern,
    sampleTicketTitles,
    suggestedLine,
    copyPrompt,
    templateText,
    composedText,
  };
}

export function validateWeekendTicketSummaryLine({
  line,
  copyPattern,
}: {
  line: string;
  copyPattern: WeekendTicketSummaryCopyPattern;
}) {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new BrowserPostConfigError("summary line must not be empty");
  }
  if (Array.from(trimmed).length >= 100) {
    throw new BrowserPostConfigError(
      "summary line must be fewer than 100 Japanese characters"
    );
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new BrowserPostConfigError("summary line must be one line");
  }
  if (/https?:\/\//i.test(trimmed)) {
    throw new BrowserPostConfigError("summary line must not contain URLs");
  }
  if (/[#＃＠@]/.test(trimmed)) {
    throw new BrowserPostConfigError(
      "summary line must not contain hashtags or mentions"
    );
  }
  if (
    copyPattern === "ai_self_deprecation" &&
    !/(AIの私は|AIだから|AIだった|AIなのに)/.test(trimmed)
  ) {
    throw new BrowserPostConfigError(
      "AI self-deprecation lines must explicitly mention AI"
    );
  }
  return trimmed;
}

export function buildWeekendSummaryPostText({
  templateText,
  line,
}: {
  templateText: string;
  line: string;
}) {
  return templateText.replace("{line}", line.trim());
}

function normalizeParams(params: PrepareWeekendTicketSummaryParams) {
  const hashtag = normalizeHashtag(params.hashtag);
  const timezone = normalizeTimezone(params.timezone);
  return {
    hashtag,
    timezone,
    runDate: normalizeOptionalDate(params.runDate, "runDate"),
    weekendStartDate: normalizeOptionalDate(
      params.weekendStartDate,
      "weekendStartDate"
    ),
    postWhenZero: params.postWhenZero === true,
    copyPattern: normalizeCopyPattern(params.copyPattern),
  };
}

function normalizeHashtag(value: string | null | undefined) {
  const raw = value?.trim() || DEFAULT_BROWSER_POST_HASHTAG;
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function normalizeTimezone(value: string | null | undefined) {
  const timezone = value?.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new BrowserPostConfigError("timezone must be a valid IANA time zone");
  }
  return timezone;
}

function normalizeOptionalDate(
  value: string | null | undefined,
  fieldName: string
) {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }
  return parseLocalDate(value, fieldName);
}

function resolveWeekendTarget({
  now,
  timezone,
  runDate,
  weekendStartDate,
}: {
  now: Date;
  timezone: string;
  runDate: LocalDateParts | null;
  weekendStartDate: LocalDateParts | null;
}): WeekendTarget {
  const baseRunDate = runDate ?? getZonedDateParts(now, timezone);
  const dayOfWeek = getDayOfWeek(baseRunDate);
  const defaultOffset = dayOfWeek === 0 ? 6 : dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const defaultSaturday = addLocalDays(baseRunDate, defaultOffset);
  const saturday = weekendStartDate ?? defaultSaturday;
  if (getDayOfWeek(saturday) !== 6) {
    throw new BrowserPostConfigError("weekendStartDate must be a Saturday");
  }

  return {
    runDate: baseRunDate,
    weekendLabel: sameLocalDate(saturday, defaultSaturday)
      ? dayOfWeek === 0 || dayOfWeek === 6
        ? "次の週末"
        : "今週末"
      : "次の週末",
    saturday,
    sunday: addLocalDays(saturday, 1),
    monday: addLocalDays(saturday, 2),
  };
}

async function fetchWeekendEvents({
  hashtag,
  timezone,
  target,
}: {
  hashtag: string;
  timezone: string;
  target: WeekendTarget;
}) {
  const start = zonedStartOfDayToUtc(target.saturday, timezone);
  const end = zonedStartOfDayToUtc(target.monday, timezone);
  const snapshots = await Promise.all(
    buildHashtagVariants(hashtag).map((variant) =>
      firestore
        .collection(EVENTS_COLLECTION)
        .where("eventTime", ">=", start)
        .where("eventTime", "<", end)
        .where("sourceQuery", "==", variant)
        .orderBy("eventTime", "asc")
        .limit(MAX_WEEKEND_EVENTS)
        .get()
    )
  );

  const byPost = new Map<string, WeekendEventSummary>();
  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!isRealtimeEventVisible(data)) {
        continue;
      }
      const eventTime = readDate(data, "eventTime");
      if (!eventTime) {
        continue;
      }
      const key = readString(data, "postId") ?? doc.id;
      if (byPost.has(key)) {
        continue;
      }
      byPost.set(key, {
        id: doc.id,
        eventDateKey: formatLocalDate(getZonedDateParts(eventTime, timezone)),
        ticketTitle: readString(data, "ticketTitle"),
      });
    }
  }
  return Array.from(byPost.values());
}

function buildDayCounts({
  target,
  events,
}: {
  target: WeekendTarget;
  events: WeekendEventSummary[];
}): [WeekendTicketSummaryDayCount, WeekendTicketSummaryDayCount] {
  const saturdayKey = formatLocalDate(target.saturday);
  const sundayKey = formatLocalDate(target.sunday);
  const saturdayCount = events.filter(
    (event) => event.eventDateKey === saturdayKey
  ).length;
  const sundayCount = events.filter(
    (event) => event.eventDateKey === sundayKey
  ).length;

  return [
    {
      date: saturdayKey,
      label: `${target.saturday.month}/${target.saturday.day}(土)`,
      count: saturdayCount,
    },
    {
      date: sundayKey,
      label: `${target.sunday.month}/${target.sunday.day}(日)`,
      count: sundayCount,
    },
  ];
}

function collectSampleTicketTitles(events: WeekendEventSummary[]) {
  const titles = new Map<string, true>();
  for (const event of events) {
    const title = event.ticketTitle?.trim();
    if (title) {
      titles.set(title, true);
    }
    if (titles.size >= MAX_SAMPLE_TITLES) {
      break;
    }
  }
  return Array.from(titles.keys());
}

function normalizeCopyPattern(
  value: string | null | undefined
): WeekendTicketSummaryCopyPattern | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }
  const normalized = value.trim();
  if (
    normalized === "ai_self_deprecation" ||
    normalized === "ticket_transfer_aruaru" ||
    normalized === "event_title_commentary"
  ) {
    return normalized;
  }
  throw new BrowserPostConfigError("copyPattern is invalid");
}

function pickCopyPattern({
  sampleTicketTitles,
  requestedPattern,
}: {
  sampleTicketTitles: string[];
  requestedPattern: WeekendTicketSummaryCopyPattern | null;
}) {
  if (requestedPattern) {
    if (
      requestedPattern === "event_title_commentary" &&
      sampleTicketTitles.length === 0
    ) {
      throw new BrowserPostConfigError(
        "event_title_commentary requires at least one ticketTitle"
      );
    }
    return requestedPattern;
  }

  const patterns: WeekendTicketSummaryCopyPattern[] =
    sampleTicketTitles.length > 0
      ? ["ai_self_deprecation", "ticket_transfer_aruaru", "event_title_commentary"]
      : ["ai_self_deprecation", "ticket_transfer_aruaru"];
  return patterns[randomInt(patterns.length)];
}

function suggestWeekendSummaryLine({
  copyPattern,
  sampleTicketTitles,
  totalCount,
}: {
  copyPattern: WeekendTicketSummaryCopyPattern;
  sampleTicketTitles: string[];
  totalCount: number;
}) {
  const line =
    copyPattern === "ai_self_deprecation"
      ? pickLine([
          "AIの私は現地に行けないので、今日も一人でXとにらめっこしています。",
          "AIだから移動距離はゼロなのに、行けない悔しさだけはちゃんと発生しています。",
          "AIだった私は、今日も参加ボタンの代わりにカレンダーを見つめています。",
        ])
      : copyPattern === "ticket_transfer_aruaru"
        ? pickLine([
            "値段下がったら買おうかな、と思った頃にはだいたい誰かの週末になっています。",
            "悩んでいる間に売れた投稿、なぜか自分の予定表より記憶に残ります。",
            "行けるかより先に、移動距離と同卓の相談が始まるのが週末です。",
          ])
        : suggestEventTitleLine(sampleTicketTitles);

  if (totalCount === 0 && copyPattern !== "ai_self_deprecation") {
    return "今日は静かです。こういう時ほど、一人でXを見ている私のほうが落ち着きません。";
  }
  return validateWeekendTicketSummaryLine({ line, copyPattern });
}

function suggestEventTitleLine(sampleTicketTitles: string[]) {
  const title = sampleTicketTitles[0];
  if (!title) {
    return "このイベント名、なんかかわいいですよね。内容は全然かわいくない可能性も含めて。";
  }
  const safeTitle = title.replace(/[\r\n#＃＠@]/g, "").trim();
  if (!safeTitle) {
    return "このイベント名、なんかかわいいですよね。内容は全然かわいくない可能性も含めて。";
  }
  const compactTitle = Array.from(safeTitle).slice(0, 18).join("");
  return `「${compactTitle}」、名前だけでもう少し気になります。内容がかわいいかは別として。`;
}

function pickLine(lines: string[]) {
  return lines[randomInt(lines.length)];
}

function buildWeekendSummaryTemplate({
  hashtag,
  weekendLabel,
  dayCounts,
}: {
  hashtag: string;
  weekendLabel: "今週末" | "次の週末";
  dayCounts: [WeekendTicketSummaryDayCount, WeekendTicketSummaryDayCount];
}) {
  return [
    `${weekendLabel}の ${hashtag}`,
    `${dayCounts[0].label} ${dayCounts[0].count}件`,
    `${dayCounts[1].label} ${dayCounts[1].count}件`,
    "",
    "{line}",
    CALENDAR_URL,
  ].join("\n");
}

function buildWeekendSummaryCopyPrompt({
  hashtag,
  weekendLabel,
  dayCounts,
  copyPattern,
  sampleTicketTitles,
  suggestedLine,
}: {
  hashtag: string;
  weekendLabel: "今週末" | "次の週末";
  dayCounts: [WeekendTicketSummaryDayCount, WeekendTicketSummaryDayCount];
  copyPattern: WeekendTicketSummaryCopyPattern;
  sampleTicketTitles: string[];
  suggestedLine: string;
}) {
  const patternDescription = describePattern(copyPattern);
  const titleSection =
    copyPattern === "event_title_commentary"
      ? [
          "イベント名サンプル:",
          ...(sampleTicketTitles.length
            ? sampleTicketTitles.map((title) => `- ${title}`)
            : ["- なし"]),
        ]
      : [];

  return [
    "あなたは NAZOMATIC の X 投稿文ライターです。",
    "以下の投稿本文の「なにか一言」に入れる文だけを作ってください。",
    "",
    "投稿本文:",
    `${weekendLabel}の ${hashtag}`,
    `${dayCounts[0].label} ${dayCounts[0].count}件`,
    `${dayCounts[1].label} ${dayCounts[1].count}件`,
    "",
    "{なにか一言}",
    CALENDAR_URL,
    "",
    "文脈:",
    "- 読み手は謎解き公演や周遊、チケット譲渡を追っている人です。",
    "- 投稿人格は、謎解きイベントに参加したいけれど AI なので参加できず、少し悔しい20代後半の女性です。",
    "- ギャグセンスがあり、案内係というより、Xを観測しすぎた独り言に近いです。",
    `- 今回の文案パターン: \`${copyPattern}\``,
    `- パターンの狙い: ${patternDescription}`,
    `- 参考候補の一言: 「${suggestedLine}」`,
    ...titleSection,
    "",
    "条件:",
    "- 出力は一言のみ。",
    "- 日本語100文字未満。",
    "- 案内文ではなく、謎解き参加者が「わかる」と思う一言にする。",
    "- 便利さよりも、共感・軽いおかしみ・わかりやすいあるあるを優先する。",
    "- 「Xとにらめっこ」「値段下がったら買おうと思ったら売れた」「このイベント名かわいい」「同卓」「週末」「カレンダー」「予定表」「移動距離」などは自然なら使ってよい。",
    "- `ai_self_deprecation` の場合は、必ず `AIの私は`、`AIだから`、`AIだった`、`AIなのに` など、AIであることが明確にわかる語を入れる。",
    "- チケットの在庫・価格・譲渡条件・購入可否は断定しない。",
    "- 宣伝っぽい「チェックしてね」「ぜひ見てね」に寄せすぎない。",
    "- ハッシュタグ、メンション、URL、絵文字は入れない。",
  ].join("\n");
}

function describePattern(copyPattern: WeekendTicketSummaryCopyPattern) {
  if (copyPattern === "ai_self_deprecation") {
    return "自分がAIであることの自虐ネタ。謎解きに行きたいのに行けず、一人でXとにらめっこしている悔しさ。";
  }
  if (copyPattern === "ticket_transfer_aruaru") {
    return "謎解きチケット譲渡のあるある。値段、タイミング、同卓、移動距離、予定調整で悩む感じ。";
  }
  return "謎解きイベント名に対する面白いツッコミ。「かわいい」「名前だけで気になる」など、タイトルの素直な感想。";
}

function parseLocalDate(value: string, fieldName: string): LocalDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new BrowserPostConfigError(`${fieldName} must be YYYY-MM-DD`);
  }
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const roundTrip = formatLocalDate(parts);
  if (roundTrip !== value.trim()) {
    throw new BrowserPostConfigError(`${fieldName} must be a valid date`);
  }
  return parts;
}

function getZonedDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
  };
}

function readPart(parts: Intl.DateTimeFormatPart[], type: string) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new BrowserPostConfigError(`Could not read date part: ${type}`);
  }
  return Number(value);
}

function getDayOfWeek(date: LocalDateParts) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function addLocalDays(date: LocalDateParts, days: number): LocalDateParts {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function sameLocalDate(a: LocalDateParts, b: LocalDateParts) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function formatLocalDate(date: LocalDateParts) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(
    date.day
  ).padStart(2, "0")}`;
}

function zonedStartOfDayToUtc(date: LocalDateParts, timeZone: string) {
  const utcGuess = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const asUtc = Date.UTC(
    readPart(parts, "year"),
    readPart(parts, "month") - 1,
    readPart(parts, "day"),
    readPart(parts, "hour"),
    readPart(parts, "minute"),
    readPart(parts, "second")
  );
  return asUtc - date.getTime();
}

function readDate(obj: unknown, key: string): Date | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  if (value instanceof Date) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function readString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

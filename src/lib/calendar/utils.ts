import type { CalendarEvent } from "@/types/calendar";

const CALENDAR_TIME_ZONE = "Asia/Tokyo";

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

export interface CalendarDayEventSummary {
  id: string;
  postId: string;
  title: string;
  timeLabel: string;
  category: string;
  needsReview: boolean;
}

export interface CalendarDayBucket {
  isoDate: string;
  date: Date;
  events: CalendarDayEventSummary[];
}

export type CalendarBuckets = Record<string, CalendarDayBucket>;

export function startOfDay(date: Date): Date {
  return zonedStartOfDayToUtc(getCalendarDateParts(date));
}

export function startOfWeek(date: Date): Date {
  const parts = getCalendarDateParts(date);
  const day = getDayOfWeek(parts);
  return zonedStartOfDayToUtc(addLocalDays(parts, -day));
}

export function addDays(date: Date, days: number): Date {
  return zonedStartOfDayToUtc(addLocalDays(getCalendarDateParts(date), days));
}

export function addMonths(date: Date, months: number): Date {
  const parts = getCalendarDateParts(date);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  return zonedStartOfDayToUtc({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

export function startOfMonth(date: Date): Date {
  const parts = getCalendarDateParts(date);
  return zonedStartOfDayToUtc({ year: parts.year, month: parts.month, day: 1 });
}

export function endOfMonth(date: Date): Date {
  const parts = getCalendarDateParts(date);
  const end = new Date(Date.UTC(parts.year, parts.month, 0));
  return zonedStartOfDayToUtc({
    year: end.getUTCFullYear(),
    month: end.getUTCMonth() + 1,
    day: end.getUTCDate(),
  });
}

export function daysInMonth(date: Date): number {
  const parts = getCalendarDateParts(date);
  return new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function isSameMonth(a: Date, b: Date): boolean {
  const aParts = getCalendarDateParts(a);
  const bParts = getCalendarDateParts(b);
  return aParts.year === bParts.year && aParts.month === bParts.month;
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(date);
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(date);
}

export function toDateKey(date: Date): string {
  const { year, month: monthValue, day: dayValue } = getCalendarDateParts(date);
  const month = String(monthValue).padStart(2, "0");
  const day = String(dayValue).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayOfMonth(date: Date): string {
  return String(getCalendarDateParts(date).day);
}

export function formatMonthHeading(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(date);
}

export function groupEventsByDate(events: CalendarEvent[]): CalendarBuckets {
  return events.reduce<CalendarBuckets>((acc, event) => {
    const eventDate = new Date(event.eventTime);
    const key = toDateKey(eventDate);
    if (!acc[key]) {
      acc[key] = {
        isoDate: key,
        date: startOfDay(eventDate),
        events: [],
      };
    }
    acc[key].events.push({
      id: event.id,
      postId: event.postId,
      title: event.ticketTitle || deriveTitleFromHashtags(event),
      timeLabel: formatTime(eventDate),
      category: event.category,
      needsReview: event.needsReview,
    });
    return acc;
  }, {});
}

function deriveTitleFromHashtags(event: CalendarEvent): string {
  if (event.hashtags?.length) {
    return event.hashtags[0].replace(/^#/, "");
  }
  return event.rawPostText.slice(0, 20) || "イベント";
}

function getCalendarDateParts(date: Date): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: CALENDAR_TIME_ZONE,
  }).formatToParts(date);

  return {
    year: readDatePart(parts, "year"),
    month: readDatePart(parts, "month"),
    day: readDatePart(parts, "day"),
  };
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new Error(`Could not read calendar date part: ${type}`);
  }
  return Number(value);
}

function getDayOfWeek(date: LocalDateParts) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function addLocalDays(date: LocalDateParts, days: number): LocalDateParts {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function zonedStartOfDayToUtc(date: LocalDateParts) {
  const utcGuess = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const offset = getTimeZoneOffsetMs(utcGuess, CALENDAR_TIME_ZONE);
  return new Date(utcGuess.getTime() - offset);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);

  const asUtc = Date.UTC(
    readDatePart(parts, "year"),
    readDatePart(parts, "month") - 1,
    readDatePart(parts, "day"),
    readDatePart(parts, "hour"),
    readDatePart(parts, "minute"),
    readDatePart(parts, "second")
  );

  return asUtc - date.getTime();
}

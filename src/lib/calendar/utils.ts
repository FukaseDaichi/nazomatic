import type { CalendarEvent } from "@/types/calendar";

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
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = -day; // Sunday start
  next.setDate(next.getDate() + diff);
  return startOfDay(next);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfMonth(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfDay(next);
}

export function endOfMonth(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return startOfDay(next);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

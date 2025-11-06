"use client";

import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  RefreshCcw,
} from "lucide-react";

import { useCalendarData } from "@/hooks/useCalendarData";
import {
  addDays,
  formatTimestamp,
  groupEventsByDate,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "@/lib/calendar/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EventDetailDialog } from "@/components/calendar/EventDetailDialog";

const DEFAULT_QUERY = "#謎チケ売ります";
const HOUR_MS = 60 * 60 * 1000;

interface CalendarCellEvent {
  id: string;
  title: string;
  timeLabel: string;
  category: string;
  needsReview: boolean;
}

interface CalendarCell {
  isoDate: string;
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  events: CalendarCellEvent[];
}

const queryOptions = [DEFAULT_QUERY, "#譲渡", "#交換希望"];

export default function CalendarPageClient() {
  const [query, setQuery] = useState<string>(DEFAULT_QUERY);
  const [focusDate, setFocusDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { fromDate, toDate, rangeDays } = useMemo(
    () => buildRange(focusDate),
    [focusDate],
  );

  const { data, isLoading, error, refresh } = useCalendarData({
    query,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    rangeDays,
  });

  const grouped = useMemo(() => groupEventsByDate(data?.events ?? []), [data]);
  const eventMap = useMemo(
    () => new Map((data?.events ?? []).map((event) => [event.id, event])),
    [data],
  );

  const calendarCells = useMemo(() => {
    const firstDay = startOfWeek(startOfMonth(focusDate));
    const todayKey = toDateKey(new Date());

    return Array.from({ length: 42 }).map((_, index) => {
      const date = addDays(firstDay, index);
      const key = toDateKey(date);
      const bucket = grouped[key];

      const events: CalendarCellEvent[] = bucket
        ? bucket.events
            .slice()
            .sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))
            .map((evt) => ({
              id: evt.id,
              title: evt.title,
              timeLabel: evt.timeLabel,
              category: evt.category,
              needsReview: evt.needsReview,
            }))
        : [];

      return {
        isoDate: key,
        date,
        isToday: key === todayKey,
        isCurrentMonth: isSameMonth(date, focusDate),
        events,
      };
    });
  }, [focusDate, grouped]);

  const selectedDate = selectedDateKey
    ? grouped[selectedDateKey]?.date ?? null
    : null;
  const selectedDayEvents = selectedDateKey
    ? grouped[selectedDateKey]?.events ?? []
    : [];

  const lastUpdated = data?.generatedAt ? new Date(data.generatedAt) : null;
  const stale = lastUpdated
    ? Date.now() - lastUpdated.getTime() > HOUR_MS
    : false;

  const handleNavigate = (direction: "prev" | "next") => {
    setFocusDate((current) => addMonths(current, direction === "prev" ? -1 : 1));
  };

  const handleSelectEvent = (iso: string, eventId: string) => {
    setSelectedDateKey(iso);
    setSelectedEventId(eventId);
    setDialogOpen(true);
  };

  const handleOpenDay = (iso: string) => {
    const dayEvents = grouped[iso]?.events;
    if (dayEvents?.length) {
      setSelectedDateKey(iso);
      setSelectedEventId(dayEvents[0].id);
      setDialogOpen(true);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedDateKey(null);
      setSelectedEventId(null);
    }
  };

  const monthLabel = formatMonthHeading(focusDate);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-16 pt-6">
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-purple-500" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              チケットカレンダー
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-300">
            <span className="text-base font-semibold text-gray-700 dark:text-gray-100">
              {monthLabel}
            </span>
            {lastUpdated && (
              <span className={cn(stale ? "text-red-500" : "text-gray-500")}>
                最終更新: {formatTimestamp(lastUpdated)}
              </span>
            )}
            {isLoading && <span className="text-blue-400">更新中...</span>}
            {error && <span className="text-red-500">読み込みに失敗しました</span>}
          </div>
        </header>

        <div className="rounded-xl border border-purple-200/20 bg-gradient-to-br from-purple-50/50 to-purple-100/30 p-3 shadow-sm dark:border-purple-400/20 dark:from-purple-900/30 dark:to-purple-800/20">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate("prev")}
                aria-label="前へ"
                className="border-purple-300/50 text-purple-700 hover:bg-purple-100 hover:border-purple-400 dark:border-purple-500/50 dark:text-purple-300 dark:hover:bg-purple-800/50 dark:hover:border-purple-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate("next")}
                aria-label="次へ"
                className="border-purple-300/50 text-purple-700 hover:bg-purple-100 hover:border-purple-400 dark:border-purple-500/50 dark:text-purple-300 dark:hover:bg-purple-800/50 dark:hover:border-purple-400"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="flex items-center gap-2 border-purple-400/60 bg-purple-100/50 text-purple-700 hover:bg-purple-200 hover:border-purple-500 dark:border-purple-500/60 dark:bg-purple-800/40 dark:text-purple-200 dark:hover:bg-purple-700/50 dark:hover:border-purple-400"
              onClick={() => setFocusDate(startOfDay(new Date()))}
            >
              今日
            </Button>
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-purple-200/30 bg-white/60 px-3 py-2 dark:border-purple-500/30 dark:bg-purple-900/30">
              <QuerySelect value={query} onChange={setQuery} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                className="border-purple-300/50 text-purple-700 hover:bg-purple-100 hover:border-purple-400 dark:border-purple-500/50 dark:text-purple-300 dark:hover:bg-purple-800/50 dark:hover:border-purple-400"
              >
                <RefreshCcw className="mr-1 h-4 w-4" />
                更新
              </Button>
            </div>
          </div>
        </div>
      </section>

      <CalendarGrid
        cells={calendarCells}
        onSelectEvent={handleSelectEvent}
        onOpenDay={handleOpenDay}
      />

      <EventDetailDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        date={selectedDate}
        events={selectedDayEvents.map((evt) => ({
          id: evt.id,
          title: evt.title,
          timeLabel: evt.timeLabel,
          category: evt.category,
          needsReview: evt.needsReview,
        }))}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        eventMap={eventMap}
      />
    </main>
  );
}

function CalendarGrid({
  cells,
  onSelectEvent,
  onOpenDay,
}: {
  cells: CalendarCell[];
  onSelectEvent: (isoDate: string, eventId: string) => void;
  onOpenDay: (isoDate: string) => void;
}) {
  const chunkSize = 7;
  const rows = Array.from({ length: Math.ceil(cells.length / chunkSize) }, (_, i) =>
    cells.slice(i * chunkSize, (i + 1) * chunkSize),
  );

  const weekDayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-lg">
      <header className="grid grid-cols-7 border-b border-white/10 text-center text-xs font-medium uppercase tracking-wide text-gray-300">
        {weekDayLabels.map((label) => (
          <div key={label} className="py-3">
            {label}
          </div>
        ))}
      </header>
      <div className="grid">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-7 border-b border-white/5 last:border-b-0">
            {row.map((cell) => (
              <CalendarDayCell
                key={cell.isoDate}
                cell={cell}
                onSelectEvent={onSelectEvent}
                onOpenDay={onOpenDay}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function CalendarDayCell({
  cell,
  onSelectEvent,
  onOpenDay,
}: {
  cell: CalendarCell;
  onSelectEvent: (iso: string, eventId: string) => void;
  onOpenDay: (iso: string) => void;
}) {
  const { date, isoDate, isToday, isCurrentMonth, events } = cell;
  const dateLabel = `${date.getDate()}`;
  const overflowCount = events.length > 3 ? events.length - 3 : 0;
  const visibleEvents = events.slice(0, 3);

  return (
    <div
      className={cn(
        "min-h-[104px] border-r border-white/5 p-3 text-left align-top transition",
        isToday ? "bg-purple-400/20 shadow-inner shadow-purple-500/40" : "hover:bg-white/5",
        !isCurrentMonth && "bg-black/10 text-gray-400",
      )}
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-semibold",
            isToday
              ? "rounded-full bg-purple-400 px-2 py-0.5 text-gray-900 shadow"
              : "text-gray-200",
          )}
        >
          {dateLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {visibleEvents.map((event) => (
          <button
            key={event.id}
            className={cn(
              "w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-left text-xs font-medium text-white/90 transition hover:border-purple-400 hover:bg-purple-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300",
              event.needsReview && "border-amber-300 bg-amber-400/20 text-amber-100 hover:bg-amber-300/30",
            )}
            onClick={() => onSelectEvent(isoDate, event.id)}
          >
            <span className="mr-1 inline-block w-2 rounded-full bg-purple-400 align-middle" aria-hidden />
            <span className="mr-1 text-purple-200">{event.timeLabel}</span>
            <span className="truncate">{event.title}</span>
          </button>
        ))}
        {overflowCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start px-2 text-xs text-purple-200 hover:text-purple-100"
            onClick={() => onOpenDay(isoDate)}
          >
            +{overflowCount} 件
          </Button>
        )}
      </div>
    </div>
  );
}

function QuerySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 border border-purple-300/50 bg-white/80 px-3 py-2 text-sm shadow-sm transition-colors hover:border-purple-400/60 hover:bg-purple-50/50 dark:border-purple-500/50 dark:bg-purple-900/40 dark:hover:border-purple-400/60 dark:hover:bg-purple-800/50">
      <ListFilter className="h-4 w-4 text-purple-600 dark:text-purple-300" />
      <label className="sr-only" htmlFor="calendar-query-select">
        クエリ選択
      </label>
      <select
        id="calendar-query-select"
        className="bg-transparent text-sm font-medium text-purple-700 outline-none dark:text-purple-200"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {queryOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function buildRange(base: Date) {
  const start = startOfWeek(startOfMonth(base));
  const end = addDays(start, 42);
  return {
    fromDate: start,
    toDate: addDays(end, -1),
    rangeDays: 42,
  };
}

function formatMonthHeading(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return startOfDay(next);
}

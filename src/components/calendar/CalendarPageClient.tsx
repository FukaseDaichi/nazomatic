"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  RefreshCcw,
  Search,
} from "lucide-react";

import { useCalendarData } from "@/hooks/useCalendarData";
import {
  addDays,
  addMonths,
  formatMonthHeading,
  groupEventsByDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  type CalendarBuckets,
  type CalendarDayEventSummary,
} from "@/lib/calendar/utils";
import type { CalendarEvent } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EventDetailDialog } from "@/components/calendar/EventDetailDialog";
import { HelpTooltip } from "@/components/calendar/HelpTooltip";

const DEFAULT_QUERY = "#謎チケ売ります";
const HOUR_MS = 60 * 60 * 1000;
const queryOptions = [DEFAULT_QUERY, "#謎解き同行者募集", "#謎チケ譲ります"];
const EMPTY_EVENTS: CalendarEvent[] = [];

interface CalendarCell {
  isoDate: string;
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  events: CalendarDayEventSummary[];
}

export default function CalendarPageClient() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [textFilter, setTextFilter] = useState("");

  const { fromDate, toDate, rangeDays } = useMemo(
    () => buildRange(focusDate),
    [focusDate]
  );

  const { data, isLoading, error, refresh } = useCalendarData({
    query,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    rangeDays,
  });

  const normalizedFilter = useMemo(
    () => textFilter.trim().toLowerCase(),
    [textFilter]
  );

  const events = data?.events ?? EMPTY_EVENTS;

  const filteredEvents = useMemo(() => {
    if (!normalizedFilter) {
      return events;
    }
    return events.filter((event) =>
      event.rawPostText.toLowerCase().includes(normalizedFilter)
    );
  }, [events, normalizedFilter]);

  const grouped = useMemo<CalendarBuckets>(
    () => groupEventsByDate(filteredEvents),
    [filteredEvents]
  );

  const eventMap = useMemo(
    () =>
      new Map<string, CalendarEvent>(
        filteredEvents.map((evt) => [evt.id, evt])
      ),
    [filteredEvents]
  );

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const firstDay = startOfWeek(startOfMonth(focusDate));
    const todayKey = toDateKey(new Date());

    return Array.from({ length: 42 }).map((_, index) => {
      const date = addDays(firstDay, index);
      const key = toDateKey(date);
      const bucket = grouped[key];

      return {
        isoDate: key,
        date,
        isToday: key === todayKey,
        isCurrentMonth: daisyIsSameMonth(date, focusDate),
        events: bucket?.events ?? [],
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
  const isStale = lastUpdated
    ? Date.now() - lastUpdated.getTime() > HOUR_MS
    : false;

  const handleNavigate = (direction: "prev" | "next") => {
    setFocusDate((current) =>
      addMonths(current, direction === "prev" ? -1 : 1)
    );
  };

  const handleSelectEvent = (isoDate: string, eventId: string) => {
    setSelectedDateKey(isoDate);
    setSelectedEventId(eventId);
    setDialogOpen(true);
  };

  const handleOpenDay = (isoDate: string) => {
    const events = grouped[isoDate]?.events;
    if (events?.length) {
      setSelectedDateKey(isoDate);
      setSelectedEventId(events[0].id);
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

  useEffect(() => {
    if (!selectedDateKey && !selectedEventId) {
      return;
    }

    const hasDate = selectedDateKey ? Boolean(grouped[selectedDateKey]) : true;
    const hasEvent = selectedEventId
      ? filteredEvents.some((event) => event.id === selectedEventId)
      : true;

    if (!hasDate || !hasEvent) {
      setDialogOpen(false);
      setSelectedDateKey(null);
      setSelectedEventId(null);
    }
  }, [filteredEvents, grouped, selectedDateKey, selectedEventId]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-16 pt-6">
      <section className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
        <header className="space-y-3">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <CalendarIcon className="h-6 w-6 text-purple-400 animate-in zoom-in duration-300" />
              <div className="absolute -inset-1 bg-purple-400/20 blur-lg rounded-full animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              謎チケカレンダー
            </h1>
            <HelpTooltip
              content={
                <div className="text-left">
                  <h2 className="text-xl font-bold mb-1 text-purple-400">
                    注意事項
                  </h2>
                  <p className="mb-2 text-gray-300">
                    謎チケカレンダーは、X（旧Twitter）の「#謎チケ売ります」ハッシュタグからイベント情報を収集して表示しています。
                  </p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start">
                      <span className="inline-flex items-center justify-center w-6 h-6 mr-2 bg-purple-500 rounded-full flex-shrink-0 text-xs">
                        1
                      </span>
                      <div>
                        <p className="font-semibold mb-1">内容の間違い</p>
                        <p className="text-gray-400">
                          AIが情報精査しています。正確な内容は元のポストを参照して下さい。
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="inline-flex items-center justify-center w-6 h-6 mr-2 bg-purple-500 rounded-full flex-shrink-0 text-xs">
                        2
                      </span>
                      <div>
                        <p className="font-semibold mb-1">正確度</p>
                        <p className="text-gray-400">
                          情報を精査したAIへの信頼です。ユーザーには何も関係ありません。
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>
              }
            />
          </div>

          {/* Month & Status */}
          <div className="flex flex-wrap justify-start items-center gap-3 text-sm">
            <span className="text-xl sm:text-2xl font-bold text-white">
              {formatMonthHeading(focusDate)}
            </span>
            {lastUpdated && (
              <span
                className={cn(
                  "text-xs sm:text-sm px-2 py-1 rounded-full transition-colors duration-300",
                  isStale
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "bg-gray-700/50 text-gray-300 border border-gray-600/30"
                )}
              >
                {new Intl.DateTimeFormat("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZone: "Asia/Tokyo",
                }).format(lastUpdated)}
              </span>
            )}
            {isLoading && (
              <span className="text-xs sm:text-sm text-blue-400 flex items-center gap-1.5 animate-pulse">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                更新中
              </span>
            )}
            {error && (
              <span className="text-xs sm:text-sm text-red-400 px-2 py-1 bg-red-500/20 rounded-full border border-red-500/30">
                読み込み失敗
              </span>
            )}
            {/* Navigation */}
            {(!isLoading || error) && (
              <div className="flex sm:hidden ml-auto flex-wrap items-center gap-1.5 sm:w-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleNavigate("prev")}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-purple-400/20 border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4 text-purple-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleNavigate("next")}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-purple-400/20 border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 active:scale-95"
                >
                  <ChevronRight className="h-4 w-4 text-purple-400" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 sm:h-9 px-3 text-xs sm:text-sm rounded-xl bg-purple-400/10 hover:bg-purple-400/20 border border-purple-400/30 hover:border-purple-400/50 text-purple-300 font-medium transition-all duration-300 hover:scale-105 active:scale-95"
                  onClick={() => setFocusDate(startOfDay(new Date()))}
                >
                  今日
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Controls - Responsive Row */}
        <div className="flex items-center justify-center gap-2 py-3 px-1 sm:px-3 rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-white/10 shadow-lg">
          {/* Navigation */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleNavigate("prev")}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-purple-400/20 border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4 text-purple-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleNavigate("next")}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-purple-400/20 border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 active:scale-95"
            >
              <ChevronRight className="h-4 w-4 text-purple-400" />
            </Button>
            <Button
              variant="ghost"
              className="h-8 sm:h-9 px-3 text-xs sm:text-sm rounded-xl bg-purple-400/10 hover:bg-purple-400/20 border border-purple-400/30 hover:border-purple-400/50 text-purple-300 font-medium transition-all duration-300 hover:scale-105 active:scale-95"
              onClick={() => setFocusDate(startOfDay(new Date()))}
            >
              今日
            </Button>
          </div>
          {/* Query, Filter & Refresh */}
          <div className="sm:ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-400/30 transition-all duration-300">
              <ListFilter className="h-3.5 w-3 sm:h-4 sm:w-4 text-purple-400" />
              <select
                className="h-4 sm:h-auto bg-transparent text-xs sm:text-sm text-white outline-none cursor-pointer font-medium"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="カレンダークエリ"
              >
                {queryOptions.map((option) => (
                  <option key={option} value={option} className="bg-gray-800">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-400/30 transition-all duration-300 px-2 sm:px-3 py-1.5 w-32 sm:w-64">
              <Search className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400 flex-shrink-0" />
              <Input
                aria-label="テキスト絞込"
                placeholder="テキスト絞込"
                value={textFilter}
                onChange={(event) => setTextFilter(event.target.value)}
                className="h-4 sm:h-auto w-full min-w-0 border-0 bg-transparent px-1 py-0 text-base sm:text-sm text-white placeholder:text-xs sm:placeholder:text-base placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 scale-[0.875] sm:scale-100 origin-left"
                autoComplete="off"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refresh()}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-white/5 hover:bg-purple-400/20 border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:scale-110 active:scale-95 hover:rotate-180"
              aria-label="再読み込み"
            >
              <RefreshCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-400" />
            </Button>
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
  const weekDayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const chunkSize = 7;
  const rows = Array.from(
    { length: Math.ceil(cells.length / chunkSize) },
    (_, i) => cells.slice(i * chunkSize, (i + 1) * chunkSize)
  );

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
          <div
            key={idx}
            className="grid grid-cols-7 border-b border-white/5 last:border-b-0"
          >
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
  onSelectEvent: (isoDate: string, eventId: string) => void;
  onOpenDay: (isoDate: string) => void;
}) {
  const { date, isoDate, isToday, isCurrentMonth, events } = cell;
  const dateLabel = `${date.getDate()}`;
  const overflowCount = events.length > 3 ? events.length - 3 : 0;
  const visibleEvents = events.slice(0, 3);

  return (
    <div
      className={cn(
        "min-h-[90px] sm:min-h-[110px] border-r border-white/5 p-1.5 sm:p-3 text-left align-top transition-all duration-300",
        isToday
          ? "bg-purple-400/20 shadow-inner shadow-purple-500/40 relative before:absolute before:inset-0 before:bg-purple-400/10 before:animate-pulse"
          : "hover:bg-white/5 hover:shadow-lg",
        !isCurrentMonth && "bg-black/20 text-gray-500"
      )}
    >
      {/* Date Label */}
      <div className="mb-1.5 sm:mb-2 flex items-center justify-between">
        <span
          className={cn(
            "text-xs sm:text-sm font-bold transition-all duration-300",
            isToday
              ? "bg-purple-400 text-gray-900 px-2 py-0.5 rounded-full shadow-lg shadow-purple-400/50"
              : isCurrentMonth
              ? "text-white"
              : "text-gray-500"
          )}
        >
          {dateLabel}
        </span>
        {events.length > 0 && (
          <span className="text-[9px] sm:text-xs text-purple-400 font-medium px-1.5 py-0.5 bg-purple-400/10 rounded-full border border-purple-400/20">
            {events.length}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="flex flex-col gap-0.5 sm:gap-1">
        {visibleEvents.map((event, idx) => (
          <button
            key={event.id}
            className={cn(
              "w-full rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 text-left transition-all duration-300 hover:scale-[1.02] active:scale-95",
              "border bg-white/5 backdrop-blur-sm",
              event.needsReview
                ? "border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-400/20"
                : "border-white/10 hover:border-purple-400/60 hover:bg-purple-400/10 hover:shadow-lg hover:shadow-purple-400/20"
            )}
            onClick={() => onSelectEvent(isoDate, event.id)}
          >
            <div className="flex items-center gap-1">
              {/* Indicator Dot - Hidden on mobile, visible on desktop*/}
              <span
                className={cn(
                  "hidden sm:block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0",
                  event.needsReview ? "bg-amber-400" : "bg-purple-400"
                )}
              />
              {/* Time - Always visible */}
              <span
                className={cn(
                  "text-[9px] sm:text-xs font-bold flex-shrink-0",
                  event.needsReview ? "text-amber-300" : "text-purple-300"
                )}
              >
                {event.timeLabel}
              </span>
              {/* Title - Hidden on mobile, visible on desktop */}
              <span className="hidden sm:block text-xs text-white/90 truncate font-medium">
                {event.title}
              </span>
            </div>
          </button>
        ))}

        {/* Overflow Button */}
        {overflowCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start px-1.5 sm:px-2 h-auto py-0.5 text-[9px] sm:text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-400/10 transition-all duration-300 hover:scale-105"
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

function daisyIsSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

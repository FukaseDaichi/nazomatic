"use client";

import type { CalendarEvent } from "@/types/calendar";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MapPin, Coins, Ticket, Package, LucideIcon } from "lucide-react";

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  events: {
    id: string;
    title: string;
    timeLabel: string;
    category: string;
    needsReview: boolean;
  }[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  eventMap: Map<string, CalendarEvent>;
}

export function EventDetailDialog({
  open,
  onOpenChange,
  date,
  events,
  selectedEventId,
  onSelectEvent,
  eventMap,
}: EventDetailDialogProps) {
  const selectedEvent = selectedEventId
    ? eventMap.get(selectedEventId) ?? null
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[95vw] max-w-md overflow-hidden border-none bg-gradient-to-b from-gray-900 to-gray-800 p-0 text-white shadow-2xl">
        <div className="flex h-full max-h-[85vh] flex-col">
          {/* Compact Header */}
          <header className="shrink-0 border-b border-white/10 bg-gray-900/50 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-400">
                  {date ? formatDateHeading(date) : "イベント詳細"}
                </p>
                <h2 className="mt-0.5 text-lg font-bold tracking-tight">
                  {events.length}件のチケット
                </h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
          </header>

          {/* Event Tabs - Horizontal Scroll */}
          <div className="shrink-0 border-b border-white/10 bg-gray-900/30">
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent(event.id)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    selectedEventId === event.id
                      ? "bg-purple-400 text-gray-900 shadow-lg"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="block">{event.timeLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Event Details - Scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {selectedEvent ? (
              <article className="space-y-3">
                {/* Author Section with Avatar */}
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="relative h-12 w-12 shrink-0">
                    {selectedEvent.author.imageUrl ? (
                      <Image
                        src={selectedEvent.author.imageUrl}
                        alt={selectedEvent.author.name}
                        fill
                        unoptimized
                        className="rounded-full border-2 border-purple-400 object-cover shadow-lg animate-in fade-in zoom-in duration-300"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-purple-400 bg-gradient-to-br from-purple-400 to-purple-600 text-lg font-bold text-white shadow-lg animate-in fade-in zoom-in duration-300">
                        {selectedEvent.author.name?.[0] || "?"}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-gray-900 bg-purple-400 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {selectedEvent.author.name || "不明"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatTimestamp(new Date(selectedEvent.eventTime))}
                    </p>
                  </div>
                </div>

                {/* Title & Badges */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className="bg-purple-400 text-xs font-semibold text-gray-900">
                      {renderCategoryLabel(selectedEvent.category)}
                    </Badge>
                    <Badge
                      variant={
                        selectedEvent.needsReview ? "destructive" : "outline"
                      }
                      className="border-white/40 text-xs text-white"
                    >
                      正確度 {Math.round(selectedEvent.confidence * 100)}%
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold leading-snug">
                    {selectedEvent.ticketTitle || deriveTitle(selectedEvent)}
                  </h3>
                  {selectedEvent.hashtags.length > 0 && (
                    <p className="text-xs text-purple-300">
                      {selectedEvent.hashtags
                        .map((tag) => `#${tag.replace(/^#/, "")}`)
                        .join(" ")}
                    </p>
                  )}
                </div>

                {/* Compact Info Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <InfoCard
                    icon={MapPin}
                    label="場所"
                    value={selectedEvent.location || "未定"}
                  />
                  <InfoCard
                    icon={Coins}
                    label="価格"
                    value={formatPrice(selectedEvent)}
                  />
                  <InfoCard
                    icon={Ticket}
                    label="枚数"
                    value={
                      selectedEvent.quantity
                        ? `${selectedEvent.quantity}枚`
                        : "不明"
                    }
                  />
                  <InfoCard
                    icon={Package}
                    label="受渡"
                    value={selectedEvent.deliveryMethod || "指定なし"}
                  />
                </div>

                {/* Post Text */}
                {selectedEvent.rawPostText && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-purple-300">
                      投稿内容
                    </h4>
                    <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-gray-900/40 p-3 text-xs leading-relaxed text-gray-200">
                      {selectedEvent.rawPostText}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 border-purple-400 bg-purple-400/10 text-xs font-semibold text-purple-400 hover:bg-purple-400 hover:text-gray-900"
                    asChild
                  >
                    <a
                      href={selectedEvent.postURL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      X で表示
                    </a>
                  </Button>
                </div>
              </article>
            ) : (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-gray-400">
                  イベントを選択してください
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-400/20 text-purple-300 animate-in zoom-in duration-300">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-purple-300">{label}</p>
        <p className="truncate text-xs font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function renderCategoryLabel(category: string) {
  switch (category) {
    case "sell":
      return "譲渡";
    case "buy":
      return "買取";
    case "exchange":
      return "交換";
    default:
      return "未分類";
  }
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function formatDateHeading(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatPrice(event: CalendarEvent): string {
  if (!event.price) {
    return "価格情報なし";
  }
  const perUnitLabel =
    event.price.perUnit === "pair"
      ? "/ペア"
      : event.price.perUnit === "ticket"
      ? "/枚"
      : "";
  const currency = event.price.currency === "JPY" ? "円" : event.price.currency;
  return `${event.price.amount.toLocaleString()}${currency}${perUnitLabel}`;
}

function deriveTitle(event: CalendarEvent): string {
  if (event.ticketTitle) {
    return event.ticketTitle;
  }
  if (event.hashtags?.length) {
    return event.hashtags[0].replace(/^#/, "");
  }
  return event.rawPostText.slice(0, 18) || "イベント";
}

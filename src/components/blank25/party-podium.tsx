"use client";

import { motion } from "framer-motion";
import { Crown, Medal, Trophy, type LucideIcon } from "lucide-react";
import { PartyAvatar } from "@/components/blank25/party-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Blank25PartyParticipant } from "@/components/blank25/party-types";

export type PartyPodiumEntry = {
  participant: Blank25PartyParticipant;
  rank: number;
  isTied: boolean;
  slot: 1 | 2 | 3;
};

type PartyPodiumProps = {
  entries: PartyPodiumEntry[];
  participantCount: number;
  topScore: number | null;
  topGroupCount: number;
  updatedAtLabel: string;
  statusMessage: string | null;
};

type SlotConfig = {
  icon: LucideIcon;
  label: string;
  bodyHeightClassName: string;
  bodyGradientClassName: string;
  bodyNumberClassName: string;
  bodyRankClassName: string;
  glowClassName: string;
  badgeClassName: string;
  accentTextClassName: string;
  summaryBorderClassName: string;
  summaryBackgroundClassName: string;
  orderClassName: string;
};

const DISPLAY_SLOT_ORDER = [2, 1, 3] as const;

const slotConfigByRank: Record<PartyPodiumEntry["slot"], SlotConfig> = {
  1: {
    icon: Crown,
    label: "1 位",
    bodyHeightClassName: "h-40 xl:h-52",
    bodyGradientClassName: "from-amber-300/75 via-purple-300/25 to-gray-950",
    bodyNumberClassName: "text-[6.6rem] xl:text-[8.5rem]",
    bodyRankClassName: "text-xl xl:text-2xl",
    glowClassName: "shadow-[0_0_56px_rgba(251,191,36,0.2)]",
    badgeClassName: "border-amber-300/35 bg-amber-300/14 text-amber-50",
    accentTextClassName: "text-amber-200",
    summaryBorderClassName: "border-amber-300/25",
    summaryBackgroundClassName:
      "bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(17,24,39,0.84))]",
    orderClassName: "order-2",
  },
  2: {
    icon: Medal,
    label: "2 位",
    bodyHeightClassName: "h-32 xl:h-44",
    bodyGradientClassName: "from-slate-200/70 via-slate-300/18 to-gray-950",
    bodyNumberClassName: "text-[5.2rem] xl:text-[6.8rem]",
    bodyRankClassName: "text-lg xl:text-xl",
    glowClassName: "shadow-[0_0_44px_rgba(203,213,225,0.18)]",
    badgeClassName: "border-slate-300/30 bg-slate-300/12 text-slate-100",
    accentTextClassName: "text-slate-200",
    summaryBorderClassName: "border-slate-300/20",
    summaryBackgroundClassName:
      "bg-[linear-gradient(180deg,rgba(203,213,225,0.1),rgba(17,24,39,0.84))]",
    orderClassName: "order-1",
  },
  3: {
    icon: Trophy,
    label: "3 位",
    bodyHeightClassName: "h-28 xl:h-36",
    bodyGradientClassName: "from-orange-300/70 via-orange-400/18 to-gray-950",
    bodyNumberClassName: "text-[4.7rem] xl:text-[6rem]",
    bodyRankClassName: "text-base xl:text-lg",
    glowClassName: "shadow-[0_0_44px_rgba(251,146,60,0.18)]",
    badgeClassName: "border-orange-300/30 bg-orange-300/12 text-orange-50",
    accentTextClassName: "text-orange-200",
    summaryBorderClassName: "border-orange-300/20",
    summaryBackgroundClassName:
      "bg-[linear-gradient(180deg,rgba(251,146,60,0.1),rgba(17,24,39,0.84))]",
    orderClassName: "order-3",
  },
};

const kindLabel = (kind: Blank25PartyParticipant["kind"]) =>
  kind === "group" ? "グループ" : "個人";

const getTopStateLabel = (topScore: number | null, topGroupCount: number) => {
  if (topScore === null) return "未登録";
  if (topGroupCount > 1) return `同点 ${topGroupCount} 組`;
  return "単独トップ";
};

const getStandingLabel = (entry?: PartyPodiumEntry) => {
  if (!entry) return "待機中";
  return entry.isTied ? `同率 ${entry.rank} 位` : `${entry.rank} 位`;
};

function EmptyAvatar() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-[1.3rem] border border-dashed border-gray-700 bg-gray-950/80 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500 xl:h-20 xl:w-20">
      --
    </div>
  );
}

function PodiumBlock({
  slot,
  entry,
}: {
  slot: PartyPodiumEntry["slot"];
  entry?: PartyPodiumEntry;
}) {
  const config = slotConfigByRank[slot];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        ease: "easeOut",
        delay: slot === 1 ? 0.16 : slot === 2 ? 0.08 : 0,
      }}
      className={cn(
        "flex w-full max-w-[230px] flex-1 flex-col items-center justify-end",
        config.orderClassName,
      )}
    >
      <div className="mb-4 flex flex-col items-center text-center">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
            slot === 1
              ? "border-purple-300/25 bg-purple-400/12 text-purple-50"
              : "border-gray-700 bg-gray-950/85 text-gray-200",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {config.label}
        </div>

        <div className="relative mt-4">
          {entry ? (
            <PartyAvatar
              name={entry.participant.name}
              iconDataUrl={entry.participant.iconDataUrl}
              className="h-16 w-16 rounded-[1.3rem] ring-1 ring-white/8 xl:h-20 xl:w-20"
              monogramClassName="text-lg xl:text-xl"
            />
          ) : (
            <EmptyAvatar />
          )}
          <div className="absolute -bottom-2 -right-2 flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-950 bg-white px-2 text-xs font-black text-gray-950 shadow-lg shadow-black/35">
            {slot}
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <div className="text-[10px] uppercase tracking-[0.28em] text-gray-500">
            {entry ? kindLabel(entry.participant.kind) : "空きスロット"}
          </div>
          <div className="max-w-[12rem] break-words text-sm font-black leading-tight text-white xl:text-base">
            {entry?.participant.name ?? "エントリー待ち"}
          </div>
          <div className="flex items-center justify-center gap-2">
            <div
              className={cn(
                "text-lg font-extrabold tracking-tight xl:text-2xl",
                config.accentTextClassName,
              )}
            >
              {entry ? entry.participant.score.toLocaleString("ja-JP") : "--"}
              <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                pt
              </span>
            </div>
            {entry?.isTied && (
              <span className="rounded-full border border-gray-600 bg-gray-900/90 px-2 py-0.5 text-[10px] font-semibold text-gray-100">
                同点
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative w-full">
        <div className="absolute inset-x-6 bottom-2 h-7 rounded-full bg-purple-400/20 blur-2xl" />
        <div
          className={cn(
            "relative overflow-hidden rounded-t-[1.8rem] border border-white/10 bg-gradient-to-b px-4 pt-4",
            config.bodyHeightClassName,
            config.bodyGradientClassName,
            config.glowClassName,
          )}
        >
          <div className="absolute inset-x-4 top-3 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/20 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-black/28 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-black/28 to-transparent" />
          <div className="absolute left-4 top-4 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/80">
            Stage
          </div>
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center justify-center px-4 text-center">
            <div
              className={cn(
                "font-black leading-none tracking-[-0.08em] text-white/95 drop-shadow-[0_12px_40px_rgba(0,0,0,0.42)]",
                config.bodyNumberClassName,
              )}
            >
              {slot}
            </div>
            <div
              className={cn(
                "mt-1 font-semibold uppercase tracking-[0.18em] text-white/82",
                config.bodyRankClassName,
              )}
            >
              {getStandingLabel(entry)}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-black/25" />
          <div className="absolute inset-x-0 bottom-3 h-px bg-white/10" />
        </div>
      </div>
    </motion.div>
  );
}

function PodiumSummaryCard({
  slot,
  entry,
}: {
  slot: PartyPodiumEntry["slot"];
  entry?: PartyPodiumEntry;
}) {
  const config = slotConfigByRank[slot];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-[1.3rem] border p-3",
        config.summaryBorderClassName,
        config.summaryBackgroundClassName,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
            config.badgeClassName,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {config.label}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">
          {getStandingLabel(entry)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {entry ? (
          <PartyAvatar
            name={entry.participant.name}
            iconDataUrl={entry.participant.iconDataUrl}
            className="h-11 w-11 shrink-0 rounded-[0.9rem]"
            monogramClassName="text-sm"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] border border-dashed border-gray-700 bg-gray-950/80 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            --
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">
            {entry?.participant.name ?? "空きスロット"}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gray-500">
            {entry ? kindLabel(entry.participant.kind) : "待機中"}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={cn(
              "text-lg font-black tracking-tight",
              config.accentTextClassName,
            )}
          >
            {entry ? entry.participant.score.toLocaleString("ja-JP") : "--"}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-gray-500">
            pt
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartyPodium({
  entries,
  participantCount,
  topScore,
  topGroupCount,
  updatedAtLabel,
  statusMessage,
}: PartyPodiumProps) {
  const entryBySlot = new Map(entries.map((entry) => [entry.slot, entry]));

  return (
    <Card className="overflow-hidden border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.16),transparent_52%),linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          <div className="relative min-w-0 border-b border-gray-800/80 lg:flex-[2] lg:border-b-0 lg:border-r">
            <div className="absolute inset-x-12 top-8 h-28 rounded-full bg-purple-400/12 blur-3xl" />
            <div className="absolute inset-x-10 bottom-0 h-24 rounded-full bg-purple-400/10 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(192,132,252,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(192,132,252,0.04)_1px,transparent_1px)] bg-[size:42px_42px] opacity-30" />

            <div className="absolute inset-x-5 top-5 z-20 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:inset-x-6 xl:top-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-purple-200/80">
                  表彰台
                </div>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white xl:text-[2.8rem]">
                  Stage
                </h2>
              </div>

              <div className="flex flex-wrap gap-2 xl:max-w-[40rem] xl:justify-end">
                <div className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-100">
                  参加者 {participantCount}
                </div>
                <div className="rounded-full border border-gray-700 bg-gray-950/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-100">
                  トップ{" "}
                  {topScore === null ? "--" : topScore.toLocaleString("ja-JP")}{" "}
                  pt
                </div>
                <div className="rounded-full border border-gray-700 bg-gray-950/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-100">
                  {getTopStateLabel(topScore, topGroupCount)}
                </div>
                <div className="rounded-full border border-gray-700 bg-gray-950/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-100">
                  更新 {updatedAtLabel}
                </div>
              </div>
            </div>

            <div className="relative flex min-h-[30rem] items-end justify-center gap-3 px-4 pb-6 pt-32 lg:gap-4 lg:px-6 lg:pb-7 lg:pt-36 xl:gap-6 xl:px-8 xl:pb-8">
              {DISPLAY_SLOT_ORDER.map((slot) => (
                <PodiumBlock
                  key={slot}
                  slot={slot}
                  entry={entryBySlot.get(slot)}
                />
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-col bg-[linear-gradient(to_bottom,rgba(2,6,23,0.92),rgba(17,24,39,0.94))] p-4 lg:flex-[1] lg:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-400">
                上位 3 組
              </div>
              <div className="rounded-full border border-purple-300/20 bg-purple-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-100">
                {participantCount} 組
              </div>
            </div>

            {statusMessage ? (
              <motion.div
                key={statusMessage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mt-3 rounded-[1rem] border border-purple-300/20 bg-purple-400/10 px-3.5 py-2.5 text-sm text-purple-50"
              >
                {statusMessage}
              </motion.div>
            ) : null}

            <div className="mt-3 flex flex-1 flex-col gap-3">
              {([1, 2, 3] as const).map((slot) => (
                <PodiumSummaryCard
                  key={slot}
                  slot={slot}
                  entry={entryBySlot.get(slot)}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

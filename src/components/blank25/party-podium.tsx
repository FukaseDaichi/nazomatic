"use client";

import type { ReactNode } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { PartyAvatar } from "@/components/blank25/party-avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { Blank25PartyParticipant } from "@/components/blank25/party-types";

export type PartyPodiumEntry = {
  participant: Blank25PartyParticipant;
  rank: number;
  isTied: boolean;
  slot: 1 | 2 | 3;
};

const kindLabel = (kind: Blank25PartyParticipant["kind"]) =>
  kind === "group" ? "グループ" : "個人";

const stageIconBySlot: Record<PartyPodiumEntry["slot"], ReactNode> = {
  1: <Crown className="h-4 w-4" />,
  2: <Medal className="h-4 w-4" />,
  3: <Trophy className="h-4 w-4" />,
};

export default function PartyPodium({
  entries,
  participantCount,
}: {
  entries: PartyPodiumEntry[];
  participantCount: number;
}) {
  const entryBySlot = new Map(entries.map((entry) => [entry.slot, entry]));

  return (
    <Card className="overflow-hidden border-gray-700 bg-gray-950/76 shadow-2xl shadow-black/30 backdrop-blur">
      <CardContent className="p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.32em] text-gray-400">
            上位 3 組
          </div>
          <div className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-100">
            参加者 {participantCount}
          </div>
        </div>
        <div className="grid gap-2 xl:grid-cols-3">
          {([1, 2, 3] as const).map((slot) => {
            const entry = entryBySlot.get(slot);

            return (
              <motion.div
                key={slot}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={[
                  "rounded-[1.3rem] border p-3",
                  slot === 1
                    ? "border-purple-300/45 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.22),transparent_60%),rgba(3,7,18,0.95)]"
                    : "border-gray-700 bg-gray-900/90",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-100">
                    {stageIconBySlot[slot]}
                    {slot} 位
                  </span>
                  {entry?.isTied && (
                    <span className="rounded-full border border-gray-600 bg-gray-800 px-2 py-1 text-[11px] text-gray-200">
                      同点
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  {entry ? (
                    <PartyAvatar
                      name={entry.participant.name}
                      iconDataUrl={entry.participant.iconDataUrl}
                      className="h-[5.5rem] w-[5.5rem] shrink-0 rounded-[1.45rem]"
                      monogramClassName="text-[1.35rem]"
                    />
                  ) : (
                    <div className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-[1.45rem] border border-dashed border-gray-700 bg-gray-950/80 text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                      --
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                      参加者
                    </div>
                    <div className="mt-1.5 truncate text-lg font-black tracking-tight text-white xl:text-xl">
                      {entry?.participant.name ?? "空きスロット"}
                    </div>
                    <div className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-gray-400">
                      {entry ? kindLabel(entry.participant.kind) : "待機中"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                      得点
                    </div>
                    <div className="mt-0.5 flex items-end gap-1.5">
                      <span className="text-[1.85rem] font-black tracking-tight text-white xl:text-[2rem]">
                        {entry?.participant.score ?? "--"}
                      </span>
                      <span className="pb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-purple-200">
                        point
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                    {entry ? `${entry.rank} 位` : "未登録"}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

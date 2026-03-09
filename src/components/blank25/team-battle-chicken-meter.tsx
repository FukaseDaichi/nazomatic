"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, Minus, Plus, Sparkles } from "lucide-react";
import TeamBattleTutorialImageBoard from "@/components/blank25/team-battle-tutorial-image-board";
import {
  TEAM_BATTLE_PANEL_TOTAL,
  getTeamBattleHiddenPanels,
} from "@/components/blank25/team-battle-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const presetCounts = [5, 9, 13, 17];

const describeAttackLevel = (hiddenCount: number) => {
  if (hiddenCount <= 5) {
    return {
      label: "まだ浅め",
      body: "見える情報が多いぶん解きやすい。ただし、入る点もまだ小さい。",
      callout: "まずは正解優先で入りたい帯。",
    };
  }

  if (hiddenCount <= 10) {
    return {
      label: "ちょうど勝負圏",
      body: "点も伸びて、まだ味方に拾わせやすい。バランスのいい勝負ライン。",
      callout: "解かせたい。でも点も欲しい。",
    };
  }

  if (hiddenCount <= 15) {
    return {
      label: "高得点狙い",
      body: "かなり隠しているので、正解できれば大きい。ここから先は味方理解が問われる。",
      callout: "点は高い。けれど 0 点も近い。",
    };
  }

  return {
    label: "超高得点帯",
    body: "隠せば隠すほど得点は伸びる。でも外せば全部 0。最もリスキーな領域。",
    callout: "HIDE は増える。でも正解率は削れる。",
  };
};

export default function TeamBattleChickenMeter() {
  const [hiddenCount, setHiddenCount] = useState(9);
  const hiddenPanels = useMemo(
    () => getTeamBattleHiddenPanels(hiddenCount),
    [hiddenCount],
  );
  const score = hiddenCount;
  const attackLevel = describeAttackLevel(hiddenCount);
  const attackRatio = (hiddenCount / TEAM_BATTLE_PANEL_TOTAL) * 100;

  return (
    <Card className="overflow-hidden border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.14),transparent_58%),linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.94))] shadow-2xl shadow-black/30">
      <CardHeader className="border-b border-gray-800/80 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-purple-200/80">
              Attack Meter
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              どこまで HIDE して、何点を狙う？
            </CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="攻め度メーターの補足"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-950/80 text-gray-300 transition-colors hover:border-purple-300/30 hover:text-white"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs border-gray-700 bg-gray-950/95 px-4 py-3 text-gray-100">
              チーム戦の得点は HIDE 数です。多く隠すほど高得点ですが、不正解だと
              0 点です。
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="order-2 lg:order-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.4rem] border border-gray-700 bg-gray-950/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Hidden
                </div>
                <div className="mt-2 text-4xl font-black tracking-tight text-white">
                  {hiddenCount}
                </div>
                <p className="mt-2 text-sm text-gray-400">消したマス</p>
              </div>
              <div className="rounded-[1.4rem] border border-purple-300/20 bg-purple-400/10 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-100/80">
                  Score
                </div>
                <div className="mt-2 text-4xl font-black tracking-tight text-white">
                  {score}
                </div>
                <p className="mt-2 text-sm text-purple-100/80">
                  正解したら入る点
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-gray-700 bg-gray-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Attack Balance
                </div>
                <div className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-100">
                  {attackLevel.label}
                </div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-900">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-300 via-purple-400 to-purple-500 shadow-[0_0_20px_rgba(192,132,252,0.45)]"
                  animate={{ width: `${attackRatio}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>控えめ</span>
                <span>高得点狙い</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 border-gray-700 bg-gray-950 text-white hover:border-purple-300 hover:bg-gray-800"
                onClick={() =>
                  setHiddenCount((current) => Math.max(0, current - 1))
                }
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 border-purple-300/30 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20 hover:text-white"
                onClick={() =>
                  setHiddenCount((current) =>
                    Math.min(TEAM_BATTLE_PANEL_TOTAL, current + 1),
                  )
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
              <div className="ml-1 flex flex-wrap gap-2">
                {presetCounts.map((presetCount) => (
                  <button
                    key={presetCount}
                    type="button"
                    onClick={() => setHiddenCount(presetCount)}
                    className={[
                      "rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
                      hiddenCount === presetCount
                        ? "border-purple-300/35 bg-purple-400 text-gray-950"
                        : "border-gray-700 bg-gray-950/80 text-gray-200 hover:border-purple-300/30 hover:text-white",
                    ].join(" ")}
                  >
                    {presetCount} 枚隠し
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={attackLevel.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/5 p-4"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  攻めどころ
                </div>
                <p className="mt-3 text-lg font-bold text-white">
                  {attackLevel.callout}
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-300 h-[50px]">
                  {attackLevel.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="order-1 lg:order-2">
            <div className="rounded-[1.75rem] border border-gray-800 bg-black/25 p-4 sm:p-5">
              <TeamBattleTutorialImageBoard
                hiddenPanels={hiddenPanels}
                className="mx-auto max-w-[22rem]"
              />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-700 bg-gray-950/75 px-4 py-3 text-sm text-gray-300">
                  <span className="font-semibold text-white">
                    HIDE {hiddenCount}
                  </span>{" "}
                  枚。正解できればそのまま {score} 点。
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-950/75 px-4 py-3 text-sm text-gray-300">
                  <span className="font-semibold text-white">
                    見える情報は減る
                  </span>{" "}
                  ので、得点を伸ばすほど難度も上がる。
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

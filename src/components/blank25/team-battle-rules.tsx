"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, HelpCircle, PartyPopper, Sparkles } from "lucide-react";
import TeamBattleTutorialImageBoard from "@/components/blank25/team-battle-tutorial-image-board";
import TeamBattleChickenMeter from "@/components/blank25/team-battle-chicken-meter";
import TeamBattleRetrySimulator from "@/components/blank25/team-battle-retry-simulator";
import TeamBattleRoundFlow from "@/components/blank25/team-battle-round-flow";
import {
  TEAM_BATTLE_TUTORIAL_ANSWER,
  getTeamBattleHiddenPanels,
} from "@/components/blank25/team-battle-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const heroBadges = [
  "2人以上でチーム戦",
  "正解 = HIDE 数",
  "不正解 = 0 点",
  "全滅したら再作問",
];

const tutorialHiddenPanels = getTeamBattleHiddenPanels(12);

export default function TeamBattleRules() {
  return (
    <TooltipProvider delayDuration={140}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.4rem] border border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.22),transparent_48%),linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.94))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-7">
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-purple-100">
                <PartyPopper className="h-3.5 w-3.5" />
                BLANK25 Team Battle
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                その 1 枚、
                <br className="hidden sm:block" />
                残す？
              </h1>

              <p className="mt-4 text-base leading-7 text-gray-200 sm:text-lg">
                チーム戦では、味方が解けるギリギリを狙ってパネルを
                HIDEします。正解すれば、HIDE した枚数がそのまま得点です。
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {heroBadges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-gray-700 bg-gray-950/85 px-3 py-1.5 text-xs font-semibold text-gray-100"
                  >
                    {badge}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row justify-center">
                <Button
                  asChild
                  className="h-12 bg-purple-400 text-gray-950 hover:bg-purple-300"
                >
                  <Link href="/blank25">
                    問題を選んで作問する
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 border-gray-600 bg-gray-950/75 text-white hover:bg-gray-800"
                >
                  <Link href="/blank25/party">
                    得点ボードをひらく
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-8">
          <TeamBattleChickenMeter />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <TeamBattleRoundFlow />
          <TeamBattleRetrySimulator />
        </section>

        <section className="mt-8">
          <Card className="overflow-hidden border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.16),transparent_60%),linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.94))] shadow-2xl shadow-black/30">
            <CardHeader className="border-b border-gray-800/80 pb-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-purple-100/80">
                <Sparkles className="h-3.5 w-3.5" />
                Ready To Play
              </div>
              <CardTitle className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                ルール共有が終わったら、すぐ始める
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:p-6 sm:grid-cols-2">
              <Link
                href="/blank25"
                className="group rounded-[1.6rem] border border-gray-700 bg-gray-950/75 p-5 transition-colors hover:border-purple-300/35 hover:bg-gray-900"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Play
                </div>
                <h3 className="mt-3 text-xl font-black tracking-tight text-white">
                  作問する問題を選ぶ
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-300">
                  まずは BLANK25
                  の問題一覧へ。作問モードに入って、今夜の勝負盤を作る。
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-purple-100">
                  `/blank25` へ
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>

              <Link
                href="/blank25/party"
                className="group rounded-[1.6rem] border border-purple-300/25 bg-purple-400/10 p-5 transition-colors hover:bg-purple-400/15"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-100/80">
                  Score
                </div>
                <h3 className="mt-3 text-xl font-black tracking-tight text-white">
                  得点ボードを開く
                </h3>
                <p className="mt-2 text-sm leading-6 text-purple-50/90">
                  正解と 0
                  点が連続するほど、このボードが効いてくる。ラウンド結果をその場で積み上げる。
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-white">
                  `/blank25/party` へ
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>
    </TooltipProvider>
  );
}

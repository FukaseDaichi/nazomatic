"use client";

import { motion } from "framer-motion";
import {
  Grid3X3,
  HelpCircle,
  Trophy,
  UserRound,
  Users,
  BadgeAlert,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FlowStep = {
  step: string;
  title: string;
  body: string;
  hype: string;
  icon: LucideIcon;
  note?: string;
};

const steps: FlowStep[] = [
  {
    step: "Step 1",
    title: "まずはチーム分け",
    body: "2人以上でチームを作る。ここで空気感が決まる。",
    hype: "味方の読み筋が近いほど、後半が熱い。",
    icon: Users,
  },
  {
    step: "Step 2",
    title: "各チームで出題者を決める",
    body: "そのラウンドの作問担当を 1 人選ぶ。",
    hype: "出題者は、味方の脳内マップを信じて盤面を削る役。",
    icon: UserRound,
  },
  {
    step: "Step 3",
    title: "制限時間で盤面を作る",
    body: "作問モードでパネルを隠し、勝負のラインを決める。",
    hype: "やりすぎると伝わらない。でも甘いと沸かない。",
    icon: Grid3X3,
    note: "作問モードは盤面をロックしてから判定に進みます。",
  },
  {
    step: "Step 4",
    title: "味方が答える",
    body: "制限時間内に回答。正解なら HIDE 数ぶん得点、不正解なら 0 点。",
    hype: "多く隠すほど点は伸びる。でも外したら全部消える。",
    icon: Trophy,
  },
];

export default function TeamBattleRoundFlow() {
  return (
    <Card className="overflow-hidden border-gray-700 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.92))] shadow-2xl shadow-black/25">
      <CardHeader className="border-b border-gray-800/80 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-500">
              Round Flow
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-white">
              1 ラウンドは、こう回す
            </CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="ラウンド進行の補足"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-950/80 text-gray-300 transition-colors hover:border-purple-300/30 hover:text-white"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs border-gray-700 bg-gray-950/95 px-4 py-3 text-gray-100">
              説明を詰め込みすぎないため、ここでは流れだけを見せています。細かい採点や全滅時の扱いは下のシミュレーターで確認できます。
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <div className="grid gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.article
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="relative overflow-hidden rounded-[1.6rem] border border-gray-800 bg-gray-950/60 p-4"
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-300/80 via-purple-400 to-purple-500" />
                <div className="flex items-start gap-4 pl-3">
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-400/10 text-purple-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-gray-700 bg-gray-900/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300">
                        {step.step}
                      </span>
                      {step.note && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${step.title} の補足`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-gray-400 transition-colors hover:border-purple-300/30 hover:text-white"
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border-gray-700 bg-gray-950/95 px-4 py-3 text-gray-100">
                            {step.note}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <h3 className="mt-3 text-xl font-black tracking-tight text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-300">
                      {step.body}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-purple-100">
                      {step.hype}
                    </p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-purple-300/20 bg-purple-400/10 p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/25 bg-gray-950/80 text-purple-100">
              <BadgeAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">MVPの場合</h3>
              <p className="mt-1 text-sm leading-6 text-purple-50/90">
                最もパネルを隠して答えられたら、獲得得点は現在の順位倍率分入る。3位のチームがパネル20枚隠してMVPなら得点は60点になる。MVPは複数チーム発生することもある。
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-[1.6rem] border border-purple-300/20 bg-purple-400/10 p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/25 bg-gray-950/80 text-purple-100">
              <BadgeAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                全員チームが答えられなければ、もう 1 回
              </h3>
              <p className="mt-1 text-sm leading-6 text-purple-50/90">
                ただし、前回見えていた情報はそのまま。次の作問は、その情報を背負ってやり直す。
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-[1.6rem] border border-purple-300/20 bg-purple-400/10 p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/25 bg-gray-950/80 text-purple-100">
              <BadgeAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                作問待っている間の回答者
              </h3>
              <p className="mt-1 text-sm leading-6 text-purple-50/90">
                暇にならないように、ボーナスとして、数枚開けて考えるオプションもあり。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

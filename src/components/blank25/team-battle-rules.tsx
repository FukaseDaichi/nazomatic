"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  HelpCircle,
  PartyPopper,
  RotateCcw,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import TeamBattleChickenMeter from "@/components/blank25/team-battle-chicken-meter";
import TeamBattleRetrySimulator from "@/components/blank25/team-battle-retry-simulator";
import TeamBattleRoundFlow from "@/components/blank25/team-battle-round-flow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HeroRule = {
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
};

type HeroJumpLink = {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
};

const heroRules: HeroRule[] = [
  {
    label: "正解したら",
    title: "HIDE 数ぶん得点",
    body: "削った枚数が、そのままチームの加点になる。",
    icon: Target,
  },
  {
    label: "外したら",
    title: "そのラウンドは 0 点",
    body: "攻めるほど見返りは増える。でも読み違えた瞬間に全部消える。",
    icon: AlertTriangle,
  },
  {
    label: "全滅したら",
    title: "見えた情報のまま再作問",
    body: "前に開いたマスを背負ったまま、次の盤面を作り直す。",
    icon: RotateCcw,
  },
];

const heroJumpLinks: HeroJumpLink[] = [
  {
    eyebrow: "Attack Meter",
    title: "どこまで消すと、何点を狙うか",
    body: "HIDE 枚数とリスクの釣り合いを、触ってすぐ掴めます。",
    href: "#attack-meter",
  },
  {
    eyebrow: "Round Flow",
    title: "1 ラウンドの回し方を確認する",
    body: "出題者、回答者、採点までの流れを一度で把握できます。",
    href: "#round-flow",
  },
  {
    eyebrow: "Retry Simulator",
    title: "全滅後の再作問を理解する",
    body: "見えてしまった情報を残したまま続く感覚を確認できます。",
    href: "#retry-simulator",
  },
];

export default function TeamBattleRules() {
  return (
    <TooltipProvider delayDuration={140}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.4rem] border border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.22),transparent_48%),linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.94))] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-4">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.18),transparent_70%)]" />
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
                <div className="relative aspect-[5/6] sm:aspect-[16/10] lg:aspect-[16/8]">
                  <Image
                    src="/img/blank25/blank25teambattle.png"
                    alt="BLANK25 チーム戦のテーマビジュアル"
                    fill
                    priority
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 92vw, 1200px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.14),transparent_60%)]" />
                  <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-gray-950/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-100 backdrop-blur">
                      <PartyPopper className="h-3.5 w-3.5" />
                      BLANK25 Team Battle
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mx-auto -mt-6 grid max-w-5xl gap-4 lg:-mt-10 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
                <div className="rounded-[1.85rem] border border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.18),transparent_55%),linear-gradient(to_bottom,rgba(3,7,18,0.96),rgba(17,24,39,0.94))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.36)] backdrop-blur sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-purple-100/80">
                        First View
                      </div>
                      <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                        勝負のルールは、
                        <br className="hidden sm:block" />
                        まずこの 3 つだけ。
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base sm:leading-7">
                        画像の空気感そのままに、先に押さえるべきなのは
                        「何点入るか」「外したらどうなるか」「全滅後に何が残るか」だけです。
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="最初に覚えるルールの補足"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-950/80 text-gray-300 transition-colors hover:border-purple-300/30 hover:text-white"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs border-gray-700 bg-gray-950/95 px-4 py-3 text-gray-100">
                        まずは細かい進行よりも、得点ルールと全滅時の扱いを覚えるのが最短です。下に進むと攻め度、進行、再作問の順で理解できます。
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {heroRules.map((rule, index) => {
                      const Icon = rule.icon;

                      return (
                        <motion.article
                          key={rule.title}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.24,
                            delay: 0.06 + index * 0.05,
                          }}
                          className="rounded-[1.45rem] border border-gray-800 bg-gray-950/72 p-4"
                        >
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-400/10 text-purple-100">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                            {rule.label}
                          </div>
                          <h2 className="mt-2 text-lg font-black tracking-tight text-white">
                            {rule.title}
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-gray-300">
                            {rule.body}
                          </p>
                        </motion.article>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.85rem] border border-gray-800 bg-[linear-gradient(to_bottom,rgba(3,7,18,0.96),rgba(17,24,39,0.92))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-500">
                    Rule Guide
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
                    次に見る場所も、すぐ決まる
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-gray-300">
                    このページは、攻め度、ラウンド進行、再作問の順で追えばそのまま説明役にも使えます。
                  </p>

                  <div className="mt-5 grid gap-3">
                    {heroJumpLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group rounded-[1.4rem] border border-gray-800 bg-gray-950/70 p-4 transition-colors hover:border-purple-300/30 hover:bg-gray-900"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gray-500">
                          {item.eyebrow}
                        </div>
                        <div className="mt-2 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-black text-white">
                              {item.title}
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-gray-300">
                              {item.body}
                            </p>
                          </div>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-100" />
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <Button
                      asChild
                      className="h-12 bg-purple-400 text-gray-950 hover:bg-purple-300 sm:flex-1 lg:flex-none"
                    >
                      <Link href="/blank25">
                        問題を選んで作問する
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 border-gray-600 bg-gray-950/75 text-white hover:bg-gray-800 sm:flex-1 lg:flex-none"
                    >
                      <Link href="/blank25/party">
                        得点ボードをひらく
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="attack-meter" className="mt-8 scroll-mt-24">
          <TeamBattleChickenMeter />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div id="round-flow" className="scroll-mt-24">
            <TeamBattleRoundFlow />
          </div>
          <div id="retry-simulator" className="scroll-mt-24">
            <TeamBattleRetrySimulator />
          </div>
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

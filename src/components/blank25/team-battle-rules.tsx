"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  HelpCircle,
  PartyPopper,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import TeamBattleChickenMeter from "@/components/blank25/team-battle-chicken-meter";
import TeamBattleRetrySimulator from "@/components/blank25/team-battle-retry-simulator";
import TeamBattleRoundFlow from "@/components/blank25/team-battle-round-flow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";

type HeroRule = {
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
};

const heroRules: HeroRule[] = [
  {
    label: "チームの出題者・回答者を決定",
    title: "出題者が作問",
    body: "出題者・回答者に別れ、出題者はまず作問します。謎解きのパネルを隠す役です。",
    icon: Target,
  },
  {
    label: "隠した数がポイントとなる",
    title: "回答者が回答",
    body: "出題者が作成した問題を、回答者は答えます。正解なら HIDE 数ぶん得点、不正解なら 0 点。",
    icon: HelpCircle,
  },
  {
    label: "逆転チャンス",
    title: "MVPの場合は順位倍率！",
    body: "最もパネルを隠して答えられたら、獲得得点は現在の順位倍率分入る。",
    icon: AlertTriangle,
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

              <div className="relative z-10 mx-auto -mt-6 grid max-w-5xl gap-4">
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
                      <p className="mt-3 text-sm leading-6 text-gray-300 sm:text-base sm:leading-7">
                        先に押さえるべきなのは「問題の出し方」「何点入るか」「逆転するにはどうするのか」だけです。
                      </p>
                    </div>
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
                          <div className="flex rounded-2xl border border-purple-300/20 bg-purple-400/10 text-purple-100">
                            <div className="inline-flex h-11 w-11 items-center justify-center">
                              <Icon className="h-5 w-5" />
                            </div>
                            <h2 className="mt-2 text-lg font-black tracking-tight text-white">
                              {rule.title}
                            </h2>
                          </div>

                          <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
                            {rule.label}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-gray-300">
                            {rule.body}
                          </p>
                        </motion.article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
          <div className="relative aspect-[5/6] sm:aspect-[16/10] lg:aspect-[16/8]">
            <Image
              src="/img/blank25/blank25teambattle-rules.png"
              alt="BLANK25 チーム戦のルール画像"
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

        <section id="attack-meter" className="mt-8 scroll-mt-24">
          <TeamBattleChickenMeter />
        </section>

        <section className="mt-8 grid gap-6">
          <div id="round-flow" className="scroll-mt-24">
            <TeamBattleRoundFlow />
          </div>
        </section>
        <div id="retry-simulator" className="scroll-mt-24">
          <TeamBattleRetrySimulator />
        </div>

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

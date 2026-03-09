"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import TeamBattleTutorialImageBoard from "@/components/blank25/team-battle-tutorial-image-board";
import {
  TEAM_BATTLE_PANEL_TOTAL,
  getTeamBattleHiddenPanels,
  getTeamBattleOpenPanels,
} from "@/components/blank25/team-battle-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RetrySceneKey = "first" | "fail" | "retry";

const sceneLabels: Record<RetrySceneKey, string> = {
  first: "1回目の作問",
  fail: "全チーム失敗",
  retry: "やり直し盤",
};

export default function TeamBattleRetrySimulator() {
  const [scene, setScene] = useState<RetrySceneKey>("first");

  const firstHiddenPanels = useMemo(() => getTeamBattleHiddenPanels(15), []);
  const retryHiddenPanels = useMemo(() => getTeamBattleHiddenPanels(10), []);
  const fixedOpenPanels = useMemo(
    () => getTeamBattleOpenPanels(firstHiddenPanels),
    [firstHiddenPanels],
  );
  const newlyOpenedPanels = useMemo(
    () =>
      firstHiddenPanels.filter(
        (panelNumber) => !retryHiddenPanels.includes(panelNumber),
      ),
    [firstHiddenPanels, retryHiddenPanels],
  );

  const sceneContent = {
    first: {
      title: "最初の勝負盤",
      body: "作問者が強気に HIDE した最初の盤面。ここで当てれば、その HIDE 数がそのまま点になる。",
      hiddenPanels: firstHiddenPanels,
      lockedOpenPanels: [],
      newlyOpenedPanels: [],
      summary: `HIDE ${firstHiddenPanels.length}。正解なら ${firstHiddenPanels.length} 点`,
    },
    fail: {
      title: "全滅した瞬間",
      body: "見えていたマスは次回も固定で開いたまま。もう、あの情報は閉じられない。",
      hiddenPanels: firstHiddenPanels,
      lockedOpenPanels: fixedOpenPanels,
      newlyOpenedPanels: [],
      summary: `前回の ${fixedOpenPanels.length} マスは次も開いたまま`,
    },
    retry: {
      title: "やり直しの盤面",
      body: "再作問はできる。ただし、前回の見え情報を抱えたまま。HIDE できる枚数も減り、高得点は狙いづらくなる。",
      hiddenPanels: retryHiddenPanels,
      lockedOpenPanels: fixedOpenPanels,
      newlyOpenedPanels,
      summary: `HIDE ${retryHiddenPanels.length}。再挑戦時の上限も ${retryHiddenPanels.length} 点`,
    },
  } as const;

  const activeScene = sceneContent[scene];

  return (
    <Card className="overflow-hidden border-gray-700 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.98),rgba(17,24,39,0.92))] shadow-2xl shadow-black/25">
      <CardHeader className="border-b border-gray-800/80 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gray-500">
              Retry Simulator
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-white">
              全滅したら、何が残る？
            </CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="全滅時ルールの補足"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-950/80 text-gray-300 transition-colors hover:border-purple-300/30 hover:text-white"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs border-gray-700 bg-gray-950/95 px-4 py-3 text-gray-100">
              全チームが解けなかった場合はやり直し。ただし、前回見えていたパネルは必ず空いたままにします。
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(sceneLabels) as RetrySceneKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setScene(key)}
              className={[
                "rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
                scene === key
                  ? "border-purple-300/30 bg-purple-400 text-gray-950"
                  : "border-gray-700 bg-gray-950/80 text-gray-200 hover:border-purple-300/30 hover:text-white",
              ].join(" ")}
            >
              {sceneLabels[key]}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.88fr)] xl:items-center">
          <div className="rounded-[1.75rem] border border-gray-800 bg-black/25 p-4 sm:p-5">
            <TeamBattleTutorialImageBoard
              hiddenPanels={activeScene.hiddenPanels}
              lockedOpenPanels={activeScene.lockedOpenPanels}
              newlyOpenedPanels={activeScene.newlyOpenedPanels}
              showLegendLabels
              className="mx-auto max-w-[22rem]"
            />
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={scene}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5 h-[280px]"
              >
                <div className="inline-flex rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-100">
                  {sceneLabels[scene]}
                </div>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-white">
                  {activeScene.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-300">
                  {activeScene.body}
                </p>
                <p className="mt-4 rounded-2xl border border-gray-700 bg-gray-950/75 px-4 py-3 text-sm font-semibold text-white">
                  {activeScene.summary}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-gray-700 bg-gray-950/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                  Fixed
                </div>
                <div className="mt-2 text-3xl font-black tracking-tight text-white">
                  {fixedOpenPanels.length}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-gray-700 bg-gray-950/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                  HIDE
                </div>
                <div className="mt-2 text-3xl font-black tracking-tight text-white">
                  {activeScene.hiddenPanels.length}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-gray-700 bg-gray-950/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">
                  Open
                </div>
                <div className="mt-2 text-3xl font-black tracking-tight text-white">
                  {TEAM_BATTLE_PANEL_TOTAL - activeScene.hiddenPanels.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

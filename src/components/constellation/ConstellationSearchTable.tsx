"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Star, Flower2, Sun, Leaf, Snowflake, Sparkles } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { constellations } from "@/lib/constellation/constellations";
import {
  CONSTELLATION_TABS,
  type ConstellationTab,
  filterConstellationsByTab,
  matchSearch,
  preprocessKanaSearch,
} from "@/lib/constellation/search";

const SEASON_LABEL: Record<string, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

const formatVisibleMonths = ([start, end]: [number, number]) => {
  if (start === end) return `${start}月`;
  if (start < end) return `${start}〜${end}月`;
  return `${start}〜翌${end}月`;
};

const TAB_ICONS: Record<
  ConstellationTab,
  React.ComponentType<{ className?: string }>
> = {
  zodiac: Star,
  spring: Flower2,
  summer: Sun,
  autumn: Leaf,
  winter: Snowflake,
  all: Sparkles,
};

export function ConstellationSearchTable() {
  const [activeTab, setActiveTab] = useState<ConstellationTab>("zodiac");
  const [kanaSearch, setKanaSearch] = useState("");
  const [englishSearch, setEnglishSearch] = useState("");
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const tabbedConstellations = useMemo(
    () => filterConstellationsByTab(constellations, activeTab),
    [activeTab]
  );

  const filteredConstellations = useMemo(
    () =>
      tabbedConstellations.filter((item) => {
        const kanaMatch = matchSearch(item.nameKanaNorm, kanaSearch, {
          preprocessSearch: preprocessKanaSearch,
        });
        const englishMatch = matchSearch(
          [item.latinName, item.abbreviation],
          englishSearch.trim()
        );

        return kanaMatch && englishMatch;
      }),
    [englishSearch, kanaSearch, tabbedConstellations]
  );

  useEffect(() => {
    const updateIndicator = () => {
      const container = tabListRef.current;
      const activeElement = tabRefs.current[activeTab];

      if (!container || !activeElement) return;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      setIndicatorStyle({
        width: activeRect.width,
        left: activeRect.left - containerRect.left + container.scrollLeft,
      });
    };

    updateIndicator();

    window.addEventListener("resize", updateIndicator);
    const container = tabListRef.current;
    container?.addEventListener("scroll", updateIndicator, { passive: true });

    return () => {
      window.removeEventListener("resize", updateIndicator);
      container?.removeEventListener("scroll", updateIndicator);
    };
  }, [activeTab]);

  return (
    <main className="p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">星座システム</h1>

        <div
          role="tablist"
          aria-label="星座カテゴリ切り替え"
          ref={tabListRef}
          className="relative mb-6 grid grid-cols-6 gap-1 rounded-2xl border border-gray-800/60 bg-gray-900/50 p-1 text-center shadow-inner shadow-black/20"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1 block h-1 rounded-full bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 shadow-[0_0_18px_rgba(217,70,239,0.45)] transition-all duration-300 ease-out"
            style={{
              width: indicatorStyle.width,
              transform: `translateX(${indicatorStyle.left}px)`,
            }}
          />
          {CONSTELLATION_TABS.map((tab) => {
            const IconComponent = TAB_ICONS[tab.id];
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                ref={(element) => {
                  tabRefs.current[tab.id] = element;
                }}
                className={clsx(
                  "relative z-10 flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70",
                  activeTab === tab.id
                    ? "bg-purple-500/60 text-white shadow-[0_6px_18px_rgba(147,51,234,0.3)]"
                    : "text-purple-400 hover:text-purple-200 hover:bg-white/5"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-[8px] font-semibold tracking-[0.1em] sm:text-[9px]">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-2 grid gap-3 sm:grid-cols-2">
          <div>
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="星座名ひらがな検索"
              placeholder="星座名ひらがな"
              value={kanaSearch}
              onChange={(event) => setKanaSearch(event.target.value)}
              className="block w-full bg-gray-700 text-white placeholder-gray-400 border-purple-400 text-[16px]"
            />
          </div>
          <div>
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="none"
              aria-label="ラテン名・略称検索"
              placeholder="ラテン名 / 略称"
              value={englishSearch}
              onChange={(event) => setEnglishSearch(event.target.value)}
              className="block w-full bg-gray-700 text-white placeholder-gray-400 border-purple-400 text-[16px]"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center">
          ＊ = 0文字以上の任意 / ？ = 1文字のみ一致
        </p>

        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-700">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-gray-700/50 hover:bg-transparent">
                <TableHead className="hidden sm:table-cell text-purple-300 font-bold">
                  季節
                </TableHead>
                <TableHead className="text-purple-300 font-bold">
                  星座名
                </TableHead>
                <TableHead className="hidden sm:table-cell text-purple-300 font-bold">
                  ひらがな
                </TableHead>
                <TableHead className="text-purple-300 font-bold">
                  ラテン名 / 略称
                </TableHead>
                <TableHead className="hidden sm:table-cell text-purple-300 font-bold">
                  観測しやすい時期
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConstellations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400">
                    該当する星座が見つかりませんでした
                  </TableCell>
                </TableRow>
              ) : (
                filteredConstellations.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-b border-gray-700/30 hover:bg-purple-500/10 transition-all duration-200 group"
                  >
                    <TableCell className="p-3 sm:p-4 hidden sm:table-cell font-medium text-gray-300">
                      <span className="inline-block px-2 py-1 bg-gray-700/50 rounded-lg text-xs group-hover:bg-purple-500/20 transition-colors duration-200">
                        {SEASON_LABEL[item.season]}
                      </span>
                    </TableCell>
                    <TableCell className="p-3 sm:p-4  font-bold text-white group-hover:text-purple-300 transition-colors duration-200">
                      <span className="h-3.5 sm:hidden block text-[10px] text-purple-200/80 tracking-wide mb-0">
                        {item.nameKana}
                      </span>
                      {item.nameJa}
                    </TableCell>
                    <TableCell className="p-3 sm:p-4 hidden sm:table-cell text-gray-400">
                      {item.nameKana}
                    </TableCell>
                    <TableCell className="p-3 sm:p-4 text-gray-300">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                        <span className="h-2.5 sm:hidden block text-[10px] text-purple-200/80 tracking-wide mb-0">
                          {item.abbreviation}
                        </span>
                        <span className="font-medium">{item.latinName}</span>
                        <span className="hidden sm:inline text-xs text-purple-400/80 font-mono">
                          {item.abbreviation}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 sm:p-4 hidden sm:table-cell text-gray-400">
                      <span className="inline-block px-2 py-1 bg-gray-700/30 rounded text-xs">
                        {formatVisibleMonths(item.visibleMonths)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Shuffle,
  ChevronRight,
} from "lucide-react";

export type ReportRow = {
  inputWord: string;
  shift: number;
  shiftedWord: string;
  matchType: string;
  matchedWords?: string[];
};

type Props = {
  rows: ReportRow[];
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.02 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

function getMatchedWordsList(row: ReportRow): string[] {
  if (row.matchedWords && row.matchedWords.length > 0) {
    return row.matchedWords;
  }
  return [row.shiftedWord];
}

function getMatchTypeBadge(matchType: string) {
  if (matchType === "完全一致") {
    return {
      bg: "bg-emerald-500/20",
      text: "text-emerald-300",
      label: "完全一致",
    };
  }
  return {
    bg: "bg-violet-500/20",
    text: "text-violet-300",
    label: "アナグラム",
  };
}

export function ShiftSearchReportDetail({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400">ヒット行はありません。</p>
      </section>
    );
  }

  return (
    <>
      {/* Desktop: table view */}
      <div className="hidden md:block">
        <DesktopTable rows={rows} />
      </div>

      {/* Mobile: card view */}
      <div className="block md:hidden">
        <MobileCards rows={rows} />
      </div>
    </>
  );
}

/* ===== Desktop Table ===== */
function DesktopTable({ rows }: Props) {
  return (
    <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 max-w-3xl">
      <table className="text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
            <th className="text-left py-3 pr-4">入力語</th>
            <th className="text-center py-3 px-2 whitespace-nowrap">シフト</th>
            <th className="text-left py-3 px-4">シフト後</th>
            <th className="text-center py-3 px-2 whitespace-nowrap">一致種別</th>
            <th className="text-left py-3 pl-4">マッチ語</th>
          </tr>
        </thead>
        <motion.tbody variants={container} initial="hidden" animate="show">
          {rows.map((row, index) => {
            const matched = getMatchedWordsList(row);
            const badge = getMatchTypeBadge(row.matchType);

            return matched.map((word, wordIndex) => (
              <motion.tr
                key={`${row.inputWord}-${row.shift}-${row.shiftedWord}-${row.matchType}-${word}-${index}-${wordIndex}`}
                variants={item}
                className="border-b border-gray-700/40 hover:bg-gray-700/20 transition-colors"
              >
                {/* inputWord - only show on first matched word */}
                <td className="py-2 pr-4">
                  {wordIndex === 0 ? (
                    <span className="font-mono font-semibold text-gray-100">
                      {row.inputWord}
                    </span>
                  ) : null}
                </td>

                {/* shift arrow */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  {wordIndex === 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-xs text-sky-400">
                      <ArrowRight className="h-3 w-3" />
                      <span className="tabular-nums font-medium">
                        +{row.shift}
                      </span>
                    </span>
                  ) : null}
                </td>

                {/* shiftedWord */}
                <td className="py-2 px-4">
                  {wordIndex === 0 ? (
                    <span className="font-mono text-gray-300">
                      {row.shiftedWord}
                    </span>
                  ) : null}
                </td>

                {/* matchType */}
                <td className="py-2 px-2 text-center">
                  {wordIndex === 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${badge.bg} ${badge.text}`}
                    >
                      {row.matchType === "アナグラム" && (
                        <Shuffle className="h-3 w-3" />
                      )}
                      {badge.label}
                    </span>
                  ) : null}
                </td>

                {/* matchedWord */}
                <td className="py-2 pl-4">
                  <span className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-gray-600" />
                    <span className="font-mono font-semibold text-purple-300">
                      {word}
                    </span>
                  </span>
                </td>
              </motion.tr>
            ));
          })}
        </motion.tbody>
      </table>
    </section>
  );
}

/* ===== Mobile Cards ===== */
function MobileCards({ rows }: Props) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {rows.map((row, index) => (
        <MobileCard key={`${row.inputWord}-${row.shift}-${row.shiftedWord}-${row.matchType}-${index}`} row={row} />
      ))}
    </motion.div>
  );
}

function MobileCard({ row }: { row: ReportRow }) {
  const matched = getMatchedWordsList(row);
  const badge = getMatchTypeBadge(row.matchType);

  return (
    <motion.div
      variants={item}
      className="bg-gray-800 border border-gray-700 rounded-xl p-3.5 space-y-2"
    >
      {/* Flow: inputWord → shiftedWord */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* inputWord */}
        <span className="font-mono font-bold text-base text-gray-100">
          {row.inputWord}
        </span>

        {/* shift badge */}
        <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-medium text-sky-400 shrink-0">
          <ArrowRight className="h-2.5 w-2.5" />
          +{row.shift}
        </span>

        {/* shiftedWord */}
        <span className="font-mono text-sm text-gray-400">
          {row.shiftedWord}
        </span>

        {/* matchType badge */}
        <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium shrink-0 ${badge.bg} ${badge.text}`}
        >
          {row.matchType === "アナグラム" && (
            <Shuffle className="h-2.5 w-2.5" />
          )}
          {badge.label}
        </span>
      </div>

      {/* Matched words - each on its own line */}
      <div className="flex flex-col gap-1 pl-1">
        {matched.map((word, i) => (
          <div key={`${word}-${i}`} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-purple-500/60 shrink-0" />
            <span className="font-mono font-bold text-purple-300 text-base">
              {word}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

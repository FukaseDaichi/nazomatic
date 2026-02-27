"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

export type ReportItem = {
  reportKey: string;
  language: "jp" | "en";
  length: number;
  dictionary: string;
  targetWordCount: number;
  totalHitRows: number;
  generatedAt: string;
  deliveryType: "internal" | "external";
  externalUrl: string | null;
};

type Props = {
  reports: ReportItem[];
};

const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP");

function getLanguageLabel(language: "jp" | "en"): string {
  return language === "jp" ? "日本語" : "英語";
}

function getLanguageShort(language: "jp" | "en"): string {
  return language === "jp" ? "JP" : "EN";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", { hour12: false });
}

function formatDateShort(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ja-JP");
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function ShiftSearchReportList({ reports }: Props) {
  return (
    <>
      {/* Desktop: table view */}
      <div className="hidden md:block">
        <DesktopTable reports={reports} />
      </div>

      {/* Mobile: card view */}
      <div className="block md:hidden">
        <MobileCards reports={reports} />
      </div>
    </>
  );
}

function DesktopTable({ reports }: Props) {
  return (
    <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left py-3 pr-3">言語</th>
              <th className="text-right py-3 pr-3">文字数</th>
              <th className="text-left py-3 pr-3">辞書</th>
              <th className="text-right py-3 pr-3">対象語数</th>
              <th className="text-right py-3 pr-3">ヒット行数</th>
              <th className="text-left py-3 pr-3">生成日時</th>
              <th className="text-left py-3 pr-3">表示先</th>
              <th className="text-left py-3">リンク</th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {reports.map((report) => (
              <motion.tr
                key={report.reportKey}
                variants={item}
                className="border-b border-gray-700/60 align-top hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-3 pr-3">
                  <span className="inline-flex items-center rounded-md bg-gray-700 px-2 py-0.5 text-xs font-medium">
                    {getLanguageLabel(report.language)}
                  </span>
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">
                  {report.length}
                </td>
                <td className="py-3 pr-3 text-gray-300">{report.dictionary}</td>
                <td className="py-3 pr-3 text-right tabular-nums">
                  {NUMBER_FORMAT.format(report.targetWordCount)}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums font-medium">
                  {NUMBER_FORMAT.format(report.totalHitRows)}
                </td>
                <td className="py-3 pr-3 text-gray-400 text-xs">
                  {formatDate(report.generatedAt)}
                </td>
                <td className="py-3 pr-3">
                  {report.deliveryType === "internal" ? (
                    <span className="text-xs text-emerald-400">内部</span>
                  ) : (
                    <span className="text-xs text-sky-400">外部</span>
                  )}
                </td>
                <td className="py-3">
                  <ReportLink report={report} />
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </section>
  );
}

function MobileCards({ reports }: Props) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {reports.map((report) => (
        <MobileCard key={report.reportKey} report={report} />
      ))}
    </motion.div>
  );
}

function MobileCard({ report }: { report: ReportItem }) {
  const isInternal = report.deliveryType === "internal";
  const href = isInternal
    ? `/shift-search/reports/${report.language}/${report.length}`
    : report.externalUrl;
  const isDisabled = !isInternal && !report.externalUrl;

  const inner = (
    <motion.div
      variants={item}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      className={`
        relative bg-gray-800 border border-gray-700 rounded-xl p-4
        transition-all duration-200
        ${isDisabled ? "opacity-60" : "hover:border-gray-500 hover:bg-gray-750 active:bg-gray-700/80"}
      `}
    >
      {/* Top row: Language badge + length + hit count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tracking-wide ${
              report.language === "jp"
                ? "bg-rose-500/20 text-rose-300"
                : "bg-sky-500/20 text-sky-300"
            }`}
          >
            {getLanguageShort(report.language)}
          </span>
          <span className="text-lg font-bold tabular-nums">
            {report.length}
            <span className="text-sm font-normal text-gray-400 ml-0.5">
              文字
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-400">ヒット</span>
          <span className="font-bold tabular-nums text-purple-300">
            {NUMBER_FORMAT.format(report.totalHitRows)}
          </span>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between">
        {isDisabled ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            外部リンク未設定
          </span>
        ) : isInternal ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
            <FileText className="h-3.5 w-3.5" />
            レポートを開く
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-sky-400 font-medium">
            <ExternalLink className="h-3.5 w-3.5" />
            外部で開く
          </span>
        )}

        {!isDisabled && (
          <ArrowUpRight className="h-4 w-4 text-gray-500" />
        )}
      </div>
    </motion.div>
  );

  if (isDisabled) {
    return inner;
  }

  if (isInternal) {
    return <Link href={href!}>{inner}</Link>;
  }

  return (
    <a href={href!} target="_blank" rel="noreferrer noopener">
      {inner}
    </a>
  );
}

function ReportLink({ report }: { report: ReportItem }) {
  if (report.deliveryType === "internal") {
    return (
      <Link
        href={`/shift-search/reports/${report.language}/${report.length}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 hover:text-emerald-200"
      >
        <FileText className="h-3.5 w-3.5" />
        開く
      </Link>
    );
  }

  if (report.externalUrl) {
    return (
      <a
        href={report.externalUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/25 hover:text-sky-200"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        外部で開く
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5" />
      未設定
    </span>
  );
}

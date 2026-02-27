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

type DisabledReason = "no_results" | "missing_external_url" | null;

const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP");
const EXTERNAL_THRESHOLD = 10_000;

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

function getReportDisabledReason(report: ReportItem): DisabledReason {
  if (report.totalHitRows === 0) {
    return "no_results";
  }

  if (report.deliveryType === "external" && !report.externalUrl) {
    return "missing_external_url";
  }

  return null;
}

function getReportHref(report: ReportItem): string | null {
  if (getReportDisabledReason(report)) {
    return null;
  }

  if (report.deliveryType === "internal") {
    return `/shift-search/reports/${report.language}/${report.length}`;
  }

  return report.externalUrl;
}

function getDisabledLabel(reason: DisabledReason): string {
  if (reason === "no_results") {
    return "検索結果が0件のためリンクなし";
  }

  return "外部リンクが未設定";
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
    <section className="space-y-3">
      {/* Desktop: table view */}
      <div className="hidden md:block">
        <DesktopTable reports={reports} />
      </div>

      {/* Mobile: card view */}
      <div className="block md:hidden">
        <MobileCards reports={reports} />
      </div>
    </section>
  );
}

function DesktopTable({ reports }: Props) {
  return (
    <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 overflow-visible">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left py-3 pr-3">言語</th>
              <th className="text-right py-3 pr-3">文字数</th>
              <th className="text-left py-3 pr-3">辞書</th>
              <th className="text-right py-3 pr-3">対象語数</th>
              <th className="text-right py-3 pr-3">ヒット件数</th>
              <th className="text-left py-3 pr-3">生成日時</th>
              <th className="text-left py-3 pr-3">表示先</th>
              <th className="text-left py-3">リンク</th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {reports.map((report) => {
              const disabledReason = getReportDisabledReason(report);
              const isLinkDisabled = disabledReason !== null;
              const isNoResult = disabledReason === "no_results";

              return (
                <motion.tr
                  key={report.reportKey}
                  variants={item}
                  className={`border-b border-gray-700/60 align-top transition-colors ${
                    isLinkDisabled
                      ? "bg-gray-800/40 text-gray-400"
                      : "hover:bg-gray-700/30"
                  }`}
                >
                  <td className="py-3 pr-3">
                    <span className="inline-flex items-center rounded-md bg-gray-700 px-2 py-0.5 text-xs font-medium">
                      {getLanguageLabel(report.language)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {report.length}
                  </td>
                  <td className="py-3 pr-3 text-gray-300">
                    {report.dictionary}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {NUMBER_FORMAT.format(report.targetWordCount)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-medium">
                    <span className={isNoResult ? "text-gray-500" : undefined}>
                      {NUMBER_FORMAT.format(report.totalHitRows)}
                    </span>
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
                    <ReportLink
                      report={report}
                      disabledReason={disabledReason}
                    />
                  </td>
                </motion.tr>
              );
            })}
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
  const href = getReportHref(report);
  const disabledReason = getReportDisabledReason(report);
  const isDisabled = disabledReason !== null;

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
            {getDisabledLabel(disabledReason)}
          </span>
        ) : isInternal ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
            <FileText className="h-3.5 w-3.5" />
            レポートを開く
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-sky-400 font-medium">
            <ExternalLink className="h-3.5 w-3.5" />
            外部サイトで開く
          </span>
        )}

        {!isDisabled && <ArrowUpRight className="h-4 w-4 text-gray-500" />}
      </div>
    </motion.div>
  );

  if (isDisabled || !href) {
    return inner;
  }

  if (isInternal) {
    return <Link href={href}>{inner}</Link>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {inner}
    </a>
  );
}

function ReportLink({
  report,
  disabledReason,
}: {
  report: ReportItem;
  disabledReason?: DisabledReason;
}) {
  const reason = disabledReason ?? getReportDisabledReason(report);

  if (reason) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-700/70 px-3 py-1.5 text-xs font-medium text-gray-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        {getDisabledLabel(reason)}
      </span>
    );
  }

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

  return (
    <a
      href={report.externalUrl!}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/25 hover:text-sky-200"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      外部サイトで開く
    </a>
  );
}

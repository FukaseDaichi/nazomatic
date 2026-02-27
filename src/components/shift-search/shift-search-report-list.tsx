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

type DisabledReason = "no_results" | null;

const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP");

function getLanguageLabel(language: "jp" | "en"): string {
  return language === "jp" ? "\u65e5\u672c\u8a9e" : "\u82f1\u8a9e";
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

function getInternalReportHref(report: ReportItem): string {
  return `/shift-search/reports/${report.language}/${report.length}`;
}

function isExternalDirectLink(report: ReportItem): boolean {
  return report.deliveryType === "external" && Boolean(report.externalUrl);
}

function getReportDisabledReason(report: ReportItem): DisabledReason {
  if (report.totalHitRows === 0) {
    return "no_results";
  }

  return null;
}

function getReportHref(report: ReportItem): string | null {
  if (getReportDisabledReason(report)) {
    return null;
  }

  if (isExternalDirectLink(report)) {
    return report.externalUrl;
  }

  return getInternalReportHref(report);
}

function getDisabledLabel(reason: DisabledReason): string {
  if (reason === "no_results") {
    return "\u691c\u7d22\u7d50\u679c\u304c0\u4ef6\u306e\u305f\u3081\u30ea\u30f3\u30af\u306a\u3057";
  }

  return "";
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
      <div className="hidden md:block">
        <DesktopTable reports={reports} />
      </div>

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
              <th className="text-left py-3 pr-3">{"\u8a00\u8a9e"}</th>
              <th className="text-right py-3 pr-3">{"\u6587\u5b57\u6570"}</th>
              <th className="text-left py-3 pr-3">{"\u8f9e\u66f8"}</th>
              <th className="text-right py-3 pr-3">{"\u5bfe\u8c61\u8a9e\u6570"}</th>
              <th className="text-right py-3 pr-3">{"\u30d2\u30c3\u30c8\u4ef6\u6570"}</th>
              <th className="text-left py-3 pr-3">{"\u751f\u6210\u65e5\u6642"}</th>
              <th className="text-left py-3 pr-3">{"\u8868\u793a\u5148"}</th>
              <th className="text-left py-3">{"\u30ea\u30f3\u30af"}</th>
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
                  <td className="py-3 pr-3 text-gray-300">{report.dictionary}</td>
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
                    {isExternalDirectLink(report) ? (
                      <span className="text-xs text-sky-400">{"\u5916\u90e8"}</span>
                    ) : (
                      <span className="text-xs text-emerald-400">{"\u5185\u90e8"}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <ReportLink report={report} disabledReason={disabledReason} />
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
  const opensExternalSite = isExternalDirectLink(report);
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
              {"\u6587\u5b57"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-400">{"\u30d2\u30c3\u30c8"}</span>
          <span className="font-bold tabular-nums text-purple-300">
            {NUMBER_FORMAT.format(report.totalHitRows)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {isDisabled ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {getDisabledLabel(disabledReason)}
          </span>
        ) : !opensExternalSite ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
            <FileText className="h-3.5 w-3.5" />
            {"\u30ec\u30dd\u30fc\u30c8\u3092\u958b\u304f"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-sky-400 font-medium">
            <ExternalLink className="h-3.5 w-3.5" />
            {"\u5916\u90e8\u30b5\u30a4\u30c8\u3067\u958b\u304f"}
          </span>
        )}

        {!isDisabled && <ArrowUpRight className="h-4 w-4 text-gray-500" />}
      </div>
    </motion.div>
  );

  if (isDisabled || !href) {
    return inner;
  }

  if (!opensExternalSite) {
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

  if (!isExternalDirectLink(report)) {
    return (
      <Link
        href={getInternalReportHref(report)}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 hover:text-emerald-200"
      >
        <FileText className="h-3.5 w-3.5" />
        {"\u958b\u304f"}
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
      {"\u5916\u90e8\u30b5\u30a4\u30c8\u3067\u958b\u304f"}
    </a>
  );
}

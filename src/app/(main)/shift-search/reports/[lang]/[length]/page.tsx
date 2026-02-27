import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import {
  getInternalStaticParams,
  getShiftSearchViewReport,
  readInternalShiftSearchReport,
  type ShiftSearchReportLanguage,
} from "@/lib/shift-search-report-view";
import {
  ShiftSearchReportDetail,
  type ReportRow,
} from "@/components/shift-search/shift-search-report-detail";
import { ArrowLeft } from "lucide-react";

type PageProps = {
  params: {
    lang: string;
    length: string;
  };
};

const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP");

export const dynamicParams = false;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", { hour12: false });
}

function parseLanguage(raw: string): ShiftSearchReportLanguage | null {
  if (raw === "jp" || raw === "en") {
    return raw;
  }
  return null;
}

export function generateStaticParams() {
  return getInternalStaticParams();
}

export default function ShiftSearchReportDetailPage({ params }: PageProps) {
  const language = parseLanguage(params.lang);
  const length = Number(params.length);
  if (!language || !Number.isInteger(length) || length <= 0) {
    notFound();
  }

  const summary = getShiftSearchViewReport(language, length);
  if (!summary || summary.deliveryType !== "internal") {
    notFound();
  }

  const report = readInternalShiftSearchReport(language, length);
  if (!report) {
    notFound();
  }

  const reportRows: ReportRow[] = report.rows.map((r) => ({
    inputWord: r.inputWord,
    shift: r.shift,
    shiftedWord: r.shiftedWord,
    matchType: r.matchType,
    matchedWords: r.matchedWords,
  }));

  return (
    <>
      <ArticleHeaderComponent />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">
              シフト検索レポート ({language.toUpperCase()} / {length}文字)
            </h1>
            <Link
              href="/shift-search/reports"
              className="inline-flex items-center gap-1 rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-gray-100 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              一覧
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
            <p className="text-gray-400">
              辞書: <span className="text-gray-200">{report.dictionary}</span>
            </p>
            <p className="text-gray-400">
              対象語数:{" "}
              <span className="text-gray-200 tabular-nums">
                {NUMBER_FORMAT.format(report.targetWordCount)}
              </span>
            </p>
            <p className="text-gray-400">
              実行語数:{" "}
              <span className="text-gray-200 tabular-nums">
                {NUMBER_FORMAT.format(report.executedWordCount)}
              </span>
            </p>
            <p className="text-gray-400">
              ヒット行数:{" "}
              <span className="text-gray-200 tabular-nums font-medium">
                {NUMBER_FORMAT.format(report.totalHitRows)}
              </span>
            </p>
            <p className="text-gray-400">
              開始: <span className="text-gray-200 text-xs">{formatDate(report.startedAt)}</span>
            </p>
            <p className="text-gray-400">
              生成: <span className="text-gray-200 text-xs">{formatDate(report.generatedAt)}</span>
            </p>
          </div>
        </section>

        <ShiftSearchReportDetail rows={reportRows} />
      </main>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import {
  getShiftSearchViewReports,
  getShiftSearchViewReport,
  readInternalShiftSearchReport,
  type ShiftSearchReportLanguage,
} from "@/lib/shift-search-report-view";
import {
  ShiftSearchReportDetail,
  type ReportRow,
} from "@/components/shift-search/shift-search-report-detail";
import { ArrowLeft, Download } from "lucide-react";

type PageProps = {
  params: {
    lang: string;
    length: string;
  };
};

const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP");
const EXTERNAL_THRESHOLD = 10_000;
const RAW_REPORT_BASE_URL =
  "https://raw.githubusercontent.com/FukaseDaichi/nazomatic/refs/heads/main/.codex/shift-search/reports";

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
  return getShiftSearchViewReports().map((report) => ({
    lang: report.language,
    length: String(report.length),
  }));
}

function getRawReportDownloadUrl(
  language: ShiftSearchReportLanguage,
  length: number,
): string {
  return `${RAW_REPORT_BASE_URL}/${language}/shift-search-${language}-len-${length}.md`;
}

export default function ShiftSearchReportDetailPage({ params }: PageProps) {
  const language = parseLanguage(params.lang);
  const length = Number(params.length);
  if (!language || !Number.isInteger(length) || length <= 0) {
    notFound();
  }

  const summary = getShiftSearchViewReport(language, length);
  if (!summary) {
    notFound();
  }

  const isLargeReport = summary.totalHitRows >= EXTERNAL_THRESHOLD;
  const downloadUrl = getRawReportDownloadUrl(language, length);

  const report =
    !isLargeReport && summary.deliveryType === "internal"
      ? readInternalShiftSearchReport(language, length)
      : null;

  if (!isLargeReport && (!report || summary.deliveryType !== "internal")) {
    notFound();
  }

  const reportRows: ReportRow[] = report
    ? report.rows.map((row) => ({
        inputWord: row.inputWord,
        shift: row.shift,
        shiftedWord: row.shiftedWord,
        matchType: row.matchType,
        matchedWords: row.matchedWords,
      }))
    : [];

  return (
    <>
      <ArticleHeaderComponent />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
              一覧へ
            </Link>
          </div>

          <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs sm:text-sm text-sky-100">
            ヒット件数が {NUMBER_FORMAT.format(EXTERNAL_THRESHOLD)}{" "}
            件以上のレポートは、
            ブラウザ負荷を避けるためダウンロードリンクを表示します。
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
            <p className="text-gray-400">
              辞書: <span className="text-gray-200">{summary.dictionary}</span>
            </p>
            <p className="text-gray-400">
              対象語数:{" "}
              <span className="text-gray-200 tabular-nums">
                {NUMBER_FORMAT.format(summary.targetWordCount)}
              </span>
            </p>
            <p className="text-gray-400">
              実行語数:{" "}
              <span className="text-gray-200 tabular-nums">
                {NUMBER_FORMAT.format(summary.executedWordCount)}
              </span>
            </p>
            <p className="text-gray-400">
              ヒット件数:{" "}
              <span className="text-gray-200 tabular-nums font-medium">
                {NUMBER_FORMAT.format(summary.totalHitRows)}
              </span>
            </p>
            {report?.startedAt && (
              <p className="text-gray-400">
                開始:{" "}
                <span className="text-gray-200 text-xs">
                  {formatDate(report.startedAt)}
                </span>
              </p>
            )}
            <p className="text-gray-400">
              生成:{" "}
              <span className="text-gray-200 text-xs">
                {formatDate(summary.generatedAt)}
              </span>
            </p>
          </div>
        </section>

        {isLargeReport ? (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
            <p className="text-sm text-gray-200 leading-relaxed">
              このレポートはヒット件数が多いため、ページ内表示の代わりに
              Markdown ファイルをダウンロードしてください。
            </p>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-md bg-sky-500/20 px-3 py-2 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30 hover:text-sky-100"
            >
              <Download className="h-4 w-4" />
              レポートをダウンロード
            </a>
          </section>
        ) : (
          <ShiftSearchReportDetail rows={reportRows} />
        )}
      </main>
    </>
  );
}

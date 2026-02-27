import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import {
  getInternalStaticParams,
  getShiftSearchViewReport,
  readInternalShiftSearchReport,
  type ShiftSearchReportLanguage,
} from "@/lib/shift-search-report-view";

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

  return (
    <>
      <ArticleHeaderComponent />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">
              シフト検索レポート詳細 ({language.toUpperCase()} / {length}文字)
            </h1>
            <Link
              href="/shift-search/reports"
              className="text-sm text-blue-300 hover:text-blue-200 underline"
            >
              一覧へ戻る
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <p>辞書: {report.dictionary}</p>
            <p>対象語数: {NUMBER_FORMAT.format(report.targetWordCount)}</p>
            <p>実行語数: {NUMBER_FORMAT.format(report.executedWordCount)}</p>
            <p>ヒット行数: {NUMBER_FORMAT.format(report.totalHitRows)}</p>
            <p>開始日時: {formatDate(report.startedAt)}</p>
            <p>生成日時: {formatDate(report.generatedAt)}</p>
          </div>
        </section>

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-300">
                  <th className="text-left py-2 pr-3">inputWord</th>
                  <th className="text-right py-2 pr-3">shift</th>
                  <th className="text-left py-2 pr-3">shiftedWord</th>
                  <th className="text-left py-2">matchType</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-gray-400">
                      ヒット行はありません。
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, index) => (
                    <tr
                      key={`${row.inputWord}-${row.shift}-${row.shiftedWord}-${row.matchType}-${index}`}
                      className="border-b border-gray-700/60"
                    >
                      <td className="py-2 pr-3">{row.inputWord}</td>
                      <td className="py-2 pr-3 text-right">{row.shift}</td>
                      <td className="py-2 pr-3">{row.shiftedWord}</td>
                      <td className="py-2">{row.matchType}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}


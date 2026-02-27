import ArticleHeaderComponent from "@/components/common/article-header-component";
import {
  getShiftSearchViewManifest,
  getShiftSearchViewReports,
} from "@/lib/shift-search-report-view";
import {
  ShiftSearchReportList,
  type ReportItem,
} from "@/components/shift-search/shift-search-report-list";

const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP");

export default function ShiftSearchReportsPage() {
  const manifest = getShiftSearchViewManifest();
  const reports = getShiftSearchViewReports();

  const reportItems: ReportItem[] = reports.map((r) => ({
    reportKey: r.reportKey,
    language: r.language,
    length: r.length,
    dictionary: r.dictionary,
    targetWordCount: r.targetWordCount,
    totalHitRows: r.totalHitRows,
    generatedAt: r.generatedAt,
    deliveryType: r.deliveryType,
    externalUrl: r.externalUrl,
  }));

  return (
    <>
      <ArticleHeaderComponent />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-2">
          <h1 className="text-2xl font-bold">シフト検索 レポート一覧</h1>
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-xs sm:text-sm text-sky-100 leading-relaxed">
            <p>
              検索結果が {NUMBER_FORMAT.format(manifest.externalRowThreshold)}{" "}
              件以上のレポートは、
              表示が重くなりやすいためダウンロードリンクにしています。
            </p>
          </div>
        </section>

        <ShiftSearchReportList reports={reportItems} />
      </main>
    </>
  );
}

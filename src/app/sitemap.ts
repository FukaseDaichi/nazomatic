import { MetadataRoute } from "next";
import features from "@/lib/json/features.json";
import { baseURL } from "@/app/config";
import { getShiftSearchViewReports } from "@/lib/shift-search-report-view";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = baseURL;
  const reports = getShiftSearchViewReports();

  // lastModified はビルド日時ではなく実際の更新日時のみ設定する
  // （毎ビルド更新扱いになると検索エンジンが lastmod を信用しなくなるため）
  const staticPaths: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  const featurePaths: MetadataRoute.Sitemap = features.features.map(
    (feature) => ({
      url: `${baseUrl}${feature.path}`,
      changeFrequency: "monthly",
      priority: 0.8,
    }),
  );

  const reportLastModified = reports
    .map((report) => new Date(report.generatedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  const reportPaths: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/shift-search/reports`,
      lastModified: reportLastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...reports.map((report) => {
      const generatedAt = new Date(report.generatedAt);
      return {
        url: `${baseUrl}/shift-search/reports/${report.language}/${report.length}`,
        lastModified: Number.isNaN(generatedAt.getTime())
          ? undefined
          : generatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      };
    }),
  ];

  return [...staticPaths, ...featurePaths, ...reportPaths];
}

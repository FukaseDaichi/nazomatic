import { MetadataRoute } from "next";
import features from "@/lib/json/features.json";
import { baseURL } from "@/app/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = baseURL;
  const lastModified = new Date();

  const staticPaths = [
    {
      url: baseUrl,
      lastModified,
      changefreq: "daily",
      priority: 1.0,
    },
  ];
  const featurePaths = features.features.map((feature) => ({
    url: `${baseUrl}${feature.path}`,
    lastModified,
    changefreq: "monthly",
    priority: 0.8,
  }));

  return [...staticPaths, ...featurePaths];
}

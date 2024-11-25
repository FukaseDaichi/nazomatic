import { MetadataRoute } from "next";
import features from "@/lib/json/features.json";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseURL = process.env.BASE_URL || "https://nazomatic.vercel.app";
  const lastModified = new Date();

  const staticPaths = [
    {
      url: baseURL,
      lastModified,
      changefreq: "daily",
      priority: 1.0,
    },
  ];
  const featurePaths = features.features.map((feature) => ({
    url: `${baseURL}${feature.path}`,
    lastModified,
    changefreq: "monthly",
    priority: 0.8,
  }));

  return [...staticPaths, ...featurePaths];
}

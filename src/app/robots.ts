import { MetadataRoute } from "next";
import { baseURL } from "@/app/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/secret/"], // disallowに/secret/を追加
    },
    sitemap: `${baseURL}/sitemap.xml`,
  };
}

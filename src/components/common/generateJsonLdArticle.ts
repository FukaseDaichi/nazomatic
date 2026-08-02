import { baseURL } from "@/app/config";
import { Article, WithContext } from "schema-dts";

export type JsonLdProps = {
  title: string;
  description?: string;
  path: string;
};

export function generateJsonLdArticle({
  title,
  description,
  path,
}: JsonLdProps): WithContext<Article> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    name: title,
    headline: title,
    description: description || "",
    url: `${baseURL}${path}`,
    image: `${baseURL}/og-image.png`,
    inLanguage: "ja",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseURL}${path}`,
    },
    author: {
      "@type": "Person",
      name: "WhiteFranc",
      url: "https://whitefranc.fanbox.cc/",
    },
    publisher: {
      "@type": "Organization",
      name: "ナゾマティック",
      url: baseURL,
      logo: {
        "@type": "ImageObject",
        url: `${baseURL}/favicons/favicon-96x96.png`,
      },
    },
  };
}

import Script from "next/script";
import {
  Article as JsonLDArticle,
  WebPage as JsonLDWebPage,
  WithContext,
} from "schema-dts";

type Props = {
  data: {
    title: string;
    description: string;
    publishedAt: string;
    updatedAt: string;
  };
  slug: string;
  page?: boolean;
};

export default function Article({ data, slug, page = false }: Props) {
  const jsonLd: WithContext<JsonLDArticle | JsonLDWebPage> = {
    "@context": "https://schema.org",
    "@type": !page ? "Article" : "WebPage",
    name: data.title,
    headline: data.title,
    description: data.description,
    image: `${process.env.NEXT_PUBLIC_BASE_URL}/img/icon_r.webp`,
    datePublished: data.publishedAt,
    dateModified: data.updatedAt,
    url: `${process.env.NEXT_PUBLIC_BASE_URL}${
      !page ? "/article" : ""
    }/${slug}`,
    mainEntityOfPage: `${process.env.NEXT_PUBLIC_BASE_URL}${
      !page ? "/article" : ""
    }/${slug}`,
    author: {
      "@type": "Person",
      name: "Khsmty",
      url: process.env.NEXT_PUBLIC_BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Khsmty",
      logo: {
        "@type": "ImageObject",
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/img/icon_r.webp`,
      },
    },
  };

  return (
    <Script
      id="json-ld-script"
      key="json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

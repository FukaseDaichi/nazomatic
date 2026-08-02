import type { Metadata } from "next";
import { getFeatureByPath, type FeaturePath } from "@/lib/features";

const SITE_NAME = "ナゾマティック";
const DEFAULT_OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "ナゾマティックのOGイメージ",
};

export type PageMetadataProps = {
  title: string;
  description: string;
  path: string;
};

/**
 * 個別ページ用の Metadata を生成する。
 * title / description / canonical / OGP / Twitter カードを一括で解決する。
 * metadataBase はルートレイアウトで設定済みのため、path は相対で渡す。
 */
export function generatePageMetadata({
  title,
  description,
  path,
}: PageMetadataProps): Metadata {
  const fullTitle = `${title}｜${SITE_NAME}`;
  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description,
      siteName: SITE_NAME,
      url: path,
      images: [DEFAULT_OG_IMAGE],
      locale: "ja_JP",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

/**
 * features.json の title / description からツールページの Metadata を生成する。
 */
export function generateFeatureMetadata(path: FeaturePath): Metadata {
  const feature = getFeatureByPath(path);
  return generatePageMetadata({
    title: feature.title,
    description: feature.description,
    path: feature.path,
  });
}

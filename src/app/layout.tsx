import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
const inter = Inter({ subsets: ["latin"] });

const BASE_URL = "https://nazomatic.vercel.app/";

export const viewport = "width=device-width, initial-scale=1";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "ナゾマティック｜謎解きお助けツール集",
  description:
    "ナゾマティック(NAZOMARICE)は、謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ナゾマティック｜謎解きお助けツール集",
    description:
      "ナゾマティック(NAZOMARICE)は、謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
    siteName: "ナゾマティック",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ナゾマティックのOGイメージ",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ナゾマティック｜謎解きお助けツール集",
    description:
      "ナゾマティック(NAZOMARICE)は、謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicons/favicon.svg", type: "image/svg+xml" },
      { url: "/favicons/favicon.ico" },
    ],
    apple: [{ url: "/favicons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/favicons/favicon.ico" }],
  },
  manifest: "/site.webmanifest",
  keywords: ["謎解き", "パズル", "NAZOMATIC", "お助けツール", "ナゾマティック"],
  authors: [{ name: "WhiteFranc", url: "https://あなたのサイトのURL" }],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ナゾマティック",
  url: BASE_URL,
  description:
    "ナゾマティック(NAZOMARICE)は、謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
  inLanguage: "ja",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white`}
      >
        {children}
      </body>
    </html>
  );
}

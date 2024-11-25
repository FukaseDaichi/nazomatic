import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ナゾマティック｜謎解きお助けツール集",
  description:
    "謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
  viewport: "width=device-width, initial-scale=1",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ナゾマティック｜謎解きお助けツール集",
    description:
      "謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
    siteName: "ナゾマティック",
    images: [
      {
        url: "https://nazomatic.vercel.app/og-image.png",
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
      "謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
    images: ["https://nazomatic.vercel.app/og-image.png"],
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        className={`${inter.className} min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white`}
      >
        {children}
      </body>
    </html>
  );
}

import { baseURL } from "@/app/config";
import "@/app/globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const themeColor = "#1a1a1a";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: themeColor,
};

export const metadata = {
  metadataBase: new URL(baseURL),
  title: "Blank25",
  icons: {
    icon: [
      { url: "/favicons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicons/favicon.svg", type: "image/svg+xml" },
      { url: "/favicons/favicon.ico" },
    ],
    apple: [{ url: "/favicons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/favicons/favicon.ico" }],
  },
  robots: {
    index: false, // インデックスを無効にする
    follow: true, // リンクはフォローする
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" style={{ backgroundColor: themeColor }}>
      <body
        className={`${inter.className} min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white`}
      >
        {children}
      </body>
    </html>
  );
}

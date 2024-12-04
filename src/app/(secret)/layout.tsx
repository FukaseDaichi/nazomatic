import { baseURL } from "@/app/config";
import "@/app/globals.css";

export const viewport =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0";

export const metadata = {
  metadataBase: new URL(baseURL),
  title: "Google",
  icons: {
    icon: [{ url: "/img/secret/favicon.ico" }],
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
    <html lang="ja">
      <body className="overflow-y-hidden">{children}</body>
    </html>
  );
}

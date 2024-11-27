import { baseURL } from "@/app/config";
import "@/app/globals.css";

export const viewport = "width=device-width, initial-scale=1";

export const metadata = {
  metadataBase: new URL(baseURL),
  title: "Google",
  icons: {
    icon: [{ url: "/img/secret/favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

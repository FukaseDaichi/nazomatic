import type { Metadata } from "next";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";

import CalendarPageClient from "@/components/calendar/CalendarPageClient";

const calendarTitle = "謎チケカレンダー｜ナゾマティック";
const calendarDescription =
  "Xの「#謎チケ売ります」などから抽出した謎解きチケット情報を、日付ごとのカレンダーで確認できます。";
const calendarOgpImage = {
  url: "/img/calendar-ogp.png",
  width: 1200,
  height: 630,
  alt: "謎チケカレンダーのOGP画像",
};

export const metadata: Metadata = {
  title: calendarTitle,
  description: calendarDescription,
  openGraph: {
    title: calendarTitle,
    description: calendarDescription,
    siteName: "ナゾマティック",
    url: "/calendar",
    images: [calendarOgpImage],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: calendarTitle,
    description: calendarDescription,
    images: [calendarOgpImage],
  },
};

export default function CalendarPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/calendar" />
      <CalendarPageClient />
    </>
  );
}

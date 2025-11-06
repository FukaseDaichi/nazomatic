import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";

import CalendarPageClient from "@/components/calendar/CalendarPageClient";

export default function CalendarPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article index={6} />
      <CalendarPageClient />
    </>
  );
}

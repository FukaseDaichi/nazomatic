import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import { PrefectureSearchTableComponent } from "@/components/prefecture/prefecture-search-table";

export default function Prefectures() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article index={4} />
      <PrefectureSearchTableComponent />
    </>
  );
}

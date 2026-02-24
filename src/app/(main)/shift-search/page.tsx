import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import ShiftSearch from "@/components/shift-search/shift-search";

export default function ShiftSearchPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article index={8} />
      <ShiftSearch />
    </>
  );
}


import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import ShiftSearch from "@/components/shift-search/shift-search";
import { generateFeatureMetadata } from "@/lib/seo";

export const metadata = generateFeatureMetadata("/shift-search");

export default function ShiftSearchPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/shift-search" />
      <ShiftSearch />
    </>
  );
}


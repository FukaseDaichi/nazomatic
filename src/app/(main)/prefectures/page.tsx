import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import { PrefectureSearchTableComponent } from "@/components/prefecture/prefecture-search-table";
import { generateFeatureMetadata } from "@/lib/seo";

export const metadata = generateFeatureMetadata("/prefectures");

export default function Prefectures() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/prefectures" />
      <PrefectureSearchTableComponent />
    </>
  );
}

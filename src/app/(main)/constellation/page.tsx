import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import { ConstellationSearchTable } from "@/components/constellation/ConstellationSearchTable";

export default function ConstellationPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/constellation" />
      <ConstellationSearchTable />
    </>
  );
}

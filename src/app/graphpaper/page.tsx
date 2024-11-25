import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import GraphPaperComponent from "@/components/graphpaper/graph-paper-component";

export default function GraphPaper() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article index={3} />
      <GraphPaperComponent />
    </>
  );
}

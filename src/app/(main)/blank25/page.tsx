import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import Blank25ProblemList from "@/components/blank25/problem-list";

export default function Blank25ListPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article index={8} />
      <Blank25ProblemList />
    </>
  );
}


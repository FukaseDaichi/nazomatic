import ArticleHeaderComponent from "@/components/common/article-header-component";
import Blank25Game from "@/components/blank25/blank25-game";

export default function Blank25ProblemPage({
  params,
}: {
  params: { problemId: string };
}) {
  return (
    <>
      <ArticleHeaderComponent />
      <Blank25Game problemId={params.problemId} />
    </>
  );
}

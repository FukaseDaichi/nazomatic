import ArticleHeaderComponent from "@/components/common/article-header-component";
import Blank25Game from "@/components/blank25/blank25-game";

export default async function Blank25ProblemPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;
  return (
    <>
      <ArticleHeaderComponent />
      <Blank25Game problemId={problemId} />
    </>
  );
}

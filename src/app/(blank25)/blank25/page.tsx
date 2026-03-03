import ArticleHeaderComponent from "@/components/common/article-header-component";
import Blank25ProblemList from "@/components/blank25/problem-list";
import Link from "next/link";

export default function Blank25ListPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <div className="absolute right-4 top-20 z-40 sm:right-6">
        <Link
          href="/blank25/editor"
          className="inline-flex items-center rounded-full border border-amber-300/60 bg-gray-900/85 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur transition-colors hover:bg-gray-800"
        >
          Admin
        </Link>
      </div>
      <Blank25ProblemList />
    </>
  );
}

import { AlphabetConverter } from "@/components/alphabet/alphabet-converter";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";

export default function Alphabet() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article index={2} />
      <AlphabetConverter />
    </>
  );
}

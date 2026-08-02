import { AlphabetConverter } from "@/components/alphabet/alphabet-converter";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import { generateFeatureMetadata } from "@/lib/seo";

export const metadata = generateFeatureMetadata("/alphabet");

export default function Alphabet() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/alphabet" />
      <AlphabetConverter />
    </>
  );
}

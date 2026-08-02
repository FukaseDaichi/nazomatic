import AnagramSearch from "@/components/anagram/anagram-search";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import { generateFeatureMetadata } from "@/lib/seo";

export const metadata = generateFeatureMetadata("/anagram");

export default function Alphabet() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/anagram" />
      <AnagramSearch />
    </>
  );
}

import AnagramSearch from "@/components/anagram/anagram-search";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";

export default function Alphabet() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article index={5} />
      <AnagramSearch />
    </>
  );
}

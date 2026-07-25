import CharacterPickSearch from "@/components/character-pick-search/character-pick-search";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";

export default function CharacterPickSearchPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/character-pick-search" />
      <CharacterPickSearch />
    </>
  );
}

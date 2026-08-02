import CharacterPickSearch from "@/components/character-pick-search/character-pick-search";
import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import { generateFeatureMetadata } from "@/lib/seo";

export const metadata = generateFeatureMetadata("/character-pick-search");

export default function CharacterPickSearchPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/character-pick-search" />
      <CharacterPickSearch />
    </>
  );
}

import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import DicePageClient from "@/components/diceComponent/dice-page-client";
import { generateFeatureMetadata } from "@/lib/seo";

export const metadata = generateFeatureMetadata("/dice");

export default function Dice() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/dice" />
      <DicePageClient />
    </>
  );
}

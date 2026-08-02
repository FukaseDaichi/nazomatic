import ArticleHeaderComponent from "@/components/common/article-header-component";
import Article from "@/components/common/json-ld-component";
import ShiritoriPageClient from "@/components/shiritori/shiritori-page-client";
import { generateFeatureMetadata } from "@/lib/seo";

export const metadata = generateFeatureMetadata("/shiritori");

export default function Shiritori() {
  return (
    <>
      <ArticleHeaderComponent />
      <Article path="/shiritori" />
      <ShiritoriPageClient />
    </>
  );
}

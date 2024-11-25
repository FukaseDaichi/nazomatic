import { generateJsonLdArticle } from "@/components/common/generateJsonLdArticle";
import features from "@/lib/json/features.json"; // features.jsonをインポート

export default function Article({ index }: { index: number }) {
  // propsをインデックスのみに変更
  const { title, description, path } = features.features[index];
  const jsonLd = generateJsonLdArticle({ title, description, path });

  return (
    <script
      key="json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

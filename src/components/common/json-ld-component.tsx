import { generateJsonLdArticle } from "@/components/common/generateJsonLdArticle";
import { getFeatureByPath, type FeaturePath } from "@/lib/features";

export default function Article({ path }: { path: FeaturePath }) {
  const feature = getFeatureByPath(path);
  const jsonLd = generateJsonLdArticle({
    title: feature.title,
    description: feature.description,
    path: feature.path,
  });

  return (
    <script
      key="json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

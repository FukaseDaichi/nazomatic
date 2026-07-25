import featuresJson from "@/lib/json/features.json";

export type Feature = {
  iconName: string;
  title: string;
  description: string;
  path: string;
};

export const features: Feature[] = featuresJson.features;

/**
 * features.json の path 一覧。
 * JSON import は string に widening されるため、compile time の型 guard として
 * ここに列挙し、下の assertion で JSON との差分を検出する。
 */
export const FEATURE_PATHS = [
  "/shiritori",
  "/dice",
  "/alphabet",
  "/prefectures",
  "/graphpaper",
  "/anagram",
  "/calendar",
  "/constellation",
  "/shift-search",
  "/character-pick-search",
] as const;

export type FeaturePath = (typeof FEATURE_PATHS)[number];

const featureByPath = new Map(features.map((feature) => [feature.path, feature]));

assertFeaturePathsAreInSync();

/**
 * path で feature を取得する。index 依存をなくし、順序変更で別機能の
 * title / URL が JSON-LD に出ることを防ぐ。
 */
export function getFeatureByPath(path: FeaturePath): Feature {
  const feature = featureByPath.get(path);
  if (!feature) {
    throw new Error(
      `Feature not found for path "${path}". Update src/lib/json/features.json or FEATURE_PATHS.`
    );
  }
  return feature;
}

function assertFeaturePathsAreInSync() {
  const jsonPaths = new Set(features.map((feature) => feature.path));

  const missingInJson = FEATURE_PATHS.filter((path) => !jsonPaths.has(path));
  const missingInList = [...jsonPaths].filter(
    (path) => !FEATURE_PATHS.includes(path as FeaturePath)
  );

  if (missingInJson.length > 0 || missingInList.length > 0) {
    throw new Error(
      [
        "FEATURE_PATHS and features.json are out of sync.",
        missingInJson.length > 0
          ? `Missing in features.json: ${missingInJson.join(", ")}`
          : null,
        missingInList.length > 0
          ? `Missing in FEATURE_PATHS: ${missingInList.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
}

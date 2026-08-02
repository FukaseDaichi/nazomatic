import {
  Calendar,
  CaseUpper,
  Combine,
  Dices,
  Frame,
  HelpCircle,
  Link,
  Map,
  RotateCw,
  Search,
  Star,
  type LucideIcon,
} from "lucide-react";

/**
 * features.json の iconName に対応するアイコン。
 * lucide-react を名前空間インポートするとツリーシェイキングが効かないため、
 * 使用するアイコンだけをここに明示的に登録する。
 * features.json にツールを追加したら、このマップにも必ず登録すること。
 */
const featureIcons: Record<string, LucideIcon> = {
  Calendar,
  CaseUpper,
  Combine,
  Dices,
  Frame,
  Link,
  Map,
  RotateCw,
  Search,
  Star,
};

export const FALLBACK_FEATURE_ICON: LucideIcon = HelpCircle;

export function getFeatureIcon(iconName: string): LucideIcon {
  const icon = featureIcons[iconName];
  if (!icon) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[feature-icons] "${iconName}" は未登録です。src/lib/feature-icons.ts に追加してください。`
      );
    }
    return FALLBACK_FEATURE_ICON;
  }
  return icon;
}

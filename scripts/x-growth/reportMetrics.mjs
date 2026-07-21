// 週次レビューの集計ヘルパ。エントリスクリプトが import 時に main() を走らせるため、
// テスト可能な純関数はこの独立モジュールに置く。

export function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function sumEngagement(entry) {
  if (entry.replies == null && entry.reposts == null && entry.likes == null) {
    return null;
  }
  return (entry.replies ?? 0) + (entry.reposts ?? 0) + (entry.likes ?? 0);
}

export function summarizeByDimension(postMetrics, getKey) {
  const groups = {};
  for (const entry of postMetrics) {
    const key = getKey(entry.post);
    if (key == null || key === "") {
      continue;
    }
    (groups[key] ??= []).push(entry);
  }
  return Object.entries(groups)
    .map(([key, items]) => {
      const views = items.map((i) => i.views).filter((v) => v != null);
      const engagements = items
        .map((i) => sumEngagement(i))
        .filter((v) => v != null);
      return {
        key,
        count: items.length,
        medianViews: median(views),
        medianEngagement: median(engagements),
      };
    })
    .sort((a, b) => (b.medianViews ?? -1) - (a.medianViews ?? -1));
}

export function jstHourBucket(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return `${String(Number(hour)).padStart(2, "0")}時台`;
}

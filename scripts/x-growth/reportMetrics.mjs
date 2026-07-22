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

export function matchesMetricFilter(post, filters = {}) {
  const values = {
    postType: post?.postType,
    archetype: post?.metadata?.archetype,
    hasMedia: post?.metadata?.hasMedia,
    shape: post?.metadata?.shape,
    topicKey: post?.metadata?.topicKey,
    jstHourBucket: jstHourBucket(post?.postedAt),
  };
  return Object.entries(filters).every(([key, expected]) => values[key] !== undefined && values[key] !== null && values[key] !== "" && values[key] === expected);
}

export function calculateMetric(entries, metric) {
  const filtered = entries.filter((entry) => matchesMetricFilter(entry, metric.filters));
  const mature = filtered.filter((entry) => entry.metrics?.mature === true);
  const values = mature.map((entry) => {
    if (metric.name === "median_views") return entry.metrics?.views;
    if (metric.name === "median_engagement") return sumEngagement(entry.metrics ?? {});
    if (metric.name === "reply_post_rate") return entry.metrics?.replies != null ? entry.metrics.replies > 0 : null;
    return null;
  }).filter((value) => value !== null && value !== undefined);
  const value = metric.name === "reply_post_rate"
    ? (values.length ? values.filter(Boolean).length / values.length : null)
    : median(values);
  return { value, sampleSize: values.length, filteredCount: filtered.length, matureCount: mature.length };
}

export function telemetryHealth(entries, { now = new Date(), maturityHours = 24 } = {}) {
  const minAge = maturityHours * 60 * 60 * 1000;
  const maxAge = 8 * 24 * 60 * 60 * 1000;
  const eligible = entries.filter((entry) => {
    const age = now.getTime() - new Date(entry.postedAt).getTime();
    return Number.isFinite(age) && age >= minAge && age <= maxAge;
  });
  const mature = eligible.filter((entry) => entry.metrics?.mature === true);
  const missingUrl = eligible.filter((entry) => !entry.postedPostURL).length;
  const expired = entries.filter((entry) => now.getTime() - new Date(entry.postedAt).getTime() > maxAge && entry.metrics?.mature !== true).length;
  return { eligible: eligible.length, mature: mature.length, rate: eligible.length ? mature.length / eligible.length : 0, missingUrl, expired };
}

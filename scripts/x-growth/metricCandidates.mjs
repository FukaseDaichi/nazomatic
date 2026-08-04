import { jstHourBucket, sumEngagement } from "./reportMetrics.mjs";

export const METRIC_NAMES = Object.freeze([
  "median_views",
  "median_engagement",
  "reply_post_rate",
]);

export const METRIC_CANDIDATE_CONSTRAINTS = Object.freeze({
  minimumSampleSize: 5,
  maturityHours: 24,
  windowDays: 14,
  direction: "increase",
});

export const METRIC_DIMENSIONS = Object.freeze([
  Object.freeze({ name: "postType", getValue: (entry) => entry?.postType }),
  Object.freeze({ name: "archetype", getValue: (entry) => entry?.metadata?.archetype }),
  Object.freeze({ name: "hasMedia", getValue: (entry) => entry?.metadata?.hasMedia }),
  Object.freeze({ name: "shape", getValue: (entry) => entry?.metadata?.shape }),
  Object.freeze({ name: "topicKey", getValue: (entry) => entry?.metadata?.topicKey }),
  Object.freeze({ name: "jstHourBucket", getValue: (entry) => jstHourBucket(entry?.postedAt) }),
]);

export function buildMetricCandidateId(name, filters = {}) {
  const entries = Object.entries(filters).sort(([left], [right]) => compareStrings(left, right));
  if (!entries.length) {
    return `${name}|none`;
  }
  return `${name}|${entries
    .map(([key, value]) => `${key}=${encodeURIComponent(JSON.stringify(value))}`)
    .join("&")}`;
}

export function buildMetricCandidates(entries, dimensions = METRIC_DIMENSIONS) {
  const sourceEntries = Array.isArray(entries) ? entries : [];
  const candidates = [];
  for (const name of METRIC_NAMES) {
    const metricCandidates = [];
    const unfilteredSampleSize = metricSampleCount(sourceEntries, name);
    if (unfilteredSampleSize >= METRIC_CANDIDATE_CONSTRAINTS.minimumSampleSize) {
      metricCandidates.push(createMetricCandidate(name, {}, unfilteredSampleSize));
    }

    for (const dimension of dimensions) {
      const groups = new Map();
      for (const entry of sourceEntries) {
        const value = dimension.getValue(entry);
        if (!hasMetricFilterValue(value)) continue;
        const key = JSON.stringify(value);
        const group = groups.get(key) ?? { value, entries: [] };
        group.entries.push(entry);
        groups.set(key, group);
      }
      for (const { value, entries: groupedEntries } of groups.values()) {
        const sampleSize = metricSampleCount(groupedEntries, name);
        if (sampleSize >= METRIC_CANDIDATE_CONSTRAINTS.minimumSampleSize) {
          metricCandidates.push(createMetricCandidate(name, { [dimension.name]: value }, sampleSize));
        }
      }
    }

    metricCandidates.sort(compareMetricCandidates);
    candidates.push(...metricCandidates);
  }
  return candidates;
}

export function formatMetricSampleCounts(entries) {
  const views = metricSampleCount(entries, "median_views");
  const engagement = metricSampleCount(entries, "median_engagement");
  const replies = metricSampleCount(entries, "reply_post_rate");
  return `[m${entries.length}/v${views}/e${engagement}/r${replies}]`;
}

export function metricSampleCount(entries, metricName) {
  if (metricName === "median_views") {
    return entries.filter((entry) => Number.isFinite(entry.metrics?.views)).length;
  }
  if (metricName === "median_engagement") {
    return entries.filter((entry) => sumEngagement(entry.metrics ?? {}) !== null).length;
  }
  if (metricName === "reply_post_rate") {
    return entries.filter((entry) => entry.metrics?.replies != null).length;
  }
  return 0;
}

function createMetricCandidate(name, filters, sampleSize) {
  return {
    candidateId: buildMetricCandidateId(name, filters),
    name,
    filters,
    sampleSize,
    ...METRIC_CANDIDATE_CONSTRAINTS,
  };
}

function compareMetricCandidates(left, right) {
  return right.sampleSize - left.sampleSize || compareStrings(left.candidateId, right.candidateId);
}

function compareStrings(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function hasMetricFilterValue(value) {
  return value !== null && value !== undefined && value !== "";
}

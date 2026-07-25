import {
  validateProposalChange,
  validateProposalTarget,
} from "./experimentAllowlist.mjs";

export function buildProposalOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "hypothesis",
      "path",
      "kind",
      "targetKey",
      "change",
      "metric",
      "rationale",
    ],
    properties: {
      hypothesis: { type: "string", minLength: 8 },
      path: { type: "string" },
      kind: { type: "string", enum: ["json-array", "ts-copy"] },
      targetKey: { type: "string", minLength: 3 },
      change: {
        type: "object",
        additionalProperties: false,
        required: ["find", "replace"],
        properties: {
          find: { type: "string", minLength: 1 },
          replace: { type: "string", minLength: 1 },
        },
      },
      metric: {
        type: "object", additionalProperties: false,
        required: ["name", "filters", "minimumSampleSize", "maturityHours", "windowDays", "direction"],
        properties: {
          name: { type: "string", enum: ["median_views", "median_engagement", "reply_post_rate"] },
          filters: { type: "object" },
          minimumSampleSize: { type: "integer", minimum: 5 },
          maturityHours: { type: "integer", minimum: 24 },
          windowDays: { type: "integer", enum: [7, 14] },
          direction: { type: "string", enum: ["increase"] },
        },
      },
      rationale: { type: "string", minLength: 8 },
    },
  };
}

export function validateProposal(obj) {
  if (!obj || typeof obj !== "object") {
    return { ok: false, reason: "proposal is not an object" };
  }
  const required = [
    "hypothesis",
    "path",
    "kind",
    "targetKey",
    "change",
    "metric",
    "rationale",
  ];
  for (const key of required) {
    if (obj[key] == null) {
      return { ok: false, reason: `missing field: ${key}` };
    }
  }
  const target = validateProposalTarget(obj);
  if (!target.ok) {
    return target;
  }
  const { find, replace } = obj.change ?? {};
  if (typeof find !== "string" || typeof replace !== "string" || !find || !replace) {
    return { ok: false, reason: "change.find/replace must be non-empty strings" };
  }
  if (find === replace) {
    return { ok: false, reason: "change is a no-op" };
  }
  const changeGuard = validateProposalChange(obj);
  if (!changeGuard.ok) {
    return changeGuard;
  }
  const metric = obj.metric;
  const allowedFilters = new Set(["postType", "archetype", "hasMedia", "shape", "topicKey", "jstHourBucket"]);
  if (!metric || !["median_views", "median_engagement", "reply_post_rate"].includes(metric.name) || !metric.filters || typeof metric.filters !== "object") {
    return { ok: false, reason: "metric is invalid" };
  }
  if (Object.keys(metric.filters).some((key) => !allowedFilters.has(key))) {
    return { ok: false, reason: "metric contains an unsupported filter" };
  }
  if (!Number.isInteger(metric.minimumSampleSize) || metric.minimumSampleSize < 5 || !Number.isInteger(metric.maturityHours) || metric.maturityHours < 24 || ![7, 14].includes(metric.windowDays) || metric.direction !== "increase") {
    return { ok: false, reason: "metric constraints are invalid" };
  }
  return { ok: true, proposal: obj };
}

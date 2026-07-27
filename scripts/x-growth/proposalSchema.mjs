import {
  MAX_PROPOSAL_CHANGES,
  validateProposalChange,
  validateProposalTarget,
} from "./experimentAllowlist.mjs";

const FILTER_KEYS = [
  "postType",
  "archetype",
  "hasMedia",
  "shape",
  "topicKey",
  "jstHourBucket",
];

export function buildProposalOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "hypothesis",
      "path",
      "kind",
      "targetKey",
      "changes",
      "metric",
      "rationale",
    ],
    properties: {
      hypothesis: { type: "string", minLength: 8 },
      path: { type: "string" },
      kind: { type: "string", enum: ["json-patch", "ts-patch"] },
      targetKey: { type: "string", minLength: 3 },
      changes: {
        type: "array",
        minItems: 1,
        maxItems: MAX_PROPOSAL_CHANGES,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["find", "replace"],
          properties: {
            find: { type: "string", minLength: 1 },
            replace: { type: "string", minLength: 1 },
          },
        },
      },
      metric: {
        type: "object", additionalProperties: false,
        required: ["name", "filters", "minimumSampleSize", "maturityHours", "windowDays", "direction"],
        properties: {
          name: { type: "string", enum: ["median_views", "median_engagement", "reply_post_rate"] },
          filters: {
            type: "object",
            additionalProperties: false,
            required: FILTER_KEYS,
            properties: {
              postType: { type: ["string", "null"], minLength: 1 },
              archetype: { type: ["string", "null"], minLength: 1 },
              hasMedia: { type: ["boolean", "null"] },
              shape: { type: ["string", "null"], minLength: 1 },
              topicKey: { type: ["string", "null"], minLength: 1 },
              jstHourBucket: { type: ["string", "null"], minLength: 1 },
            },
          },
          minimumSampleSize: { type: "integer", enum: [5] },
          maturityHours: { type: "integer", enum: [24] },
          windowDays: { type: "integer", enum: [14] },
          direction: { type: "string", enum: ["increase"] },
        },
      },
      rationale: { type: "string", minLength: 8 },
    },
  };
}

export function normalizeStructuredProposal(obj) {
  if (!obj || typeof obj !== "object" || !obj.metric || typeof obj.metric !== "object") {
    return obj;
  }
  const filters = obj.metric.filters;
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return obj;
  }
  return {
    ...obj,
    metric: {
      ...obj.metric,
      filters: Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== null),
      ),
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
    "changes",
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
  const changeGuard = validateProposalChange(obj);
  if (!changeGuard.ok) {
    return changeGuard;
  }
  const metric = obj.metric;
  const allowedFilters = new Set(FILTER_KEYS);
  if (!metric || !["median_views", "median_engagement", "reply_post_rate"].includes(metric.name) || !metric.filters || typeof metric.filters !== "object") {
    return { ok: false, reason: "metric is invalid" };
  }
  if (Object.keys(metric.filters).some((key) => !allowedFilters.has(key))) {
    return { ok: false, reason: "metric contains an unsupported filter" };
  }
  if (Object.keys(metric.filters).length > 1) {
    return { ok: false, reason: "metric must use at most one filter" };
  }
  if (metric.minimumSampleSize !== 5 || metric.maturityHours !== 24 || metric.windowDays !== 14 || metric.direction !== "increase") {
    return { ok: false, reason: "metric constraints are invalid" };
  }
  return { ok: true, proposal: obj };
}

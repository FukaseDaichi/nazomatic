import {
  MAX_PROPOSAL_CHANGES,
  validateProposalChange,
  validateProposalTarget,
} from "./experimentAllowlist.mjs";
import {
  METRIC_CANDIDATE_CONSTRAINTS,
  METRIC_NAMES,
} from "./metricCandidates.mjs";

const FILTER_KEYS = [
  "postType",
  "archetype",
  "hasMedia",
  "shape",
  "topicKey",
  "jstHourBucket",
];

export function buildProposalOutputSchema(metricCandidates = []) {
  const candidateIds = [...new Set(
    (Array.isArray(metricCandidates) ? metricCandidates : [])
      .map((candidate) => typeof candidate === "string" ? candidate : candidate?.candidateId)
      .filter((candidateId) => typeof candidateId === "string" && candidateId.length > 0),
  )];
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
        required: ["candidateId"],
        properties: {
          candidateId: { type: "string", enum: candidateIds },
        },
      },
      rationale: { type: "string", minLength: 8 },
    },
  };
}

export function normalizeStructuredProposal(obj) {
  // Structured Outputs now contains only metric.candidateId. Raw metric/filter
  // normalization is intentionally not performed here.
  return obj;
}

export function restoreProposalMetric(obj, metricCandidates) {
  if (!obj || typeof obj !== "object") {
    return { ok: false, reason: "proposal is not an object" };
  }
  const selection = obj.metric;
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
    return { ok: false, reason: "metric candidateId is required" };
  }
  const selectionKeys = Object.keys(selection);
  if (selectionKeys.length !== 1 || selectionKeys[0] !== "candidateId") {
    return { ok: false, reason: "metric selection must contain only candidateId" };
  }
  const candidateId = selection.candidateId;
  if (typeof candidateId !== "string" || candidateId.length === 0) {
    return { ok: false, reason: "metric candidateId is required" };
  }
  const candidate = (Array.isArray(metricCandidates) ? metricCandidates : [])
    .find((item) => item?.candidateId === candidateId);
  if (!candidate) {
    return { ok: false, reason: `unknown metric candidateId: ${candidateId}` };
  }
  const candidateFilterKeys = candidate.filters && typeof candidate.filters === "object" && !Array.isArray(candidate.filters)
    ? Object.keys(candidate.filters)
    : [];
  if (
    !METRIC_NAMES.includes(candidate.name) ||
    !candidate.filters ||
    typeof candidate.filters !== "object" ||
    Array.isArray(candidate.filters) ||
    candidateFilterKeys.length > 1 ||
    candidateFilterKeys.some((key) => !FILTER_KEYS.includes(key) || !hasFilterValue(candidate.filters[key])) ||
    !Number.isInteger(candidate.sampleSize) ||
    candidate.sampleSize < METRIC_CANDIDATE_CONSTRAINTS.minimumSampleSize ||
    candidate.minimumSampleSize !== METRIC_CANDIDATE_CONSTRAINTS.minimumSampleSize ||
    candidate.maturityHours !== METRIC_CANDIDATE_CONSTRAINTS.maturityHours ||
    candidate.windowDays !== METRIC_CANDIDATE_CONSTRAINTS.windowDays ||
    candidate.direction !== METRIC_CANDIDATE_CONSTRAINTS.direction
  ) {
    return { ok: false, reason: "metric candidate is invalid" };
  }
  return {
    ok: true,
    candidate,
    proposal: {
      ...obj,
      metric: {
        name: candidate.name,
        filters: { ...candidate.filters },
        minimumSampleSize: candidate.minimumSampleSize,
        maturityHours: candidate.maturityHours,
        windowDays: candidate.windowDays,
        direction: candidate.direction,
      },
    },
  };
}

function hasFilterValue(value) {
  return value !== null && value !== undefined && value !== "";
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
  if (!metric || !["median_views", "median_engagement", "reply_post_rate"].includes(metric.name) || !metric.filters || typeof metric.filters !== "object" || Array.isArray(metric.filters)) {
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

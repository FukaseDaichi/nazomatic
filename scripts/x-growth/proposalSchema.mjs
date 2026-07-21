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
      "change",
      "metric",
      "evaluateWeek",
      "rationale",
    ],
    properties: {
      hypothesis: { type: "string", minLength: 8 },
      path: { type: "string" },
      kind: { type: "string", enum: ["json-array", "ts-copy", "doc"] },
      change: {
        type: "object",
        additionalProperties: false,
        required: ["find", "replace"],
        properties: {
          find: { type: "string", minLength: 1 },
          replace: { type: "string", minLength: 1 },
        },
      },
      metric: { type: "string", minLength: 3 },
      evaluateWeek: { type: "string", pattern: "^[0-9]{4}-W[0-9]{2}$" },
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
    "change",
    "metric",
    "evaluateWeek",
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
  if (typeof find !== "string" || typeof replace !== "string" || !find) {
    return { ok: false, reason: "change.find/replace must be non-empty strings" };
  }
  if (find === replace) {
    return { ok: false, reason: "change is a no-op" };
  }
  const changeGuard = validateProposalChange(obj);
  if (!changeGuard.ok) {
    return changeGuard;
  }
  if (!/^[0-9]{4}-W[0-9]{2}$/.test(obj.evaluateWeek)) {
    return { ok: false, reason: "evaluateWeek must be ISO week like 2026-W31" };
  }
  return { ok: true, proposal: obj };
}

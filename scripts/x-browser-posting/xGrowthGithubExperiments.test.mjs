import assert from "node:assert/strict";
import test from "node:test";

import { evaluateExperimentPrGate } from "../x-growth-improve.mjs";
import {
  classifyExperiment,
  parseExperimentMarker,
  replaceExperimentMarker,
} from "../x-growth/githubExperiments.mjs";

const metadata = {
  reviewIssue: 52,
  account: "nazomaticapp",
  targetKey: "trend-joke:one-liner-copy",
  plannedEvaluateWeek: "2026-W34",
  metric: {
    name: "median_views",
    filters: { archetype: "one_liner" },
    minimumSampleSize: 5,
    maturityHours: 24,
    windowDays: 14,
    direction: "increase",
  },
  proposalBaseline: {
    value: 16,
    sampleSize: 6,
    filteredCount: 6,
    matureCount: 6,
  },
};

function buildBody(value = metadata) {
  return `PR body\n\n<!-- x-growth-experiment:v1 ${JSON.stringify(value)} -->\n`;
}

function buildPr(overrides = {}) {
  return {
    number: 56,
    url: "https://github.com/FukaseDaichi/nazomatic/pull/56",
    state: "MERGED",
    mergedAt: "2026-08-04T12:07:12Z",
    headRefName: "x-growth/issue-52-2026-w34-trend-joke-post-ts",
    labels: ["x-growth-experiment"],
    metadata,
    ...overrides,
  };
}

test("experiment marker parses nested metric and baseline objects", () => {
  assert.deepEqual(parseExperimentMarker(buildBody()), metadata);
});

test("experiment marker replacement updates nested metadata and preserves the PR body", () => {
  const updated = { ...metadata, plannedEvaluateWeek: "2026-W35" };
  const body = replaceExperimentMarker(buildBody(), updated);

  assert.ok(body?.startsWith("PR body\n\n"));
  assert.deepEqual(parseExperimentMarker(body), updated);
});

test("malformed or duplicate experiment markers fail closed", () => {
  assert.equal(parseExperimentMarker("<!-- x-growth-experiment:v1 {broken} -->"), null);
  assert.equal(parseExperimentMarker("<!-- x-growth-experiment:v1 {} -->"), null);
  assert.equal(parseExperimentMarker(`${buildBody()}${buildBody()}`), null);
  assert.equal(replaceExperimentMarker("no marker", metadata), null);
  assert.equal(replaceExperimentMarker(buildBody(), {}), null);
});

test("experiment lifecycle distinguishes pending activation from active and terminal", () => {
  assert.deepEqual(classifyExperiment(buildPr()), { phase: "pending_activation", blocking: true });
  assert.deepEqual(
    classifyExperiment(buildPr({ labels: ["x-growth-experiment", "x-growth:active"] })),
    { phase: "active", blocking: true },
  );
  assert.deepEqual(
    classifyExperiment(buildPr({ labels: ["x-growth-experiment", "x-growth:keep"] })),
    { phase: "terminal", blocking: false },
  );
  assert.deepEqual(
    classifyExperiment(buildPr({ state: "CLOSED", mergedAt: null })),
    { phase: "closed_unmerged", blocking: false },
  );
  assert.deepEqual(
    classifyExperiment(buildPr({ state: "OPEN", mergedAt: null })),
    { phase: "open_pr", blocking: true },
  );
  assert.deepEqual(
    classifyExperiment(buildPr({ labels: ["x-growth-experiment", "x-growth:needs-attention"] })),
    { phase: "needs_attention", blocking: true },
  );
  assert.deepEqual(
    classifyExperiment(buildPr({ labels: ["x-growth-experiment", "x-growth:revert"] })),
    { phase: "revert_requested", blocking: true },
  );
});

test("PR gate blocks only non-terminal experiments for the same account", () => {
  const pending = evaluateExperimentPrGate([buildPr()], {
    reviewIssue: 60,
    account: "nazomaticapp",
  });
  assert.equal(pending.status, "skipped_active_experiment");
  assert.equal(pending.phase, "pending_activation");
  assert.match(pending.reason, /production activation/);

  assert.equal(evaluateExperimentPrGate([buildPr()], {
    reviewIssue: 60,
    account: "another-account",
  }), null);
  assert.equal(evaluateExperimentPrGate([
    buildPr({ labels: ["x-growth-experiment", "x-growth:reverted"] }),
  ], {
    reviewIssue: 60,
    account: "nazomaticapp",
  }), null);
});

test("PR gate fails closed when experiment metadata is invalid", () => {
  const result = evaluateExperimentPrGate([buildPr({ metadata: null })], {
    reviewIssue: 60,
    account: "nazomaticapp",
  });

  assert.equal(result.status, "rejected");
  assert.match(result.reason, /metadata is missing or invalid/);
});

test("PR gate keeps the same review issue idempotent", () => {
  const result = evaluateExperimentPrGate([buildPr()], {
    reviewIssue: 52,
    account: "@NAZOMATICAPP",
  });

  assert.equal(result.status, "existing_pr");
  assert.equal(result.prUrl, "https://github.com/FukaseDaichi/nazomatic/pull/56");
});

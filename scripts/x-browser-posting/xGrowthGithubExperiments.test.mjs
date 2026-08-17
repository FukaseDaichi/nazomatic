import assert from "node:assert/strict";
import test from "node:test";

import { evaluateExperimentPrGate } from "../x-growth-improve.mjs";
import {
  classifyExperiment,
  editLabels,
  ensurePullRequestLabels,
  findCreatedExperimentPr,
  listExperimentPrs,
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

test("created PR lookup retries direct URL and branch lookup without a label filter", async () => {
  const calls = [];
  const delays = [];
  let viewAttempts = 0;
  const branch = "x-growth/issue-52-2026-w34-trend-joke-post-ts";
  const runCommand = async (_cwd, args) => {
    calls.push(args);
    if (args[0] === "pr" && args[1] === "view") {
      viewAttempts += 1;
      if (viewAttempts === 1) throw new Error("GitHub has not indexed the PR yet");
      return JSON.stringify(buildPr({ labels: [], state: "OPEN", mergedAt: null }));
    }
    if (args[0] === "pr" && args[1] === "list") return "[]";
    throw new Error(`unexpected gh command: ${args.join(" ")}`);
  };

  const found = await findCreatedExperimentPr("/repo", {
    prUrl: "https://github.com/FukaseDaichi/nazomatic/pull/56",
    branch,
    attempts: 2,
    sleep: async (milliseconds) => delays.push(milliseconds),
    runCommand,
  });

  assert.equal(found.number, 56);
  assert.deepEqual(delays, [250]);
  assert.equal(calls.some((args) => args.includes("--label")), false);
  assert.deepEqual(calls[0].slice(0, 3), ["pr", "view", "https://github.com/FukaseDaichi/nazomatic/pull/56"]);
});

test("experiment PR listing keeps valid marker PRs even before their label is visible", async () => {
  const unlabelled = buildPr({ labels: [], body: buildBody(), state: "OPEN", mergedAt: null });
  const malformed = buildPr({ number: 57, labels: [], body: "<!-- x-growth-experiment:v1 {broken} -->" });
  const unrelated = buildPr({ number: 58, labels: [], body: "ordinary PR" });
  const result = await listExperimentPrs("/repo", {
    runCommand: async (_cwd, args) => {
      assert.equal(args.includes("--label"), false);
      return JSON.stringify([unlabelled, malformed, unrelated]);
    },
  });

  assert.deepEqual(result.map((pr) => pr.number), [56, 57]);
  assert.equal(result[0].metadata.targetKey, metadata.targetKey);
  assert.equal(result[1].metadata, null);
});

test("created PR label assignment retries transient failures and confirms the label", async () => {
  const delays = [];
  let editAttempts = 0;
  let viewAttempts = 0;
  const runCommand = async (_cwd, args) => {
    if (args[0] === "issue" && args[1] === "edit") {
      editAttempts += 1;
      if (editAttempts === 1) throw new Error("label API is temporarily unavailable");
      return "";
    }
    if (args[0] === "pr" && args[1] === "view") {
      viewAttempts += 1;
      return JSON.stringify(buildPr({
        labels: viewAttempts >= 2 ? [{ name: "x-growth-experiment" }] : [],
        state: "OPEN",
        mergedAt: null,
      }));
    }
    throw new Error(`unexpected gh command: ${args.join(" ")}`);
  };

  const result = await ensurePullRequestLabels("/repo", buildPr({ labels: [] }), ["x-growth-experiment"], {
    attempts: 3,
    sleep: async (milliseconds) => delays.push(milliseconds),
    runCommand,
  });

  assert.deepEqual(result.labels, ["x-growth-experiment"]);
  assert.equal(editAttempts, 3);
  assert.equal(viewAttempts, 2);
  assert.deepEqual(delays, [250, 500]);
});

test("label editing can atomically transition active to keep", async () => {
  const calls = [];
  await editLabels(
    "/repo",
    56,
    { add: ["x-growth:keep"], remove: ["x-growth:active"] },
    { runCommand: async (_cwd, args) => calls.push(args) },
  );

  assert.deepEqual(calls, [[
    "issue", "edit", "56",
    "--add-label", "x-growth:keep",
    "--remove-label", "x-growth:active",
  ]]);
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

test("PR gate still blocks the same experiment while its label is not visible", () => {
  const result = evaluateExperimentPrGate([buildPr({ labels: [] })], {
    reviewIssue: 52,
    account: "nazomaticapp",
  });

  assert.equal(result.status, "existing_pr");
  assert.equal(result.branch, "x-growth/issue-52-2026-w34-trend-joke-post-ts");
});

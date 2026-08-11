import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProposalOutputSchema,
  normalizeStructuredProposal,
  restoreProposalMetric,
  validateProposal,
} from "../x-growth/proposalSchema.mjs";
import { validateAppliedChange } from "../x-growth/experimentAllowlist.mjs";
import { calculateMetric } from "../x-growth/reportMetrics.mjs";
import {
  buildMetricCandidateId,
  buildMetricCandidates,
} from "../x-growth/metricCandidates.mjs";
import {
  buildLedgerSummary,
  CODEX_PROPOSAL_TIMEOUT_MS,
  formatProposalFailure,
} from "../x-growth-improve.mjs";

function assertStrictObjectSchemas(schema, path = "$") {
  if (!schema || typeof schema !== "object") {
    return;
  }
  if (schema.type === "object") {
    assert.equal(
      schema.additionalProperties,
      false,
      `${path} must reject additional properties`,
    );
    assert.deepEqual(
      [...(schema.required ?? [])].sort(),
      Object.keys(schema.properties ?? {}).sort(),
      `${path} must require every declared property`,
    );
  }
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    assertStrictObjectSchemas(child, `${path}.${key}`);
  }
  if (schema.items) {
    assertStrictObjectSchemas(schema.items, `${path}[]`);
  }
}

test("proposal output schema satisfies strict object requirements", () => {
  assertStrictObjectSchemas(buildProposalOutputSchema([
    { candidateId: "median_views|none" },
  ]));
});

test("Codex proposal timeout is bounded and reported as a proposal failure", () => {
  assert.equal(CODEX_PROPOSAL_TIMEOUT_MS, 1200000);
  assert.equal(
    formatProposalFailure({
      timedOut: true,
      timeoutMs: CODEX_PROPOSAL_TIMEOUT_MS,
      durationMs: 1200008,
      signal: "SIGTERM",
    }),
    "提案生成がタイムアウトしました（timeout=1200000ms duration=1200008ms signal=SIGTERM）。詳細はlocal logを確認してください。",
  );
});

test("structured output selects only a dynamically enumerated candidateId", () => {
  const candidateIds = [
    "median_views|none",
    "reply_post_rate|postType=%22trend_joke%22",
  ];
  const schema = buildProposalOutputSchema(candidateIds);

  assert.deepEqual(Object.keys(schema.properties.metric.properties), ["candidateId"]);
  assert.deepEqual(schema.properties.metric.required, ["candidateId"]);
  assert.equal(schema.properties.metric.additionalProperties, false);
  assert.deepEqual(schema.properties.metric.properties.candidateId.enum, candidateIds);
  assert.equal(normalizeStructuredProposal({ metric: { candidateId: candidateIds[0] } }).metric.candidateId, candidateIds[0]);
});

test("raw metric fields are not normalized into a candidate selection", () => {
  const proposal = { metric: { candidateId: "candidate-a", filters: { postType: "trend_joke" } } };

  assert.deepEqual(normalizeStructuredProposal(proposal), proposal);
  assert.deepEqual(
    restoreProposalMetric(proposal, [{ candidateId: "candidate-a", filters: {} }]),
    { ok: false, reason: "metric selection must contain only candidateId" },
  );
});

function buildCandidateEntries() {
  return Array.from({ length: 6 }, (_, index) => ({
    postType: "trend_joke",
    postedAt: `2026-07-${String(20 + index).padStart(2, "0")}T12:30:00.000Z`,
    metadata: {
      archetype: index < 4 ? "question" : "statement",
      hasMedia: false,
      shape: "text",
      topicKey: "event",
    },
    metrics: {
      mature: true,
      views: 20 + index,
      ...(index < 4 ? { replies: index === 0 ? 1 : 0, likes: 1, reposts: 0 } : {}),
    },
  }));
}

test("metric candidates are deterministic, single-filter, and sample-eligible", () => {
  const entries = buildCandidateEntries();
  const candidates = buildMetricCandidates(entries);

  assert.deepEqual(candidates, buildMetricCandidates(entries));
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((candidate) => Object.keys(candidate.filters).length <= 1));
  assert.ok(candidates.every((candidate) => candidate.sampleSize >= 5));
  assert.ok(candidates.every((candidate) => candidate.minimumSampleSize === 5));
  assert.ok(candidates.every((candidate) => candidate.maturityHours === 24));
  assert.ok(candidates.every((candidate) => candidate.windowDays === 14));
  assert.ok(candidates.every((candidate) => candidate.direction === "increase"));
  assert.ok(candidates.every((candidate) => !(candidate.filters.postType && candidate.filters.archetype)));
  assert.equal(
    candidates.some((candidate) => candidate.name === "median_engagement"),
    false,
  );
  assert.equal(
    buildMetricCandidateId("median_views", { postType: "trend_joke" }),
    "median_views|postType=%22trend_joke%22",
  );
});

test("candidateId restores the existing proposal metric exactly", () => {
  const candidate = buildMetricCandidates(buildCandidateEntries()).find(
    (item) => item.name === "median_views" && item.filters.postType === "trend_joke",
  );
  assert.ok(candidate);

  const restored = restoreProposalMetric(
    {
      hypothesis: "投稿構成を一つの仮説で改善する",
      path: "src/server/x-browser-posting/trend-joke-post.ts",
      kind: "ts-patch",
      targetKey: "trend-joke:candidate-selection",
      changes: [{ find: "old", replace: "new" }],
      metric: { candidateId: candidate.candidateId },
      rationale: "利用可能なcandidateだけで評価するため",
    },
    [candidate],
  );

  assert.equal(restored.ok, true);
  assert.deepEqual(restored.proposal.metric, {
    name: candidate.name,
    filters: { postType: "trend_joke" },
    minimumSampleSize: 5,
    maturityHours: 24,
    windowDays: 14,
    direction: "increase",
  });
  assert.equal(validateProposal(restored.proposal).ok, true);
});

test("unknown candidateId is rejected locally", () => {
  const result = restoreProposalMetric(
    { metric: { candidateId: "median_views|postType=%22not-available%22" } },
    [{ candidateId: "median_views|none", filters: {} }],
  );

  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown metric candidateId/);
});

test("restored metric keeps the baseline sample guard", () => {
  const candidate = {
    candidateId: "median_views|postType=%22trend_joke%22",
    name: "median_views",
    filters: { postType: "trend_joke" },
    sampleSize: 5,
    minimumSampleSize: 5,
    maturityHours: 24,
    windowDays: 14,
    direction: "increase",
  };
  const restored = restoreProposalMetric({ metric: { candidateId: candidate.candidateId } }, [candidate]);
  const baseline = calculateMetric(buildCandidateEntries().slice(0, 4), restored.proposal.metric);

  assert.equal(restored.ok, true);
  assert.equal(baseline.sampleSize, 4);
  assert.equal(baseline.sampleSize < restored.proposal.metric.minimumSampleSize, true);
});

test("ts patch allows bounded strategy changes with TypeScript structure", () => {
  const proposal = {
    hypothesis: "用途を具体化して表示数中央値を改善する",
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-patch",
    targetKey: "trend-joke:tool-intro-strategy",
    changes: [
      {
        find: "function buildCopy(tool) {\n  return `old ${tool.title}`;\n}",
        replace:
          "function buildCopy(tool) {\n  return `困った場面: ${tool.description}\\n${tool.title}`;\n}",
      },
    ],
    metric: {
      name: "median_views",
      filters: { postType: "trend_joke" },
      minimumSampleSize: 5,
      maturityHours: 24,
      windowDays: 14,
      direction: "increase",
    },
    rationale: "成熟投稿が十分にあり用途の具体化を評価できるため",
  };
  const before = [
    'import value from "./value";',
    "",
    "function buildCopy(tool) {",
    "  return `old ${tool.title}`;",
    "}",
    "",
  ].join("\n");
  const after = before.replace(
    proposal.changes[0].find,
    proposal.changes[0].replace,
  );

  assert.equal(validateProposal(proposal).ok, true);
  assert.deepEqual(validateAppliedChange(proposal, before, after), { ok: true });
});

test("ts patch rejects changes to protected safety declarations", () => {
  const proposal = {
    kind: "ts-patch",
  };
  const before = [
    "function validateTrendJokeText(text: string) {",
    "  return text.trim();",
    "}",
    "",
  ].join("\n");
  const after = before.replace("return text.trim();", "return text;");

  assert.match(
    validateAppliedChange(proposal, before, after).reason,
    /protected declaration: function:validateTrendJokeText/,
  );
});

test("ts patch rejects import changes", () => {
  const proposal = { kind: "ts-patch" };
  const before = 'import value from "./value";\n\nconst copy = "old";\n';
  const after = [
    'import value from "./value";',
    'import other from "./other";',
    "",
    'const copy = "old";',
    "",
  ].join("\n");

  assert.match(
    validateAppliedChange(proposal, before, after).reason,
    /must not add, remove, or change imports/,
  );
});

test("ts patch rejects changes to protected validation calls", () => {
  const proposal = { kind: "ts-patch" };
  const before = [
    "function prepare(text: string) {",
    "  const checked = validateTrendJokeText(text);",
    "  return checked;",
    "}",
    "",
  ].join("\n");
  const after = before.replace(
    "const checked = validateTrendJokeText(text);",
    "const checked = text;",
  );

  assert.match(
    validateAppliedChange(proposal, before, after).reason,
    /must not change protected validation, external I\/O, or fingerprint calls/,
  );
});

test("ts patch allows changing an archetype default while keeping its validator", () => {
  const proposal = { kind: "ts-patch" };
  const before = [
    "function normalizeParams(params) {",
    "  return { archetype: normalizeArchetype(params.archetype) };",
    "}",
    "",
  ].join("\n");
  const after = before.replace(
    "normalizeArchetype(params.archetype)",
    'normalizeArchetype(params.archetype ?? "question")',
  );

  assert.deepEqual(validateAppliedChange(proposal, before, after), { ok: true });
});

test("ts patch rejects changes to bounded normalization arguments", () => {
  const proposal = { kind: "ts-patch" };
  const before = [
    "function normalizeParams(params) {",
    "  return normalizeBoundedInteger({ value: params.max, max: 5 });",
    "}",
    "",
  ].join("\n");
  const after = before.replace("max: 5", "max: 50");

  assert.match(
    validateAppliedChange(proposal, before, after).reason,
    /must not change protected validation, external I\/O, or fingerprint calls/,
  );
});

test("ts patch rejects newly introduced external I/O", () => {
  const proposal = {
    hypothesis: "外部情報を加えて表示数中央値を改善する",
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-patch",
    targetKey: "trend-joke:external-data",
    changes: [
      {
        find: "return oldValue;",
        replace: 'return fetch("https://example.com");',
      },
    ],
    metric: {
      name: "median_views",
      filters: {},
      minimumSampleSize: 5,
      maturityHours: 24,
      windowDays: 7,
      direction: "increase",
    },
    rationale: "外部情報を使う仮説だが安全境界で拒否されるべき",
  };

  assert.match(validateProposal(proposal).reason, /forbidden external I\/O/);
});

test("metric validation keeps sample threshold deterministic and one-dimensional", () => {
  const base = {
    hypothesis: "投稿構成を一つの仮説で改善する",
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-patch",
    targetKey: "trend-joke:metric-guard",
    changes: [{ find: "old", replace: "new" }],
    metric: {
      name: "median_views",
      filters: { postType: "trend_joke" },
      minimumSampleSize: 5,
      maturityHours: 24,
      windowDays: 14,
      direction: "increase",
    },
    rationale: "利用可能なsampleだけで評価するため",
  };

  assert.equal(validateProposal(base).ok, true);
  assert.match(
    validateProposal({
      ...base,
      metric: { ...base.metric, minimumSampleSize: 6 },
    }).reason,
    /metric constraints are invalid/,
  );
  assert.match(
    validateProposal({
      ...base,
      metric: { ...base.metric, maturityHours: 48 },
    }).reason,
    /metric constraints are invalid/,
  );
  assert.match(
    validateProposal({
      ...base,
      metric: { ...base.metric, windowDays: 7 },
    }).reason,
    /metric constraints are invalid/,
  );
  assert.match(
    validateProposal({
      ...base,
      metric: {
        ...base.metric,
        filters: { postType: "trend_joke", archetype: "question" },
      },
    }).reason,
    /at most one filter/,
  );
});

test("json patch must preserve the comment candidate array length", () => {
  const proposal = { kind: "json-patch" };

  assert.match(
    validateAppliedChange(proposal, '["a"]', '["a", "b"]').reason,
    /must not change the array length/,
  );
});

test("ledger summary gives Codex mature sample counts for allowed filters", () => {
  const posts = [
    {
      postType: "trend_joke",
      postedAt: "2026-07-26T12:30:00.000Z",
      metadata: {
        archetype: "question",
        hasMedia: false,
        shape: "text",
        topicKey: "event",
      },
      metrics: { mature: true, views: 20, replies: 0, reposts: 0, likes: 1 },
    },
    {
      postType: "trend_joke",
      postedAt: "2026-07-26T12:45:00.000Z",
      metadata: {
        archetype: "question",
        hasMedia: false,
        shape: "text",
        topicKey: "event",
      },
      metrics: { mature: true, views: null, replies: 1, reposts: 0, likes: 0 },
    },
    {
      postType: "normal",
      postedAt: "2026-07-27T00:30:00.000Z",
      metadata: { hasMedia: true },
      metrics: { mature: false },
    },
  ];

  const summary = buildLedgerSummary(posts);

  assert.match(summary, /直近14日: 3件 \/ metrics成熟: 2件/);
  assert.match(summary, /filterなし=\[m2\/v1\/e2\/r2\]/);
  assert.match(summary, /postType=trend_joke\[m2\/v1\/e2\/r2\]/);
  assert.match(summary, /archetype=question\[m2\/v1\/e2\/r2\]/);
  assert.match(summary, /hasMedia=false\[m2\/v1\/e2\/r2\]/);
  assert.match(summary, /jstHourBucket=21時台\[m2\/v1\/e2\/r2\]/);
  assert.doesNotMatch(summary, /normal\[m1/);
  assert.match(
    summary,
    /利用可能metric candidate JSON（Node生成、sampleSize 5以上）: \[\]/,
  );
});

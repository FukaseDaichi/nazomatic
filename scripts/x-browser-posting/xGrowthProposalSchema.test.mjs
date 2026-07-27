import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProposalOutputSchema,
  normalizeStructuredProposal,
  validateProposal,
} from "../x-growth/proposalSchema.mjs";
import { validateAppliedChange } from "../x-growth/experimentAllowlist.mjs";
import { buildLedgerSummary } from "../x-growth-improve.mjs";

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
  assertStrictObjectSchemas(buildProposalOutputSchema());
});

test("structured proposal normalization removes only unused null filters", () => {
  const proposal = {
    hypothesis: "画像付き投稿の表示数中央値を改善する",
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-patch",
    targetKey: "trend-joke:tool-intro-copy",
    changes: [
      {
        find: "old copy",
        replace: "new copy",
      },
    ],
    metric: {
      name: "median_views",
      filters: {
        postType: "trend_joke",
        archetype: null,
        hasMedia: null,
        shape: null,
        topicKey: null,
        jstHourBucket: null,
      },
      minimumSampleSize: 5,
      maturityHours: 24,
      windowDays: 14,
      direction: "increase",
    },
    rationale: "直近レビューで画像付き投稿の表示数が高かったため",
  };

  const normalized = normalizeStructuredProposal(proposal);

  assert.deepEqual(normalized.metric.filters, {
    postType: "trend_joke",
  });
  assert.deepEqual(proposal.metric.filters, {
    postType: "trend_joke",
    archetype: null,
    hasMedia: null,
    shape: null,
    topicKey: null,
    jstHourBucket: null,
  });
  assert.equal(validateProposal(normalized).ok, true);
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
    /選択可能metric filter JSON（sampleSize 5以上）: {"median_views":\[\],"median_engagement":\[\],"reply_post_rate":\[\]}/,
  );
});

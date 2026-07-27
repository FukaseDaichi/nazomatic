import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProposalOutputSchema,
  normalizeStructuredProposal,
  validateProposal,
} from "../x-growth/proposalSchema.mjs";
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
}

test("proposal output schema satisfies strict object requirements", () => {
  assertStrictObjectSchemas(buildProposalOutputSchema());
});

test("structured proposal normalization removes only unused null filters", () => {
  const proposal = {
    hypothesis: "画像付き投稿の表示数中央値を改善する",
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-copy",
    targetKey: "trend-joke:tool-intro-copy",
    change: {
      find: "old copy",
      replace: "new copy",
    },
    metric: {
      name: "median_views",
      filters: {
        postType: "trend_joke",
        archetype: "tool_intro",
        hasMedia: true,
        shape: null,
        topicKey: null,
        jstHourBucket: null,
      },
      minimumSampleSize: 5,
      maturityHours: 24,
      windowDays: 7,
      direction: "increase",
    },
    rationale: "直近レビューで画像付き投稿の表示数が高かったため",
  };

  const normalized = normalizeStructuredProposal(proposal);

  assert.deepEqual(normalized.metric.filters, {
    postType: "trend_joke",
    archetype: "tool_intro",
    hasMedia: true,
  });
  assert.deepEqual(proposal.metric.filters, {
    postType: "trend_joke",
    archetype: "tool_intro",
    hasMedia: true,
    shape: null,
    topicKey: null,
    jstHourBucket: null,
  });
  assert.equal(validateProposal(normalized).ok, true);
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
      metrics: { mature: true },
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
      metrics: { mature: true },
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
  assert.match(summary, /postType=trend_joke:2/);
  assert.match(summary, /archetype=question:2/);
  assert.match(summary, /hasMedia=false:2/);
  assert.match(summary, /jstHourBucket=21時台:2/);
  assert.doesNotMatch(summary, /normal:1/);
});

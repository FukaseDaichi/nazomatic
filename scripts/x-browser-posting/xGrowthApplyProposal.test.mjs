import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyChangeToFile } from "../x-growth/applyProposal.mjs";

function buildProposal(changes) {
  return {
    hypothesis: "投稿構成を一つの仮説で改善する",
    path: "src/server/x-browser-posting/trend-joke-post.ts",
    kind: "ts-patch",
    targetKey: "trend-joke:multi-step-copy",
    changes,
    metric: {
      name: "median_views",
      filters: { postType: "trend_joke" },
      minimumSampleSize: 5,
      maturityHours: 24,
      windowDays: 14,
      direction: "increase",
    },
    rationale: "成熟済み投稿を基準に一つの構成変更を評価するため",
  };
}

test("applies multiple exact replacements sequentially in one file", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-apply-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(
    root,
    "src/server/x-browser-posting/trend-joke-post.ts",
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(
    target,
    [
      "function buildCopy(tool) {",
      "  const lead = `old ${tool.title}`;",
      "  return lead;",
      "}",
      "",
    ].join("\n"),
  );
  const proposal = buildProposal([
    {
      find: "const lead = `old ${tool.title}`;",
      replace: "const lead = `用途: ${tool.description}`;",
    },
    {
      find: "return lead;",
      replace: "return `${lead}\\n${tool.title}`;",
    },
  ]);

  const result = await applyChangeToFile(root, proposal);

  assert.equal(result.ok, true);
  assert.match(result.after, /用途: \$\{tool\.description\}/);
  assert.match(result.after, /return `\$\{lead\}\\n\$\{tool\.title\}`;/);
});

test("rejects a patch when a later find is not unique", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-apply-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(
    root,
    "src/server/x-browser-posting/trend-joke-post.ts",
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "const first = 1;\nconst second = 1;\n");
  const proposal = buildProposal([
    { find: "const first = 1;", replace: "const first = 2;" },
    { find: "const", replace: "let" },
  ]);

  const result = await applyChangeToFile(root, proposal);

  assert.equal(result.ok, false);
  assert.match(result.reason, /changes\[1\]\.find must match exactly once/);
  assert.equal(
    await fs.readFile(target, "utf8"),
    "const first = 1;\nconst second = 1;\n",
  );
});

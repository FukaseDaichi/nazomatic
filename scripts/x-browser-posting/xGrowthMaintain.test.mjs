import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_KEEP_DELAY_MS,
  evaluateAutoKeepSchedule,
  prepareGrowthMaintenancePage,
  reconcileExperimentActivation,
} from "../x-growth-maintain.mjs";

test("growth maintenance opens X before checking blocking state and account", async () => {
  const calls = [];
  const page = {
    async goto(url) {
      calls.push(["goto", url]);
    },
    async assertNoBlockingState() {
      calls.push(["assertNoBlockingState"]);
    },
    async verifyLoggedInAccount(accountHandle) {
      calls.push(["verifyLoggedInAccount", accountHandle]);
      return accountHandle;
    },
  };

  const result = await prepareGrowthMaintenancePage({
    accountHandle: "nazomaticapp",
    page,
  });

  assert.equal(result, "nazomaticapp");
  assert.deepEqual(calls, [
    ["goto", "https://x.com/nazomaticapp"],
    ["assertNoBlockingState"],
    ["verifyLoggedInAccount", "nazomaticapp"],
  ]);
});

test("active experiments become due exactly 72 hours after production activation", () => {
  const activeAt = "2026-08-17T00:00:00.000Z";

  assert.equal(AUTO_KEEP_DELAY_MS, 72 * 60 * 60 * 1000);
  assert.deepEqual(
    evaluateAutoKeepSchedule(
      { activeAt, autoKeepAt: "2026-08-20T00:00:00.000Z" },
      new Date("2026-08-19T23:59:59.999Z"),
    ),
    {
      status: "pending",
      activeAt,
      autoKeepAt: "2026-08-20T00:00:00.000Z",
      metadataChanged: false,
      migrated: false,
    },
  );
  assert.equal(
    evaluateAutoKeepSchedule(
      { activeAt, autoKeepAt: "2026-08-20T00:00:00.000Z" },
      new Date("2026-08-20T00:00:00.000Z"),
    ).status,
    "due",
  );
});

test("legacy active experiments receive a fresh 72-hour safety window", () => {
  assert.deepEqual(
    evaluateAutoKeepSchedule({}, new Date("2026-08-17T04:30:00.000Z")),
    {
      status: "pending",
      activeAt: "2026-08-17T04:30:00.000Z",
      autoKeepAt: "2026-08-20T04:30:00.000Z",
      metadataChanged: true,
      migrated: true,
    },
  );
});

test("auto keep schedule rejects an invalid stored activation time", () => {
  assert.deepEqual(
    evaluateAutoKeepSchedule(
      { activeAt: "not-a-date" },
      new Date("2026-08-20T04:30:00.000Z"),
    ),
    { status: "invalid", reason: "activeAt is invalid" },
  );
});

function buildActivePr(labels = ["x-growth-experiment", "x-growth:active"]) {
  return {
    number: 56,
    state: "MERGED",
    mergedAt: "2026-08-16T00:00:00.000Z",
    labels,
    metadata: {
      reviewIssue: 52,
      account: "nazomaticapp",
      targetKey: "trend-joke:one-liner-copy",
      activeAt: "2026-08-17T00:00:00.000Z",
      autoKeepAt: "2026-08-20T00:00:00.000Z",
    },
  };
}

test("due active experiments transition to keep after a final label refresh", async () => {
  const pr = buildActivePr();
  const labelEdits = [];
  const comments = [];
  const result = await reconcileExperimentActivation({
    cwd: "/repo",
    telemetry: { eligible: 0, mature: 0, rate: 0 },
    now: new Date("2026-08-20T04:30:00.000Z"),
    operations: {
      runGit: async () => {},
      listExperimentPrs: async () => [pr],
      getExperimentPr: async () => pr,
      editLabels: async (_cwd, number, change) => labelEdits.push({ number, change }),
      comment: async (_cwd, number, body) => comments.push({ number, body }),
    },
  });

  assert.deepEqual(result, [{
    pr: 56,
    status: "auto_kept",
    keptAt: "2026-08-20T04:30:00.000Z",
  }]);
  assert.deepEqual(labelEdits, [{
    number: 56,
    change: { add: ["x-growth:keep"], remove: ["x-growth:active"] },
  }]);
  assert.match(comments[0].body, /72時間/);
});

test("a revert added before the final refresh prevents auto keep", async () => {
  const listed = buildActivePr();
  const refreshed = buildActivePr([
    "x-growth-experiment",
    "x-growth:active",
    "x-growth:revert",
  ]);
  let editCount = 0;
  const result = await reconcileExperimentActivation({
    cwd: "/repo",
    telemetry: { eligible: 0, mature: 0, rate: 0 },
    now: new Date("2026-08-20T04:30:00.000Z"),
    operations: {
      runGit: async () => {},
      listExperimentPrs: async () => [listed],
      getExperimentPr: async () => refreshed,
      editLabels: async () => { editCount += 1; },
    },
  });

  assert.deepEqual(result, [{
    pr: 56,
    status: "auto_keep_skipped",
    phase: "revert_requested",
  }]);
  assert.equal(editCount, 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import { prepareGrowthMaintenancePage } from "../x-growth-maintain.mjs";

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

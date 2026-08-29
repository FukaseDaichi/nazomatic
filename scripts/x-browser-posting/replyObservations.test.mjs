import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  collectReplyObservations,
  getReplyObservationPath,
  writeReplyObservationSnapshot,
} from "./replyObservations.mjs";

test("reply observation prioritizes posts with known replies and excludes answered replies", async () => {
  const visited = [];
  const page = {
    async readConversationReplies(postUrl) {
      visited.push(postUrl);
      return postUrl.endsWith("/2")
        ? [
            {
              authorHandle: "@ALICE",
              textExcerpt: `  返事です  ${"長".repeat(170)} `,
              replyURL: "https://x.com/alice/status/20?ref_src=test",
            },
            {
              authorHandle: "bob",
              textExcerpt: "確認済み",
              replyURL: "https://x.com/bob/status/21",
            },
          ]
        : [];
    },
    async hasOwnReplyToPost(replyUrl) {
      return replyUrl.includes("/21");
    },
  };
  const snapshot = await collectReplyObservations({
    page,
    accountHandle: "@NazomaticApp",
    now: new Date("2026-08-29T00:00:00.000Z"),
    maxPosts: 1,
    posts: [
      {
        postedAt: "2026-08-29T00:00:00.000Z",
        postedPostURL: "https://x.com/nazomaticapp/status/1",
        metrics: { replies: 0 },
      },
      {
        postedAt: "2026-08-28T00:00:00.000Z",
        postedPostURL: "https://x.com/nazomaticapp/status/2",
        metrics: { replies: 2 },
      },
    ],
  });

  assert.deepEqual(visited, ["https://x.com/nazomaticapp/status/2"]);
  assert.equal(snapshot.accountHandle, "nazomaticapp");
  assert.equal(snapshot.postsChecked, 1);
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0].authorHandle, "alice");
  assert.equal(snapshot.candidates[0].replyURL, "https://x.com/alice/status/20");
  assert.ok(snapshot.candidates[0].textExcerpt.endsWith("…"));
  assert.equal(snapshot.candidates[0].textExcerpt.length, 160);
});

test("reply observation snapshot is written under ignored local state", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "nazomatic-replies-"));
  const snapshot = {
    version: 1,
    accountHandle: "nazomaticapp",
    capturedAt: "2026-08-29T00:00:00.000Z",
    postsChecked: 0,
    candidates: [],
  };
  try {
    const filePath = await writeReplyObservationSnapshot(cwd, snapshot);
    assert.equal(filePath, getReplyObservationPath(cwd));
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), snapshot);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("reply observation reports only posts actually opened before the candidate cap", async () => {
  const visited = [];
  const page = {
    async readConversationReplies(postUrl) {
      visited.push(postUrl);
      return [
        {
          authorHandle: "alice",
          textExcerpt: "候補",
          replyURL: "https://x.com/alice/status/20",
        },
      ];
    },
    async hasOwnReplyToPost() {
      return false;
    },
  };
  const snapshot = await collectReplyObservations({
    page,
    accountHandle: "nazomaticapp",
    maxPosts: 2,
    maxCandidates: 1,
    posts: [
      {
        postedAt: "2026-08-29T00:00:00.000Z",
        postedPostURL: "https://x.com/nazomaticapp/status/1",
      },
      {
        postedAt: "2026-08-28T00:00:00.000Z",
        postedPostURL: "https://x.com/nazomaticapp/status/2",
      },
    ],
  });

  assert.equal(snapshot.postsChecked, 1);
  assert.equal(visited.length, 1);
});

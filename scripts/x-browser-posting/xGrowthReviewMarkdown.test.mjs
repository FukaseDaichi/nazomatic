import assert from "node:assert/strict";
import test from "node:test";

import { buildReviewMarkdown } from "../x-growth-improve.mjs";
import { buildReport } from "../x-weekly-growth-review.mjs";

function buildReview(comments) {
  return {
    number: 45,
    author: "FukaseDaichi",
    createdAt: "2026-07-27T02:43:57Z",
    body: "# X 週次改善レビュー（2026-W31）\n\n- フォロワー: 22",
    comments,
  };
}

test("review markdown falls back to the issue body when there are no comments", () => {
  const review = buildReview([]);

  assert.equal(buildReviewMarkdown(review), review.body);
  assert.equal(buildReviewMarkdown({ ...review, comments: undefined }), review.body);
});

test("review markdown appends comments chronologically with attribution", () => {
  const markdown = buildReviewMarkdown(
    buildReview([
      {
        author: "FukaseDaichi",
        createdAt: "2026-07-28T11:55:54Z",
        body: "## 再レビュー\n\n- フォロワー: 25",
      },
      {
        author: "github-actions",
        createdAt: "2026-07-27T09:00:00Z",
        body: "## 改善PRを見送り\n\n`rejected`\n\n<!-- x-growth-activation-blocked:v1 {\"pr\":45} -->",
      },
      {
        author: "github-actions",
        createdAt: "2026-07-29T00:00:00Z",
        body: "<!-- x-growth-evaluation:v1 {\"pr\":45} -->",
      },
    ]),
  );

  // marker だけのコメントは落ち、残り2件が古い順に並ぶ。
  assert.match(markdown, /### Issue本文（@FukaseDaichi \/ 2026-07-27T02:43:57Z）/);
  assert.match(markdown, /### コメント1\/2（@github-actions \/ 2026-07-27T09:00:00Z）/);
  assert.match(markdown, /### コメント2\/2（@FukaseDaichi \/ 2026-07-28T11:55:54Z）/);
  assert.ok(
    markdown.indexOf("コメント1/2") < markdown.indexOf("コメント2/2"),
    "comments must stay in chronological order",
  );
  assert.ok(!markdown.includes("x-growth-activation-blocked"), "markers must be stripped");
  assert.ok(!markdown.includes("x-growth-evaluation"), "marker-only comments must be dropped");
  assert.ok(!markdown.includes("注記"), "no truncation note when everything fits");
});

test("review markdown keeps the newest comments and notes dropped ones over the cap", () => {
  const maxChars = 1200;
  const markdown = buildReviewMarkdown(
    buildReview([
      { author: "old", createdAt: "2026-07-27T09:00:00Z", body: `OLDEST_MARK${"あ".repeat(600)}` },
      { author: "mid", createdAt: "2026-07-28T09:00:00Z", body: `MIDDLE_MARK${"い".repeat(600)}` },
      { author: "new", createdAt: "2026-07-29T09:00:00Z", body: `NEWEST_MARK${"う".repeat(600)}` },
    ]),
    { maxChars },
  );

  assert.ok(markdown.length <= maxChars, `expected <= ${maxChars}, got ${markdown.length}`);
  assert.match(markdown, /### コメント3\/3（@new/);
  assert.ok(markdown.includes("NEWEST_MARK"), "the newest comment must survive truncation");
  assert.ok(!markdown.includes("OLDEST_MARK"), "the oldest comment must be dropped first");
  assert.match(markdown, /> 注記: コメント全3件のうち古い2件は入力上限（1200文字）のため省略しました。/);
  assert.match(markdown, /Issue本文/);
});

test("weekly review omits the experiment outcome report", () => {
  const report = buildReport({
    accountHandle: "nazomaticapp",
    now: new Date("2026-08-17T02:30:00.000Z"),
    since: new Date("2026-08-10T02:30:00.000Z"),
    week: { key: "2026-W34" },
    recentPosts: [],
    profileStats: { followers: null, posts: null, error: null },
    previousSnapshot: null,
    postMetrics: [],
    logStats: { success: 0, failed: 0, noCandidate: 0, files: 0 },
  });

  assert.ok(!report.body.includes("## 実験の勝敗"));
  assert.ok(!report.body.includes("x-growth:keep"));
});

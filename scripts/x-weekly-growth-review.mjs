#!/usr/bin/env node

import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

import { readBrowserPostLedger } from "./x-browser-posting/postLedger.mjs";

const REVIEW_DAYS = 7;
const SNAPSHOT_PATH = "local/x-browser-posting/follower-snapshots.json";
const AUTOMATION_LOG_IDS = [
  "x-browser-post",
  "x-browser-post-trend-joke",
  "x-browser-post-weekend-summary",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const env = readMergedEnv(cwd, args.envFile);
  const accountHandle = normalizeHandle(
    args.accountHandle ?? env.X_BROWSER_POST_ACCOUNT_HANDLE
  );
  if (!accountHandle) {
    throw new Error("X_BROWSER_POST_ACCOUNT_HANDLE is required");
  }

  const now = new Date();
  const since = new Date(now.getTime() - REVIEW_DAYS * 24 * 60 * 60 * 1000);
  const ledger = await readBrowserPostLedger({ cwd });
  const recentPosts = ledger.entries.filter(
    (entry) =>
      normalizeHandle(entry.accountHandle) === accountHandle &&
      new Date(entry.postedAt).getTime() >= since.getTime()
  );
  const browserMetrics = await collectMetricsFromLoggedInChrome({
    accountHandle,
    posts: recentPosts,
    cdpUrl:
      env.X_BROWSER_POST_CDP_URL ??
      `http://127.0.0.1:${env.X_BROWSER_POST_REMOTE_DEBUGGING_PORT ?? "9222"}`,
  });
  const publicProfileStats = await fetchXProfileStats(accountHandle);
  const profileStats = {
    followers:
      browserMetrics.profileStats?.followers ?? publicProfileStats.followers,
    posts: browserMetrics.profileStats?.posts ?? publicProfileStats.posts,
    error:
      browserMetrics.profileStats?.followers != null ||
      publicProfileStats.followers != null
        ? null
        : publicProfileStats.error ?? "profile metrics could not be parsed",
  };
  const snapshots = await readSnapshots(cwd);
  const previousSnapshot = findPreviousSnapshot(snapshots, now);
  const postMetrics =
    browserMetrics.postMetrics.length > 0
      ? browserMetrics.postMetrics
      : await collectPostMetrics(recentPosts);
  const logStats = await collectAutomationLogStats(cwd, since);
  const week = getJstIsoWeek(now);
  const report = buildReport({
    accountHandle,
    now,
    since,
    week,
    recentPosts,
    profileStats,
    previousSnapshot,
    postMetrics,
    logStats,
  });

  await writeSnapshot(cwd, snapshots, {
    capturedAt: now.toISOString(),
    weekKey: week.key,
    accountHandle,
    followers: profileStats.followers,
    posts: profileStats.posts,
  });

  console.log(report.body);
  if (args.createIssue) {
    const issueUrl = await createOrUpdateGitHubIssue({
      cwd,
      title: report.title,
      body: report.body,
    });
    console.log(`\nGitHub Issue: ${issueUrl}`);
  }
}

async function collectMetricsFromLoggedInChrome({ accountHandle, posts, cdpUrl }) {
  let page = null;
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 5000 });
    const context = browser.contexts()[0];
    if (!context) return { profileStats: null, postMetrics: [] };
    page = await context.newPage();
    await page.goto(`https://x.com/${accountHandle}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2500);
    const profileText = await page.locator("body").innerText().catch(() => "");
    const profileStats = {
      followers: findLocalizedMetric(profileText, ["フォロワー", "Followers"]),
      posts: findLocalizedMetric(profileText, ["件のポスト", "posts", "Posts"]),
      error: null,
    };

    const postMetrics = [];
    for (const post of posts.filter((entry) => entry.postedPostURL).slice(0, 30)) {
      await page.goto(post.postedPostURL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(1500);
      const article = page.locator("article").first();
      postMetrics.push({
        post,
        replies: await readActionMetric(article, "reply"),
        reposts: await readActionMetric(article, "retweet"),
        likes: await readActionMetric(article, "like"),
        views: await readViewsMetric(article),
      });
    }
    return { profileStats, postMetrics };
  } catch {
    return { profileStats: null, postMetrics: [] };
  } finally {
    await page?.close().catch(() => {});
  }
}

async function readActionMetric(article, testId) {
  const element = article.locator(`[data-testid="${testId}"]`).first();
  if ((await element.count()) === 0) return null;
  const label = await element.getAttribute("aria-label").catch(() => "");
  const text = await element.innerText().catch(() => "");
  return parseCompactNumber(`${label} ${text}`) ?? 0;
}

async function readViewsMetric(article) {
  const link = article.locator('a[href$="/analytics"]').first();
  const label = await link.getAttribute("aria-label").catch(() => "");
  const text = await link.innerText().catch(() => "");
  return parseCompactNumber(`${label} ${text}`);
}

function findLocalizedMetric(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const before = new RegExp(`([0-9][0-9,.]*[万千KkMm]?)\\s*${escaped}`, "i").exec(
      text
    );
    if (before) return parseCompactNumber(before[1]);
    const after = new RegExp(`${escaped}\\s*([0-9][0-9,.]*[万千KkMm]?)`, "i").exec(
      text
    );
    if (after) return parseCompactNumber(after[1]);
  }
  return null;
}

function parseCompactNumber(value) {
  const match = /([0-9][0-9,.]*)([万千KkMm]?)/.exec(String(value ?? ""));
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ""));
  const multiplier =
    match[2] === "万"
      ? 10000
      : match[2] === "千" || /k/i.test(match[2])
        ? 1000
        : /m/i.test(match[2])
          ? 1000000
          : 1;
  return Math.round(base * multiplier);
}

function parseArgs(argv) {
  const args = {
    createIssue: false,
    accountHandle: null,
    envFile: ".env.x-browser-posting.local",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--create-issue") {
      args.createIssue = true;
    } else if (arg === "--account-handle" || arg === "--env-file") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      args[arg === "--account-handle" ? "accountHandle" : "envFile"] = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  npm run x:growth-review -- [--create-issue]

Options:
  --create-issue             Create this week's GitHub Issue, or comment on it if it already exists.
  --account-handle <handle>  Override X_BROWSER_POST_ACCOUNT_HANDLE.
  --env-file <path>          Defaults to .env.x-browser-posting.local.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function fetchXProfileStats(accountHandle) {
  try {
    const response = await fetch(`https://x.com/${accountHandle}`, {
      headers: { "User-Agent": "Mozilla/5.0 NAZOMATIC weekly review" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return { followers: null, posts: null, error: `HTTP ${response.status}` };
    }
    const html = await response.text();
    return {
      followers: findFirstNumber(html, [
        /"followers_count"\s*:\s*(\d+)/,
        /"followersCount"\s*:\s*(\d+)/,
      ]),
      posts: findFirstNumber(html, [
        /"statuses_count"\s*:\s*(\d+)/,
        /"statusesCount"\s*:\s*(\d+)/,
      ]),
      error: null,
    };
  } catch (error) {
    return {
      followers: null,
      posts: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectPostMetrics(posts) {
  const results = [];
  for (const post of posts.filter((entry) => entry.postedPostURL).slice(0, 30)) {
    results.push(await fetchPostMetrics(post));
  }
  return results;
}

async function fetchPostMetrics(post) {
  try {
    const response = await fetch(post.postedPostURL, {
      headers: { "User-Agent": "Mozilla/5.0 NAZOMATIC weekly review" },
      signal: AbortSignal.timeout(12000),
    });
    const html = response.ok ? await response.text() : "";
    return {
      post,
      views: findFirstNumber(html, [
        /"views"\s*:\s*\{[^}]*"count"\s*:\s*"?(\d+)/,
        /"name"\s*:\s*"Views"[^}]*"userInteractionCount"\s*:\s*(\d+)/,
      ]),
      replies: findFirstNumber(html, [/"reply_count"\s*:\s*(\d+)/]),
      reposts: findFirstNumber(html, [/"retweet_count"\s*:\s*(\d+)/]),
      likes: findFirstNumber(html, [/"favorite_count"\s*:\s*(\d+)/]),
    };
  } catch {
    return { post, views: null, replies: null, reposts: null, likes: null };
  }
}

async function collectAutomationLogStats(cwd, since) {
  const result = { success: 0, failed: 0, noCandidate: 0, files: 0 };
  for (const automationId of AUTOMATION_LOG_IDS) {
    const dir = path.join(cwd, "logs", automationId);
    const names = await fs.readdir(dir).catch(() => []);
    for (const name of names.filter((entry) => entry.endsWith(".log"))) {
      const filePath = path.join(dir, name);
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats || stats.mtime < since) {
        continue;
      }
      const content = await fs.readFile(filePath, "utf8").catch(() => "");
      result.files += 1;
      if (/exit_status=0/.test(content)) result.success += 1;
      if (/exit_status=1/.test(content)) result.failed += 1;
      if (/No browser post candidate found/.test(content)) result.noCandidate += 1;
    }
  }
  return result;
}

function buildReport({
  accountHandle,
  now,
  since,
  week,
  recentPosts,
  profileStats,
  previousSnapshot,
  postMetrics,
  logStats,
}) {
  const counts = countBy(recentPosts, (entry) => entry.postType ?? "unknown");
  const trendPosts = recentPosts.filter((entry) => entry.postType === "trend_joke");
  const archetypes = countBy(
    trendPosts,
    (entry) => entry.metadata?.archetype ?? "未記録"
  );
  const motifs = countMany(trendPosts, (entry) => entry.metadata?.motifs ?? []);
  const capturedMetrics = postMetrics.filter((entry) => entry.views !== null);
  const capturedEngagementMetrics = postMetrics.filter(
    (entry) =>
      entry.replies !== null || entry.reposts !== null || entry.likes !== null
  );
  const totalEngagement = capturedEngagementMetrics.length
    ? capturedEngagementMetrics.reduce(
        (sum, entry) =>
          sum +
          (entry.replies ?? 0) +
          (entry.reposts ?? 0) +
          (entry.likes ?? 0),
        0
      )
    : null;
  const followerDelta =
    profileStats.followers !== null && previousSnapshot?.followers != null
      ? profileStats.followers - previousSnapshot.followers
      : null;
  const urlCaptureCount = recentPosts.filter((entry) => entry.postedPostURL).length;
  const recommendations = buildRecommendations({
    recentPosts,
    trendPosts,
    archetypes,
    motifs,
    followerDelta,
    totalEngagement,
    capturedEngagementCount: capturedEngagementMetrics.length,
    urlCaptureCount,
    logStats,
  });
  const title = `[X週次レビュー] ${week.key} @${accountHandle}`;
  const body = [
    `# X 週次改善レビュー（${week.key}）`,
    "",
    `対象: @${accountHandle} / ${formatJstDate(since)}〜${formatJstDate(now)}`,
    "",
    "## サマリ",
    "",
    `- フォロワー: ${formatMetric(profileStats.followers)}（前回比 ${formatDelta(
      followerDelta
    )}）`,
    `- 累計ポスト: ${formatMetric(profileStats.posts)}`,
    `- 台帳上の投稿: ${recentPosts.length}件（${formatCounts(counts)}）`,
    `- 投稿URL取得: ${urlCaptureCount}/${recentPosts.length}件`,
    `- 表示数を取得できた投稿: ${capturedMetrics.length}/${postMetrics.length}件${
      capturedMetrics.length
        ? `、中央値 ${median(capturedMetrics.map((entry) => entry.views))}`
        : ""
    }`,
    `- 公開反応合計: ${formatMetric(
      totalEngagement
    )}（返信・リポスト・いいね、取得${capturedEngagementMetrics.length}件）`,
    `- 実行ログ: 成功${logStats.success} / 失敗${logStats.failed} / 候補なし${logStats.noCandidate}（確認${logStats.files}件）`,
    ...(profileStats.error
      ? [`- 注記: Xプロフィール取得エラー: ${profileStats.error}`]
      : []),
    "",
    "## トレンド投稿の構成",
    "",
    `- 型: ${formatCounts(archetypes)}`,
    `- 上限制モチーフ: ${formatCounts(motifs)}`,
    "",
    "## 次週の改善候補",
    "",
    ...recommendations.map((item) => `- [ ] ${item}`),
    "",
    "## 判定メモ",
    "",
    "- 数値が取得できない投稿は評価対象から外す。取得不能を0として扱わない。",
    "- 1週間で同時に変える主要要素は1つまでにし、型ごとの差を次回Issueで比較する。",
    "- 自動投稿文やスケジュールの変更は、このIssueで採用判断してから反映する。",
    "",
    `_generated_at: ${now.toISOString()}_`,
  ].join("\n");
  return { title, body };
}

function buildRecommendations({
  recentPosts,
  trendPosts,
  archetypes,
  motifs,
  followerDelta,
  totalEngagement,
  capturedEngagementCount,
  urlCaptureCount,
  logStats,
}) {
  const items = [];
  if (recentPosts.length === 0) {
    items.push("投稿台帳が空。各自動投稿が成功後に台帳へ記録されるか確認する");
  }
  if (recentPosts.length > 0 && urlCaptureCount < recentPosts.length) {
    items.push("URL未取得の投稿を確認し、X画面変更に合わせてURL検出を調整する");
  }
  if (trendPosts.length >= 5 && Object.keys(archetypes).length < 5) {
    items.push("5型ローテーションの欠けを確認し、次週は未実施の型を優先する");
  }
  if ((motifs.notification ?? 0) > 1) {
    items.push("「通知欄」が週内で多いため、次週は別の具体物へ置き換える");
  }
  if (capturedEngagementCount > 0 && totalEngagement === 0) {
    items.push("質問または投票の導入文を1案だけ変更し、返信・投票反応を比較する");
  }
  if (followerDelta !== null && followerDelta <= 0) {
    items.push("ツール紹介の便益を1文目へ移し、プロフィール訪問につながる仮説を試す");
  }
  if (logStats.failed > 0) {
    items.push("失敗ログを先に解消し、投稿内容の実験と実行失敗を切り分ける");
  }
  if (items.length === 0) {
    items.push("現行ローテーションをもう1週継続し、型別の表示数と公開反応を蓄積する");
  }
  return items.slice(0, 4);
}

async function createOrUpdateGitHubIssue({ cwd, title, body }) {
  const existingJson = await runCommand(
    "gh",
    [
      "issue",
      "list",
      "--state",
      "all",
      "--search",
      `\"${title}\" in:title`,
      "--json",
      "number,title,url",
      "--limit",
      "20",
    ],
    { cwd }
  );
  const existing = JSON.parse(existingJson).find((issue) => issue.title === title);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nazomatic-x-review-"));
  const bodyPath = path.join(tempDir, "issue.md");
  try {
    await fs.writeFile(bodyPath, `${body}\n`);
    if (existing) {
      await runCommand(
        "gh",
        ["issue", "comment", String(existing.number), "--body-file", bodyPath],
        { cwd }
      );
      return existing.url;
    }
    return (
      await runCommand(
        "gh",
        ["issue", "create", "--title", title, "--body-file", bodyPath],
        { cwd }
      )
    ).trim();
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function runCommand(command, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
    });
  });
}

async function readSnapshots(cwd) {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(cwd, SNAPSHOT_PATH), "utf8"));
    return Array.isArray(parsed?.snapshots) ? parsed.snapshots : [];
  } catch {
    return [];
  }
}

async function writeSnapshot(cwd, snapshots, snapshot) {
  const filePath = path.join(cwd, SNAPSHOT_PATH);
  const filtered = snapshots.filter(
    (entry) =>
      entry.weekKey !== snapshot.weekKey ||
      normalizeHandle(entry.accountHandle) !== snapshot.accountHandle
  );
  const value = { version: 1, snapshots: [snapshot, ...filtered].slice(0, 104) };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tempPath, filePath);
}

function findPreviousSnapshot(snapshots, now) {
  const cutoff = now.getTime() - 5 * 24 * 60 * 60 * 1000;
  return snapshots.find(
    (entry) => new Date(entry.capturedAt).getTime() <= cutoff
  );
}

function readMergedEnv(cwd, envFile) {
  return {
    ...readEnvFile(path.join(cwd, ".env.local")),
    ...readEnvFile(path.resolve(cwd, envFile)),
    ...process.env,
  };
}

function readEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return {};
  const result = {};
  for (const line of fsSync.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match || line.trim().startsWith("#")) continue;
    const value = match[2].trim();
    result[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
  return result;
}

function getJstIsoWeek(date) {
  const jstDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  jstDate.setHours(0, 0, 0, 0);
  const day = jstDate.getDay() || 7;
  jstDate.setDate(jstDate.getDate() + 4 - day);
  const yearStart = new Date(jstDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((jstDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return {
    key: `${jstDate.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`,
  };
}

function findFirstNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return Number(match[1]);
  }
  return null;
}

function countBy(entries, getKey) {
  const result = {};
  for (const entry of entries) {
    const key = String(getKey(entry));
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function countMany(entries, getKeys) {
  const result = {};
  for (const entry of entries) {
    for (const key of getKeys(entry)) result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function formatCounts(counts) {
  const entries = Object.entries(counts);
  return entries.length
    ? entries.map(([key, value]) => `${key} ${value}`).join(" / ")
    : "記録なし";
}

function formatMetric(value) {
  return value === null || value === undefined ? "取得不能" : String(value);
}

function formatDelta(value) {
  return value === null ? "比較不能" : value > 0 ? `+${value}` : String(value);
}

function formatJstDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeHandle(value) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : String(error));
}
await Promise.all([flushStream(process.stdout), flushStream(process.stderr)]);
process.exit(exitCode);

function flushStream(stream) {
  return new Promise((resolve) => stream.write("", resolve));
}

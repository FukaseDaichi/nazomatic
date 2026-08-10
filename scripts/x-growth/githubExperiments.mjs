import { spawn } from "child_process";

export const EXPERIMENT_LABEL = "x-growth-experiment";
export const REVIEW_LABEL = "x-growth-review";
export const ACTIVE_LABEL = "x-growth:active";
export const KEEP_LABEL = "x-growth:keep";
export const REVERT_LABEL = "x-growth:revert";
export const REVERTED_LABEL = "x-growth:reverted";
export const ATTENTION_LABEL = "x-growth:needs-attention";

export function getJstIsoWeek(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  const utc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const year = utc.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utc - first) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function reviewTitle(week, account) {
  return `[X週次レビュー] ${week} @${normalizeHandle(account)}`;
}

export function normalizeHandle(value) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

export async function runGh(cwd, args, { input, timeoutMs = 30000 } = {}) {
  return run("gh", args, { cwd, input, timeoutMs });
}

export async function runGit(cwd, args, options) {
  return run("git", args, { cwd, ...options });
}

// 再レビューは既存 Issue のコメントとして追記されるため、本文だけでなくコメントも取得する。
const ISSUE_VIEW_FIELDS = "number,title,url,body,state,labels,author,createdAt,comments";

export async function findReviewIssue(cwd, { week, account, number } = {}) {
  if (number) return viewIssue(cwd, number);
  const title = reviewTitle(week, account);
  const items = JSON.parse(await runGh(cwd, ["issue", "list", "--state", "all", "--search", `\"${title}\" in:title`, "--json", "number,title", "--limit", "100"]));
  const exact = items.filter((item) => item.title === title);
  if (exact.length > 1) throw new Error(`multiple review issues found for ${title}`);
  return exact[0] ? viewIssue(cwd, exact[0].number) : null;
}

async function viewIssue(cwd, number) {
  return normalizeIssue(JSON.parse(await runGh(cwd, ["issue", "view", String(number), "--json", ISSUE_VIEW_FIELDS])));
}

export async function listExperimentPrs(cwd) {
  const json = await runGh(cwd, [
    "pr", "list", "--state", "all", "--label", EXPERIMENT_LABEL,
    "--json", "number,url,title,body,state,isDraft,mergedAt,mergeCommit,closedAt,headRefName,headRefOid,baseRefName,labels",
    "--limit", "1000",
  ]);
  return JSON.parse(json).map((pr) => ({ ...pr, labels: (pr.labels ?? []).map((label) => label.name), metadata: parseExperimentMarker(pr.body) }));
}

export async function findProductionDeployment(cwd, mergeSha) {
  const repo = JSON.parse(await runGh(cwd, ["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
  const deploymentPages = JSON.parse(await runGh(cwd, ["api", "--paginate", "--slurp", `repos/${repo}/deployments?environment=Production&per_page=100`]));
  const deployments = deploymentPages.flat();
  for (const deployment of deployments) {
    if (!deployment.sha || !await isAncestor(cwd, mergeSha, deployment.sha)) continue;
    const statuses = JSON.parse(await runGh(cwd, ["api", `repos/${repo}/deployments/${deployment.id}/statuses?per_page=1`]));
    if (statuses[0]?.state === "success") {
      return { sha: deployment.sha, deployedAt: statuses[0].created_at ?? deployment.created_at };
    }
  }
  return null;
}

export function parseExperimentMarker(body) {
  const marker = locateExperimentMarker(body);
  return marker?.value ?? null;
}

export function replaceExperimentMarker(body, metadata) {
  const marker = locateExperimentMarker(body);
  if (!marker || !isExperimentMetadata(metadata)) return null;
  const replacement = `<!-- x-growth-experiment:v1 ${JSON.stringify(metadata)} -->`;
  return `${marker.source.slice(0, marker.start)}${replacement}${marker.source.slice(marker.end)}`;
}

// `<!-- x-growth-experiment:v1 ... -->` などの機械可読 marker は LLM 入力では雑音なので落とす。
export function stripXGrowthMarkers(text) {
  return String(text ?? "")
    .replace(/<!--\s*x-growth-[\w-]+:v\d+[^]*?-->/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function experimentKeyMatches(pr, { reviewIssue, account }) {
  const meta = pr.metadata;
  return meta && Number(meta.reviewIssue) === Number(reviewIssue) && normalizeHandle(meta.account) === normalizeHandle(account);
}

export function isTerminalExperiment(pr) {
  return classifyExperiment(pr).phase === "terminal";
}

export function classifyExperiment(pr) {
  const labels = pr.labels ?? [];
  if (labels.includes(KEEP_LABEL) || labels.includes(REVERTED_LABEL)) {
    return { phase: "terminal", blocking: false };
  }
  if (labels.includes(ATTENTION_LABEL)) return { phase: "needs_attention", blocking: true };
  if (labels.includes(REVERT_LABEL)) return { phase: "revert_requested", blocking: true };
  if (labels.includes(ACTIVE_LABEL)) return { phase: "active", blocking: true };
  if (pr.state === "OPEN") return { phase: "open_pr", blocking: true };
  if (pr.mergedAt || pr.state === "MERGED") return { phase: "pending_activation", blocking: true };
  return { phase: "closed_unmerged", blocking: false };
}

export async function ensureLabels(cwd) {
  for (const name of [REVIEW_LABEL, EXPERIMENT_LABEL, ACTIVE_LABEL, KEEP_LABEL, REVERT_LABEL, REVERTED_LABEL, ATTENTION_LABEL]) {
    await runGh(cwd, ["label", "create", name, "--color", "6f42c1", "--force"]).catch(() => {});
  }
}

export async function addLabels(cwd, issueOrPr, labels) {
  if (!labels.length) return;
  await runGh(cwd, ["issue", "edit", String(issueOrPr), "--add-label", labels.join(",")]);
}

export async function updateExperimentMetadata(cwd, pr, metadata) {
  const body = replaceExperimentMarker(pr.body, metadata);
  if (body == null) throw new Error(`experiment metadata marker is missing or invalid on PR #${pr.number}`);
  if (body === String(pr.body ?? "")) return;
  await runGh(cwd, ["pr", "edit", String(pr.number), "--body", body]);
}

export async function comment(cwd, issueOrPr, body) {
  return runGh(cwd, ["issue", "comment", String(issueOrPr), "--body", body]);
}

export async function closeIssue(cwd, number, body) {
  if (body) await comment(cwd, number, body);
  await runGh(cwd, ["issue", "close", String(number)]);
}

function normalizeIssue(item) {
  return {
    ...item,
    labels: (item.labels ?? []).map((label) => label.name),
    author: item.author?.login ?? null,
    comments: (item.comments ?? []).map((entry) => ({
      author: entry?.author?.login ?? null,
      createdAt: entry?.createdAt ?? null,
      url: entry?.url ?? null,
      body: String(entry?.body ?? ""),
    })),
  };
}

function locateExperimentMarker(body) {
  const source = String(body ?? "");
  const startMatch = /<!--\s*x-growth-experiment:v1\s+/.exec(source);
  if (!startMatch) return null;
  const contentStart = startMatch.index + startMatch[0].length;
  const commentEnd = source.indexOf("-->", contentStart);
  if (commentEnd === -1) return null;
  const end = commentEnd + 3;
  if (/<!--\s*x-growth-experiment:v1\s+/.test(source.slice(end))) return null;
  try {
    const value = JSON.parse(source.slice(contentStart, commentEnd).trim());
    if (!isExperimentMetadata(value)) return null;
    return { source, start: startMatch.index, end, value };
  } catch {
    return null;
  }
}

function isExperimentMetadata(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.reviewIssue &&
    value.account &&
    value.targetKey,
  );
}

async function isAncestor(cwd, ancestor, descendant) {
  try {
    await runGit(cwd, ["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, { cwd, input, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(stdout) : reject(new Error(`${command} ${args.join(" ")} failed: ${stderr || stdout}`));
    });
    child.stdin.end(input ?? "");
  });
}

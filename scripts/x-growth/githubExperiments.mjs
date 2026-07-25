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

export async function findReviewIssue(cwd, { week, account, number } = {}) {
  if (number) {
    const item = JSON.parse(await runGh(cwd, ["issue", "view", String(number), "--json", "number,title,url,body,state,labels"]));
    return normalizeIssue(item);
  }
  const title = reviewTitle(week, account);
  const items = JSON.parse(await runGh(cwd, ["issue", "list", "--state", "all", "--search", `\"${title}\" in:title`, "--json", "number,title,url,body,state,labels", "--limit", "100"]));
  const exact = items.filter((item) => item.title === title).map(normalizeIssue);
  if (exact.length > 1) throw new Error(`multiple review issues found for ${title}`);
  return exact[0] ?? null;
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
  const match = /<!--\s*x-growth-experiment:v1\s+(\{[^]*?\})\s*-->/.exec(String(body ?? ""));
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    return value?.reviewIssue && value?.account && value?.targetKey ? value : null;
  } catch { return null; }
}

export function experimentKeyMatches(pr, { reviewIssue, account }) {
  const meta = pr.metadata;
  return meta && Number(meta.reviewIssue) === Number(reviewIssue) && normalizeHandle(meta.account) === normalizeHandle(account);
}

export function isTerminalExperiment(pr) {
  return pr.labels?.includes(KEEP_LABEL) || pr.labels?.includes(REVERTED_LABEL);
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
  const marker = `<!-- x-growth-experiment:v1 ${JSON.stringify(metadata)} -->`;
  const body = String(pr.body ?? "").replace(/<!--\s*x-growth-experiment:v1\s+\{[^]*?\}\s*-->/, marker);
  if (body === pr.body) throw new Error(`experiment metadata marker is missing on PR #${pr.number}`);
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
  return { ...item, labels: (item.labels ?? []).map((label) => label.name) };
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

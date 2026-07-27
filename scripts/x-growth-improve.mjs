#!/usr/bin/env node
import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { pathToFileURL } from "url";

import { readBrowserPostLedger } from "./x-browser-posting/postLedger.mjs";
import { runWithLocalLog } from "./x-browser-posting/runLog.mjs";
import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import { EXPERIMENT_ALLOWLIST } from "./x-growth/experimentAllowlist.mjs";
import { buildProposalOutputSchema, normalizeStructuredProposal, validateProposal } from "./x-growth/proposalSchema.mjs";
import { applyChangeToFile, buildExperimentBranch, createExperimentPr } from "./x-growth/applyProposal.mjs";
import { verifyChangedFile } from "./x-growth/verifyChange.mjs";
import { calculateMetric, jstHourBucket, sumEngagement, telemetryHealth } from "./x-growth/reportMetrics.mjs";
import { ATTENTION_LABEL, EXPERIMENT_LABEL, addLabels, closeIssue, comment, ensureLabels, experimentKeyMatches, findReviewIssue, getJstIsoWeek, isTerminalExperiment, listExperimentPrs, normalizeHandle, runGit } from "./x-growth/githubExperiments.mjs";

const LOCK_PATH = "local/x-browser-posting/locks/x-growth-improve.lock";

export async function runImprovementCycle({ controlRoot, review, account, callCodex, execute, model }) {
  const prs = await listExperimentPrs(controlRoot);
  const same = prs.filter((pr) => experimentKeyMatches(pr, { reviewIssue: review.number, account }));
  if (same.length > 1) return { status: "rejected", reason: "duplicate experiment PRs for review issue" };
  if (same.length === 1) return { status: "existing_pr", prUrl: same[0].url, branch: same[0].headRefName };
  const active = prs.find((pr) => !isTerminalExperiment(pr) && (pr.state === "OPEN" || pr.mergedAt || pr.labels.includes("x-growth:revert")));
  if (active) return { status: "skipped_active_experiment", prUrl: active.url, branch: active.headRefName };

  const ledger = await readBrowserPostLedger({ cwd: controlRoot });
  const posts = ledger.entries.filter((entry) => normalizeHandle(entry.accountHandle) === account && Date.now() - new Date(entry.postedAt).getTime() <= 14 * 86400000);
  const health = telemetryHealth(posts, { maturityHours: 24 });
  if (health.eligible < 5 || health.rate < 0.7) {
    const reason = `テレメトリ不足: mature ${health.mature}/${health.eligible} (${Math.round(health.rate * 100)}%), URL欠損 ${health.missingUrl}, 期限超過 ${health.expired}`;
    if (execute) await closeIssue(controlRoot, review.number, `## 改善PRを見送り\n\n${reason}\n\n\`skipped_insufficient_telemetry\``);
    return { status: "skipped_insufficient_telemetry", reason };
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nazomatic-x-growth-"));
  const worktreeRoot = path.join(tempRoot, "worktree");
  let localBranch = null;
  let preserveBranch = false;
  try {
    if (execute) {
      await runGit(controlRoot, ["fetch", "--prune", "origin", "main"]);
      await runGit(controlRoot, ["worktree", "add", "--detach", worktreeRoot, "origin/main"]);
      await run("npm", ["ci"], { cwd: worktreeRoot, timeoutMs: 300000 });
      const base = await verifyChangedFile(worktreeRoot, "src/server/x-browser-posting/trend-joke-post.ts");
      if (!base.ok) return { status: "base_broken", reason: base.reason };
    }
    const proposal = await callCodex({ cwd: execute ? worktreeRoot : controlRoot, reviewMarkdown: review.body, ledgerSummary: buildLedgerSummary(posts), allowlist: EXPERIMENT_ALLOWLIST, model });
    const validated = validateProposal(proposal);
    if (!validated.ok) return { status: "rejected", reason: validated.reason, proposal };
    const repeated = prs.find((pr) => pr.metadata?.targetKey === validated.proposal.targetKey);
    if (repeated) return { status: "rejected", reason: `targetKey was already used by ${repeated.url}`, proposal: validated.proposal };
    const metricPosts = posts.filter((entry) => Date.now() - new Date(entry.postedAt).getTime() >= validated.proposal.metric.maturityHours * 3600000);
    const proposalBaseline = calculateMetric(metricPosts, validated.proposal.metric);
    if (proposalBaseline.sampleSize < validated.proposal.metric.minimumSampleSize) return { status: "rejected", reason: "baseline sample size is insufficient", proposal: validated.proposal };
    const plannedEvaluateWeek = getJstIsoWeek(new Date(Date.now() + (validated.proposal.metric.windowDays + 1) * 86400000));
    const branch = buildExperimentBranch({ issueNumber: review.number, plannedEvaluateWeek, proposal: validated.proposal });
    if (!execute) return { status: "proposed", proposal: validated.proposal, branch, plannedEvaluateWeek, proposalBaseline };
    await runGit(worktreeRoot, ["switch", "-c", branch]);
    localBranch = branch;
    const applied = await applyChangeToFile(worktreeRoot, validated.proposal);
    if (!applied.ok) return { status: "rejected", reason: applied.reason, proposal: validated.proposal };
    const verified = await verifyChangedFile(worktreeRoot, validated.proposal.path);
    if (!verified.ok) return { status: "proposal_broken", reason: verified.reason, proposal: validated.proposal };
    const baseSha = (await runGit(worktreeRoot, ["rev-parse", "HEAD"])).trim();
    let pr;
    try {
      pr = await createExperimentPr(worktreeRoot, validated.proposal, { reviewIssue: review, account, plannedEvaluateWeek, baseSha, proposalBaseline });
    } catch (error) {
      const found = (await listExperimentPrs(controlRoot)).find((item) => item.headRefName === branch);
      if (found) {
        preserveBranch = true;
        return { status: "partial_success", prUrl: found.url, branch };
      }
      preserveBranch = true;
      throw error;
    }
    const found = (await listExperimentPrs(controlRoot)).find((item) => item.headRefName === branch);
    if (!found) throw new Error("PR was created but could not be found for label assignment");
    await addLabels(controlRoot, found.number, [EXPERIMENT_LABEL]);
    return { status: "pr_created", proposal: validated.proposal, branch, ...pr };
  } finally {
    if (execute) await runGit(controlRoot, ["worktree", "remove", "--force", worktreeRoot]).catch(() => {});
    if (localBranch && !preserveBranch) await runGit(controlRoot, ["branch", "-D", localBranch]).catch(() => {});
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runCodexProposal({ cwd, reviewMarkdown, ledgerSummary, allowlist, model }) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-schema-"));
  const schema = path.join(temp, "schema.json"); const output = path.join(temp, "output.json");
  try {
    await fs.writeFile(schema, JSON.stringify(buildProposalOutputSchema()));
    const prompt = [
      "NAZOMATICのX改善実験を1件だけ提案してください。",
      "主要な行動変化が1つになる仮説を立て、同一ファイル内のchangesを最大6件まで提案できます。各findは、それ以前のchange適用後のファイルでちょうど1回一致する局所的な置換にしてください。",
      "trend-joke-post.tsでは投稿生成戦略、fallback、prompt、候補選択ロジックを大胆に改善できます。TypeScriptの構造文字やテンプレートリテラルも使用できます。",
      "allowlist外、import、依存関係、環境変数、外部通信、認証、投稿実行guard、入力検証、文字数・検索件数・timeout、頻度、実行設定は変更禁止。targetKeyと構造化metricを必ず出力してください。",
      "minimumSampleSize=5、maturityHours=24、windowDays=14、direction=increaseはNode固定です。metric.filtersは0件または1件だけにし、台帳の「選択可能metric filter JSON」で選択metricに列挙されたfiltersを、そのまま1件選んでください。JSONにないfilter値は禁止です。",
      ...allowlist.map((x) => `- ${x.path}: ${x.note} / targetKey ${x.targetKeys.join(",")}`),
      "\n## レビュー",
      reviewMarkdown,
      "\n## 台帳",
      ledgerSummary,
    ].join("\n");
    const args = ["exec", ...(model ? ["--model", model] : []), "--cd", cwd, "--sandbox", "read-only", "--ephemeral", "--output-schema", schema, "--output-last-message", output, "-"];
    const result = await run("codex", args, { cwd, input: prompt, timeoutMs: 120000 });
    return normalizeStructuredProposal(
      JSON.parse((await fs.readFile(output, "utf8").catch(() => "")) || result),
    );
  } finally { await fs.rm(temp, { recursive: true, force: true }).catch(() => {}); }
}

export function buildLedgerSummary(posts) {
  const mature = posts.filter((entry) => entry.metrics?.mature === true);
  const dimensions = [
    ["postType", (entry) => entry.postType],
    ["archetype", (entry) => entry.metadata?.archetype],
    ["hasMedia", (entry) => entry.metadata?.hasMedia],
    ["shape", (entry) => entry.metadata?.shape],
    ["topicKey", (entry) => entry.metadata?.topicKey],
    ["jstHourBucket", (entry) => jstHourBucket(entry.postedAt)],
  ];
  const counts = dimensions.map(([name, getValue]) => {
    const byValue = new Map();
    for (const entry of mature) {
      const value = getValue(entry);
      if (value === null || value === undefined || value === "") continue;
      const key = String(value);
      const entries = byValue.get(key) ?? [];
      entries.push(entry);
      byValue.set(key, entries);
    }
    const values = [...byValue.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([value, entries]) => `${value}${formatMetricSampleCounts(entries)}`)
      .join(", ");
    return `${name}=${values || "該当なし"}`;
  });
  return [
    `直近14日: ${posts.length}件 / metrics成熟: ${mature.length}件`,
    "利用可能sample凡例: [m=成熟, v=median_views, e=median_engagement, r=reply_post_rate]",
    `filterなし=${formatMetricSampleCounts(mature)} | 単独filter: ${counts.join(" | ")}`,
    `選択可能metric filter JSON（sampleSize 5以上）: ${JSON.stringify(buildEligibleMetricFilters(mature, dimensions))}`,
  ].join("\n");
}

function buildEligibleMetricFilters(entries, dimensions) {
  const metrics = ["median_views", "median_engagement", "reply_post_rate"];
  return Object.fromEntries(
    metrics.map((metricName) => {
      const candidates = [];
      const unfilteredCount = metricSampleCount(entries, metricName);
      if (unfilteredCount >= 5) {
        candidates.push({ filters: {}, sampleSize: unfilteredCount });
      }
      for (const [dimension, getValue] of dimensions) {
        const groups = new Map();
        for (const entry of entries) {
          const value = getValue(entry);
          if (value === null || value === undefined || value === "") continue;
          const key = JSON.stringify(value);
          const group = groups.get(key) ?? { value, entries: [] };
          group.entries.push(entry);
          groups.set(key, group);
        }
        for (const { value, entries: groupedEntries } of groups.values()) {
          const sampleSize = metricSampleCount(groupedEntries, metricName);
          if (sampleSize >= 5) {
            candidates.push({
              filters: { [dimension]: value },
              sampleSize,
            });
          }
        }
      }
      candidates.sort(
        (a, b) =>
          b.sampleSize - a.sampleSize ||
          JSON.stringify(a.filters).localeCompare(JSON.stringify(b.filters)),
      );
      return [metricName, candidates];
    }),
  );
}

function formatMetricSampleCounts(entries) {
  const views = metricSampleCount(entries, "median_views");
  const engagement = metricSampleCount(entries, "median_engagement");
  const replies = metricSampleCount(entries, "reply_post_rate");
  return `[m${entries.length}/v${views}/e${engagement}/r${replies}]`;
}

function metricSampleCount(entries, metricName) {
  if (metricName === "median_views") {
    return entries.filter((entry) => Number.isFinite(entry.metrics?.views)).length;
  }
  if (metricName === "median_engagement") {
    return entries.filter(
      (entry) => sumEngagement(entry.metrics ?? {}) !== null,
    ).length;
  }
  return entries.filter((entry) => entry.metrics?.replies != null).length;
}

async function withLock(cwd, reviewNumber, task) {
  const lock = path.join(cwd, LOCK_PATH); await fs.mkdir(path.dirname(lock), { recursive: true });
  let handle;
  try { handle = await fs.open(lock, "wx"); await handle.writeFile(JSON.stringify({ startedAt: new Date().toISOString(), pid: process.pid, reviewNumber }) + "\n"); }
  catch (error) { throw new Error(`x-growth lock is held: ${error.code ?? error.message}`); }
  try { return await task(); } finally { await handle?.close().catch(() => {}); await fs.unlink(lock).catch(() => {}); }
}

function parseArgs(argv) { const args = { execute: false, reviewIssue: null, model: "" }; for (let i = 0; i < argv.length; i += 1) { const arg = argv[i]; if (arg === "--execute") args.execute = true; else if (arg === "--review-issue" || arg === "--model") { const value = argv[++i]; if (!value) throw new Error(`${arg} requires a value`); args[arg === "--model" ? "model" : "reviewIssue"] = arg === "--model" ? value : Number(value); } else throw new Error(`Unknown argument: ${arg}`); } return args; }
async function main() {
  const args = parseArgs(process.argv.slice(2)); const controlRoot = process.cwd();
  const browserConfig = loadBrowserPostConfig([], controlRoot);
  const account = normalizeHandle(browserConfig.accountHandle); if (!account) throw new Error("X_BROWSER_POST_ACCOUNT_HANDLE is required");
  if (args.execute) await ensureLabels(controlRoot);
  const review = await findReviewIssue(controlRoot, { week: getJstIsoWeek(), account, number: args.reviewIssue });
  if (!review) throw new Error("current review issue was not found");
  const task = () => runImprovementCycle({ controlRoot, review, account, execute: args.execute, model: args.model, callCodex: runCodexProposal });
  let result;
  try {
    result = args.execute ? await withLock(controlRoot, review.number, task) : await task();
  } catch (error) {
    if (args.execute && String(error?.message ?? error).includes("x-growth lock is held")) {
      await addLabels(controlRoot, review.number, [ATTENTION_LABEL]).catch(() => {});
      await comment(controlRoot, review.number, `## 自動改善を停止\n\n排他 lock が残っています。確認してから再実行してください。\n\n\`${String(error.message)}\``).catch(() => {});
    }
    throw error;
  }
  if (args.execute && result.status === "rejected") {
    await closeIssue(controlRoot, review.number, `## 改善PRを見送り\n\n${result.reason}\n\n\`rejected\``);
  }
  if (args.execute && ["base_broken", "proposal_broken"].includes(result.status)) {
    await addLabels(controlRoot, review.number, [ATTENTION_LABEL]);
    await comment(controlRoot, review.number, `## 自動改善に失敗\n\n${result.reason}\n\n\`${result.status}\``);
  }
  console.log(JSON.stringify(result, null, 2));
}
function run(command, args, { cwd, input, timeoutMs = 120000 } = {}) { return new Promise((resolve, reject) => { const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] }); let out = "", err = ""; const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs); child.stdout.on("data", (x) => out += x); child.stderr.on("data", (x) => err += x); child.on("error", reject); child.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(`${command} failed: ${err || out}`)); }); child.stdin.end(input ?? ""); }); }
if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await runWithLocalLog({ cwd: process.cwd(), automationId: "x-growth-improve", command: `npm run x:growth-improve ${process.argv.slice(2).join(" ")}` }, main));

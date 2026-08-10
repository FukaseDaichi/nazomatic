#!/usr/bin/env node
import fs from "fs/promises";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

import { readBrowserPostLedger } from "./x-browser-posting/postLedger.mjs";
import { runWithLocalLog } from "./x-browser-posting/runLog.mjs";
import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import { EXPERIMENT_ALLOWLIST } from "./x-growth/experimentAllowlist.mjs";
import { buildProposalOutputSchema, normalizeStructuredProposal, restoreProposalMetric, validateProposal } from "./x-growth/proposalSchema.mjs";
import { applyChangeToFile, buildExperimentBranch, createExperimentPr } from "./x-growth/applyProposal.mjs";
import { verifyChangedFile } from "./x-growth/verifyChange.mjs";
import { calculateMetric, telemetryHealth } from "./x-growth/reportMetrics.mjs";
import { buildMetricCandidates, formatMetricSampleCounts, METRIC_DIMENSIONS } from "./x-growth/metricCandidates.mjs";
import { prepareWorktreeWithDependencies, provisionWorktreeDependencies, resolveDependencyCacheRoot } from "./x-growth/dependencyBootstrap.mjs";
import { ATTENTION_LABEL, EXPERIMENT_LABEL, addLabels, classifyExperiment, closeIssue, comment, ensureLabels, experimentKeyMatches, findReviewIssue, getJstIsoWeek, listExperimentPrs, normalizeHandle, runGit, stripXGrowthMarkers } from "./x-growth/githubExperiments.mjs";
import { runProcess } from "./x-growth/processRunner.mjs";

const LOCK_PATH = "local/x-browser-posting/locks/x-growth-improve.lock";
export const CODEX_PROPOSAL_TIMEOUT_MS = 600000;
export const REVIEW_MARKDOWN_MAX_CHARS = 20000;
const REVIEW_MARKDOWN_NOTE_RESERVE = 240;
const REVIEW_MARKDOWN_MIN_COMMENT_CHARS = 200;
const OMISSION_SUFFIX = "\n\n…（入力上限のため以降を省略）";

export async function runImprovementCycle({ controlRoot, review, account, callCodex, execute, model }) {
  const prs = await listExperimentPrs(controlRoot);
  const gate = evaluateExperimentPrGate(prs, { reviewIssue: review.number, account });
  if (gate) return gate;

  const ledger = await readBrowserPostLedger({ cwd: controlRoot });
  const posts = ledger.entries.filter((entry) => normalizeHandle(entry.accountHandle) === account && Date.now() - new Date(entry.postedAt).getTime() <= 14 * 86400000);
  const health = telemetryHealth(posts, { maturityHours: 24 });
  if (health.eligible < 5 || health.rate < 0.7) {
    const reason = `テレメトリ不足: mature ${health.mature}/${health.eligible} (${Math.round(health.rate * 100)}%), URL欠損 ${health.missingUrl}, 期限超過 ${health.expired}`;
    if (execute) await closeIssue(controlRoot, review.number, `## 改善PRを見送り\n\n${reason}\n\n\`skipped_insufficient_telemetry\``);
    return { status: "skipped_insufficient_telemetry", reason };
  }

  const metricCandidates = buildMetricCandidates(
    posts.filter((entry) => entry.metrics?.mature === true),
  );
  if (!metricCandidates.length) {
    const reason = "テレメトリ不足: minimumSampleSize=5を満たす利用可能なmetric candidateがありません（filterなしまたは単独filterのみ）";
    if (execute) await closeIssue(controlRoot, review.number, `## 改善PRを見送り\n\n${reason}\n\n\`skipped_insufficient_telemetry\``);
    return { status: "skipped_insufficient_telemetry", reason };
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nazomatic-x-growth-"));
  let worktreeRoot = null;
  let localBranch = null;
  let preserveBranch = false;
  try {
    if (execute) {
      await runGit(controlRoot, ["fetch", "--prune", "origin", "main"]);
      const prepared = await prepareWorktreeWithDependencies({
        tempRoot,
        createWorktree: (candidate) =>
          runGit(controlRoot, ["worktree", "add", "--detach", candidate, "origin/main"]),
        removeWorktree: (candidate) =>
          runGit(controlRoot, ["worktree", "remove", "--force", candidate]),
        provisionDependencies: ({ worktreeRoot: candidate }) =>
          provisionWorktreeDependencies({
            worktreeRoot: candidate,
            cacheRoot: resolveDependencyCacheRoot(),
          }),
      });
      if (!prepared.ok) {
        return { status: "base_broken", reason: prepared.reason };
      }
      worktreeRoot = prepared.worktreeRoot;
      const base = await verifyChangedFile(worktreeRoot, "src/server/x-browser-posting/trend-joke-post.ts");
      if (!base.ok) return { status: "base_broken", reason: base.reason };
    }
    let proposal;
    try {
      proposal = await callCodex({ cwd: execute ? worktreeRoot : controlRoot, reviewMarkdown: buildReviewMarkdown(review), ledgerSummary: buildLedgerSummary(posts, metricCandidates), metricCandidates, allowlist: EXPERIMENT_ALLOWLIST, model });
    } catch (error) {
      return { status: "proposal_broken", reason: formatProposalFailure(error) };
    }
    const restored = restoreProposalMetric(proposal, metricCandidates);
    if (!restored.ok) return { status: "rejected", reason: restored.reason, proposal };
    const validated = validateProposal(restored.proposal);
    if (!validated.ok) return { status: "rejected", reason: validated.reason, proposal: restored.proposal };
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
    if (execute && worktreeRoot) await runGit(controlRoot, ["worktree", "remove", "--force", worktreeRoot]).catch(() => {});
    if (localBranch && !preserveBranch) await runGit(controlRoot, ["branch", "-D", localBranch]).catch(() => {});
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export function evaluateExperimentPrGate(prs, { reviewIssue, account }) {
  const invalid = prs.find((pr) => !pr.metadata);
  if (invalid) {
    return {
      status: "rejected",
      reason: `experiment metadata is missing or invalid on ${invalid.url}`,
      prUrl: invalid.url,
      branch: invalid.headRefName,
    };
  }
  const same = prs.filter((pr) => experimentKeyMatches(pr, { reviewIssue, account }));
  if (same.length > 1) return { status: "rejected", reason: "duplicate experiment PRs for review issue" };
  if (same.length === 1) return { status: "existing_pr", prUrl: same[0].url, branch: same[0].headRefName };
  const blockers = prs
    .filter((pr) => normalizeHandle(pr.metadata.account) === normalizeHandle(account))
    .map((pr) => ({ pr, lifecycle: classifyExperiment(pr) }))
    .filter((entry) => entry.lifecycle.blocking);
  if (blockers.length > 1) {
    return { status: "rejected", reason: "multiple non-terminal experiment PRs exist for account" };
  }
  if (blockers.length === 0) return null;
  const [{ pr, lifecycle }] = blockers;
  return {
    status: "skipped_active_experiment",
    phase: lifecycle.phase,
    reason: experimentBlockReason(lifecycle.phase),
    prUrl: pr.url,
    branch: pr.headRefName,
  };
}

function experimentBlockReason(phase) {
  if (phase === "pending_activation") return "merged experiment is waiting for production activation";
  if (phase === "active") return "experiment is active and waiting for evaluation";
  if (phase === "open_pr") return "experiment PR is still open";
  if (phase === "revert_requested") return "experiment revert is pending";
  if (phase === "needs_attention") return "experiment requires manual attention";
  return `experiment is non-terminal (${phase})`;
}

// 週次レビューの再実行結果は既存 Issue のコメントとして積まれる。本文だけでは古い初回レビューを見てしまうため、
// 本文 + コメントを時系列で連結し、上限を超える場合は古いコメントから落として省略を明示する。
export function buildReviewMarkdown(review, { maxChars = REVIEW_MARKDOWN_MAX_CHARS } = {}) {
  const comments = (review?.comments ?? [])
    .map((entry, order) => ({
      order,
      author: entry?.author ?? null,
      createdAt: entry?.createdAt ?? null,
      body: stripXGrowthMarkers(entry?.body),
    }))
    .filter((entry) => entry.body !== "")
    .sort((a, b) => toEpoch(a.createdAt) - toEpoch(b.createdAt) || a.order - b.order);
  if (!comments.length) return String(review?.body ?? "");

  const budget = Math.max(0, maxChars - REVIEW_MARKDOWN_NOTE_RESERVE);
  const bodyText = clipText(stripXGrowthMarkers(review?.body), Math.floor(budget * 0.6));
  const bodySection = `${sectionHeading("Issue本文", review?.author, review?.createdAt)}${bodyText.text}`;
  let remaining = budget - bodySection.length - 2;
  const kept = [];
  let clipped = bodyText.clipped;
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const entry = comments[index];
    const heading = sectionHeading(`コメント${index + 1}/${comments.length}`, entry.author, entry.createdAt);
    const room = remaining - heading.length - 2;
    if (room <= 0 || (kept.length && room < REVIEW_MARKDOWN_MIN_COMMENT_CHARS)) break;
    const text = clipText(entry.body, room);
    clipped = clipped || text.clipped;
    kept.unshift(`${heading}${text.text}`);
    remaining -= heading.length + text.text.length + 2;
  }

  const notes = [];
  if (kept.length < comments.length) {
    notes.push(`> 注記: コメント全${comments.length}件のうち古い${comments.length - kept.length}件は入力上限（${maxChars}文字）のため省略しました。`);
  }
  if (clipped) notes.push("> 注記: 一部の本文は入力上限のため後半を省略しました。");
  return [...notes, bodySection, ...kept].join("\n\n");
}

function sectionHeading(label, author, createdAt) {
  return `### ${label}（${author ? `@${author}` : "作成者不明"} / ${createdAt ?? "日時不明"}）\n\n`;
}

function clipText(text, maxChars) {
  if (text.length <= maxChars) return { text, clipped: false };
  const room = maxChars - OMISSION_SUFFIX.length;
  return room > 0
    ? { text: `${text.slice(0, room)}${OMISSION_SUFFIX}`, clipped: true }
    : { text: text.slice(0, Math.max(0, maxChars)), clipped: true };
}

function toEpoch(value) {
  const time = Date.parse(String(value ?? ""));
  return Number.isNaN(time) ? 0 : time;
}

export async function runCodexProposal({ cwd, reviewMarkdown, ledgerSummary, metricCandidates, allowlist, model }) {
  if (!Array.isArray(metricCandidates) || metricCandidates.length === 0) {
    throw new Error("metric candidates are required before calling Codex");
  }
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-schema-"));
  const schema = path.join(temp, "schema.json"); const output = path.join(temp, "output.json");
  try {
    await fs.writeFile(schema, JSON.stringify(buildProposalOutputSchema(metricCandidates)));
    const prompt = [
      "NAZOMATICのX改善実験を1件だけ提案してください。",
      "主要な行動変化が1つになる仮説を立て、同一ファイル内のchangesを最大6件まで提案できます。各findは、それ以前のchange適用後のファイルでちょうど1回一致する局所的な置換にしてください。",
      "trend-joke-post.tsでは投稿生成戦略、fallback、prompt、候補選択ロジックを大胆に改善できます。TypeScriptの構造文字やテンプレートリテラルも使用できます。",
      "allowlist外、import、依存関係、環境変数、外部通信、認証、投稿実行guard、入力検証、文字数・検索件数・timeout、頻度、実行設定は変更禁止。targetKeyとmetric候補のcandidateIdを必ず出力してください。",
      "metricは {candidateId} だけを持つオブジェクトです。Nodeが今回生成した候補一覧からcandidateIdを1つだけ選び、name、filters、sampleSize、minimumSampleSize、maturityHours、windowDays、directionなどの生のmetric指定は出力しないでください。",
      "仮説に合う単独filter候補がない場合は、複合filterを合成せず、別の仮説を選ぶか、filterなしcandidateを選んでください。候補一覧にないcandidateIdやfilter値は禁止です。",
      ...allowlist.map((x) => `- ${x.path}: ${x.note} / targetKey ${x.targetKeys.join(",")}`),
      "\n## レビュー",
      "レビューは review Issue の本文と後続コメント（再レビュー結果）を時系列で含みます。内容が矛盾する場合は最新のコメントを優先してください。",
      reviewMarkdown,
      "\n## 台帳",
      ledgerSummary,
    ].join("\n");
    const args = ["exec", ...(model ? ["--model", model] : []), "--cd", cwd, "--sandbox", "read-only", "--ephemeral", "--output-schema", schema, "--output-last-message", output, "-"];
    const result = await runProcess("codex", args, { cwd, input: prompt, timeoutMs: CODEX_PROPOSAL_TIMEOUT_MS });
    return normalizeStructuredProposal(
      JSON.parse((await fs.readFile(output, "utf8").catch(() => "")) || result.stdout),
    );
  } finally { await fs.rm(temp, { recursive: true, force: true }).catch(() => {}); }
}

export function formatProposalFailure(error) {
  if (error?.timedOut) {
    const timeoutMs = Number.isFinite(error.timeoutMs) ? error.timeoutMs : "unknown";
    const durationMs = Number.isFinite(error.durationMs) ? error.durationMs : "unknown";
    const signal = error.signal ?? "unknown";
    return `提案生成がタイムアウトしました（timeout=${timeoutMs}ms duration=${durationMs}ms signal=${signal}）。詳細はlocal logを確認してください。`;
  }
  const message = String(error?.message ?? error);
  return `提案生成に失敗しました: ${message.slice(0, 2000)}`;
}

export function buildLedgerSummary(posts, metricCandidates = null) {
  const mature = posts.filter((entry) => entry.metrics?.mature === true);
  const dimensions = METRIC_DIMENSIONS;
  const candidates = metricCandidates ?? buildMetricCandidates(mature);
  const counts = dimensions.map(({ name, getValue }) => {
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
    `利用可能metric candidate JSON（Node生成、sampleSize 5以上）: ${JSON.stringify(candidates)}`,
  ].join("\n");
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
if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await runWithLocalLog({ cwd: process.cwd(), automationId: "x-growth-improve", command: `npm run x:growth-improve ${process.argv.slice(2).join(" ")}` }, main));

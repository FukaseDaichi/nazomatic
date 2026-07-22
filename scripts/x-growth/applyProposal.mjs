import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { validateProposal } from "./proposalSchema.mjs";

export async function applyChangeToFile(cwd, proposal) {
  const target = validateProposal(proposal);
  if (!target.ok) {
    return { ok: false, reason: target.reason };
  }
  const filePath = path.join(cwd, proposal.path);
  const before = await fs.readFile(filePath, "utf8").catch(() => null);
  if (before == null) {
    return { ok: false, reason: `file not found: ${proposal.path}` };
  }
  const { find, replace } = proposal.change;
  const occurrences = before.split(find).length - 1;
  if (occurrences !== 1) {
    return {
      ok: false,
      reason: `change.find must match exactly once (found ${occurrences})`,
    };
  }
  const after = before.replace(find, () => replace);
  if (proposal.path.endsWith(".json")) {
    try {
      JSON.parse(after);
    } catch (error) {
      return { ok: false, reason: `result is not valid JSON: ${error.message}` };
    }
  }
  await fs.writeFile(filePath, after);
  return { ok: true, before, after };
}

export function buildExperimentBranch({ issueNumber, plannedEvaluateWeek, proposal }) {
  const slug = proposal.path.split("/").pop().replace(/\W+/g, "-");
  return `x-growth/issue-${issueNumber}-${plannedEvaluateWeek.toLowerCase()}-${slug}`;
}

export async function createExperimentPr(cwd, proposal, { reviewIssue, account, plannedEvaluateWeek, baseSha, proposalBaseline, dryRun } = {}) {
  const branch = buildExperimentBranch({ issueNumber: reviewIssue.number, plannedEvaluateWeek, proposal });
  const title = `[X改善実験] ${proposal.hypothesis}`;
  const metadata = { reviewIssue: reviewIssue.number, account, targetKey: proposal.targetKey, plannedEvaluateWeek, metric: proposal.metric, baseSha, proposalBaseline };
  const body = [
    `## 仮説`,
    proposal.hypothesis,
    ``,
    `## 変更内容`,
    `- ファイル: \`${proposal.path}\``,
    `- 種別: ${proposal.kind}`,
    ``,
    `## 評価条件`,
    `- 指標: ${proposal.metric.name}`,
    `- 計測期間: ${proposal.metric.windowDays}日`,
    ``,
    `## 評価予定週`,
    plannedEvaluateWeek,
    ``,
    `## 根拠`,
    proposal.rationale,
    ``, `Closes #${reviewIssue.number}`,
    ``,
    `<!-- x-growth-experiment:v1 ${JSON.stringify(metadata)} -->`,
  ].join("\n");

  const steps = [
    ["git", ["add", proposal.path]],
    ["git", ["commit", "-m", title]],
    ["git", ["push", "--set-upstream", "origin", branch]],
    [
      "gh",
      ["pr", "create", "--draft", "--base", "main", "--head", branch, "--label", "x-growth-experiment", "--title", title, "--body", body],
    ],
  ];
  if (dryRun) {
    return { branch, steps };
  }
  let prUrl = null;
  for (const [command, args] of steps) {
    const out = await runGit(cwd, command, args);
    if (command === "gh") {
      prUrl = out.trim().split(/\s+/).find((t) => t.startsWith("http")) ?? null;
    }
  }
  return { branch, prUrl };
}

function runGit(cwd, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} ${args.join(" ")} failed: ${stderr || stdout}`))
    );
  });
}

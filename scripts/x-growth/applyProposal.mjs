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

export async function createExperimentPr(cwd, proposal, { issueUrl, dryRun } = {}) {
  const slug = proposal.path.split("/").pop().replace(/\W+/g, "-");
  const branch = `x-growth/experiment-${proposal.evaluateWeek}-${slug}`;
  const title = `[X改善実験] ${proposal.hypothesis}`;
  const body = [
    `## 仮説`,
    proposal.hypothesis,
    ``,
    `## 変更内容`,
    `- ファイル: \`${proposal.path}\``,
    `- 種別: ${proposal.kind}`,
    ``,
    `## 評価指標`,
    proposal.metric,
    ``,
    `## 評価予定週`,
    proposal.evaluateWeek,
    ``,
    `## 根拠`,
    proposal.rationale,
    ...(issueUrl ? [``, `関連: ${issueUrl}`] : []),
    ``,
    `<!-- x-growth-experiment: 1 PR = 1 実験。効果検証まで revert しない。自動マージ禁止。 -->`,
  ].join("\n");

  const steps = [
    ["git", ["switch", "-c", branch]],
    ["git", ["add", proposal.path]],
    ["git", ["commit", "-m", title]],
    [
      "gh",
      ["pr", "create", "--draft", "--title", title, "--body", body],
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

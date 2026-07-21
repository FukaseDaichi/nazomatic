#!/usr/bin/env node
import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { pathToFileURL } from "url";

import { readBrowserPostLedger } from "./x-browser-posting/postLedger.mjs";
import { runWithLocalLog } from "./x-browser-posting/runLog.mjs";
import { EXPERIMENT_ALLOWLIST } from "./x-growth/experimentAllowlist.mjs";
import {
  buildProposalOutputSchema,
  validateProposal,
} from "./x-growth/proposalSchema.mjs";
import {
  applyChangeToFile,
  createExperimentPr,
} from "./x-growth/applyProposal.mjs";
import {
  revertChangedFile,
  verifyChangedFile,
} from "./x-growth/verifyChange.mjs";

export async function runImprovementCycle({
  cwd,
  reviewMarkdown,
  ledgerSummary,
  callCodex,
  execute,
  issueUrl,
}) {
  let proposal;
  try {
    proposal = await callCodex({
      reviewMarkdown,
      ledgerSummary,
      allowlist: EXPERIMENT_ALLOWLIST,
    });
  } catch (error) {
    return { status: "rejected", reason: `codex proposal failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  const validated = validateProposal(proposal);
  if (!validated.ok) {
    return { status: "rejected", reason: validated.reason, proposal };
  }
  if (!execute) {
    return { status: "proposed", proposal: validated.proposal };
  }
  const applied = await applyChangeToFile(cwd, validated.proposal);
  if (!applied.ok) {
    return { status: "rejected", reason: applied.reason, proposal: validated.proposal };
  }
  // 適用後の検証ゲート: tsc/lint/構文が通らなければ変更を破棄し PR を作らない。
  const verified = await verifyChangedFile(cwd, validated.proposal.path);
  if (!verified.ok) {
    await revertChangedFile(cwd, validated.proposal.path);
    return {
      status: "rejected",
      reason: `verification failed: ${verified.reason}`,
      proposal: validated.proposal,
    };
  }
  const pr = await createExperimentPr(cwd, validated.proposal, { issueUrl });
  return { status: "pr_created", proposal: validated.proposal, ...pr };
}

// codex exec を read-only で呼び、提案 JSON を返す（本番用 callCodex）。
export async function runCodexProposal({
  cwd,
  reviewMarkdown,
  ledgerSummary,
  allowlist,
  model,
  timeoutMs = 120000,
}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-improve-"));
  const schemaPath = path.join(tempDir, "schema.json");
  const outputPath = path.join(tempDir, "out.json");
  try {
    await fs.writeFile(
      schemaPath,
      JSON.stringify(buildProposalOutputSchema(), null, 2)
    );
    const prompt = buildPrompt({ reviewMarkdown, ledgerSummary, allowlist });
    const args = ["exec"];
    if (model) {
      args.push("--model", model);
    }
    args.push(
      "--cd",
      cwd,
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "-"
    );
    const result = await runChild("codex", args, { cwd, input: prompt, timeoutMs });
    if (result.exitCode !== 0) {
      throw new Error(`codex exited ${result.exitCode}: ${result.stderr}`);
    }
    const text =
      (await fs.readFile(outputPath, "utf8").catch(() => "")) || result.stdout;
    return JSON.parse(text);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function buildPrompt({ reviewMarkdown, ledgerSummary, allowlist }) {
  return [
    "あなたは NAZOMATIC の X 運用改善アシスタントです。",
    "次週に試す実験を『1件だけ・1ファイルだけ』提案し、指定スキーマの JSON を出力してください。",
    "制約:",
    "- 編集してよいのは以下の allowlist のパスのみ。rate limit・--execute・config・.env・.github は絶対に触らない。",
    ...allowlist.map((e) => `  - ${e.path}（${e.note}）`),
    "- change.find は対象ファイル内にちょうど1回だけ現れる完全一致文字列にする。",
    "- ts-copy では投稿ロジック・validator・認証・外部呼び出しに触れず、文言や数値閾値の中身だけを変える。",
    "- 投稿頻度を増やす提案はしない。質・時間帯・型・文言の実験に限る。",
    "",
    "## 直近の週次レビュー",
    reviewMarkdown,
    "",
    "## 台帳サマリ",
    ledgerSummary,
  ].join("\n");
}

async function fetchLatestReviewMarkdown(cwd) {
  try {
    const out = await runChild(
      "gh",
      [
        "issue",
        "list",
        "--state",
        "all",
        "--search",
        "[X週次レビュー] in:title",
        "--json",
        "title,body,updatedAt",
        "--limit",
        "5",
      ],
      { cwd, timeoutMs: 20000 }
    );
    if (out.exitCode !== 0) {
      return "（週次レビューIssueを取得できませんでした）";
    }
    const items = JSON.parse(out.stdout || "[]").filter(
      (i) => typeof i.title === "string" && i.title.startsWith("[X週次レビュー]")
    );
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return items[0]?.body || "（週次レビューIssueが見つかりませんでした）";
  } catch {
    return "（週次レビューIssueを取得できませんでした）";
  }
}

async function buildLedgerSummary(cwd) {
  const ledger = await readBrowserPostLedger({ cwd });
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = ledger.entries.filter(
    (e) => new Date(e.postedAt).getTime() >= since
  );
  const byType = {};
  for (const e of recent) {
    const key = e.postType ?? "unknown";
    byType[key] = (byType[key] ?? 0) + 1;
  }
  const withMetrics = recent.filter(
    (e) => e.metrics && e.metrics.views != null
  ).length;
  return [
    `直近7日の投稿: ${recent.length}件`,
    `種別内訳: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(" / ") || "なし"}`,
    `公開数値取得済み: ${withMetrics}件`,
  ].join("\n");
}

function runChild(command, args, { cwd, input, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    if (input) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

function parseArgs(argv) {
  const args = { execute: false, issueUrl: null, model: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--execute") {
      args.execute = true;
    } else if (a === "--issue-url") {
      args.issueUrl = argv[i + 1];
      i += 1;
    } else if (a === "--model") {
      args.model = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function printResult(result) {
  console.log(`status: ${result.status}`);
  if (result.reason) {
    console.log(`reason: ${result.reason}`);
  }
  if (result.proposal) {
    console.log(`hypothesis: ${result.proposal.hypothesis}`);
    console.log(`path: ${result.proposal.path} (${result.proposal.kind})`);
    console.log(`evaluateWeek: ${result.proposal.evaluateWeek}`);
  }
  if (result.status === "proposed") {
    console.log("dry-run のため PR は作成しません。--execute で PR まで実行します。");
  }
  if (result.prUrl) {
    console.log(`PR: ${result.prUrl}`);
  } else if (result.branch) {
    console.log(`branch: ${result.branch}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const reviewMarkdown = await fetchLatestReviewMarkdown(cwd);
  const ledgerSummary = await buildLedgerSummary(cwd);
  const result = await runImprovementCycle({
    cwd,
    reviewMarkdown,
    ledgerSummary,
    callCodex: (input) => runCodexProposal({ cwd, ...input, model: args.model }),
    execute: args.execute,
    issueUrl: args.issueUrl,
  });
  printResult(result);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitStatus = await runWithLocalLog(
    {
      cwd: process.cwd(),
      automationId: "x-growth-improve",
      command: `npm run x:growth-improve${process.argv.slice(2).length ? ` -- ${process.argv.slice(2).join(" ")}` : ""}`,
    },
    main
  );
  process.exit(exitStatus);
}

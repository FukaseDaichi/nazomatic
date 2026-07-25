#!/usr/bin/env node

import { pathToFileURL } from "url";

import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import { openCdpChromePage } from "./x-browser-posting/cdpChromePage.mjs";
import { capturePostMetrics } from "./x-browser-posting/growthTelemetry.mjs";
import { recordFollowerSnapshot } from "./x-browser-posting/followerSnapshots.mjs";
import { readBrowserPostLedger } from "./x-browser-posting/postLedger.mjs";
import { telemetryHealth } from "./x-growth/reportMetrics.mjs";
import { runWithLocalLog } from "./x-browser-posting/runLog.mjs";
import { ACTIVE_LABEL, ATTENTION_LABEL, addLabels, comment, findProductionDeployment, getJstIsoWeek, listExperimentPrs, runGit, updateExperimentMetadata } from "./x-growth/githubExperiments.mjs";

function parseArgs(argv) {
  const args = { metricsMaxPerRun: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--metrics-max-per-run") {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value < 0) throw new Error("--metrics-max-per-run requires a non-negative integer");
      args.metricsMaxPerRun = value;
    } else {
      throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }
  return args;
}

export async function maintainGrowthTelemetry({ config, page }) {
  const stats = await page.readProfileStats(config.accountHandle);
  if (stats?.followers != null || stats?.posts != null) {
    await recordFollowerSnapshot(config.cwd, {
      capturedAt: new Date().toISOString(), accountHandle: config.accountHandle,
      followers: stats.followers, posts: stats.posts, source: "growth-maintain",
    });
  }
  const captured = await capturePostMetrics(page, config);
  const ledger = await readBrowserPostLedger(config);
  const entries = ledger.entries.filter((entry) => entry.accountHandle === config.accountHandle);
  const telemetry = telemetryHealth(entries);
  const activation = await reconcileExperimentActivation({ cwd: config.cwd, telemetry });
  return { followers: stats?.followers ?? null, posts: stats?.posts ?? null, metricsCaptured: captured, telemetry, activation };
}

export async function reconcileExperimentActivation({ cwd, telemetry }) {
  await runGit(cwd, ["fetch", "--prune", "origin", "main"]);
  const prs = await listExperimentPrs(cwd);
  const results = [];
  for (const pr of prs.filter((item) => item.mergedAt && !item.labels.includes(ACTIVE_LABEL) && !item.labels.includes("x-growth:keep") && !item.labels.includes("x-growth:reverted") && !item.labels.includes(ATTENTION_LABEL))) {
    const mergeSha = pr.mergeCommit?.oid ?? pr.headRefOid;
    if (!mergeSha) {
      results.push({ pr: pr.number, status: "activation_pending", reason: "merge commit is unavailable" });
      continue;
    }
    const deployment = await findProductionDeployment(cwd, mergeSha);
    if (!deployment) {
      results.push({ pr: pr.number, status: "activation_pending" });
      continue;
    }
    if (telemetry.eligible < 5 || telemetry.rate < 0.7) {
      const marker = { pr: pr.number, deployedCommit: deployment.sha, deployedAt: deployment.deployedAt, reason: "insufficient_telemetry", sampleSize: telemetry.mature, telemetryMaturityRate: telemetry.rate };
      await comment(cwd, pr.number, `## 実験開始を保留\n\nproduction デプロイは確認できましたが、テレメトリが不足しています。\n\n<!-- x-growth-activation-blocked:v1 ${JSON.stringify(marker)} -->`);
      await addLabels(cwd, pr.number, [ATTENTION_LABEL]);
      results.push({ pr: pr.number, status: "activation_blocked_insufficient_telemetry" });
      continue;
    }
    const metric = pr.metadata?.metric ?? {};
    const activeAt = deployment.deployedAt ?? new Date().toISOString();
    const effectiveEvaluateWeek = getJstIsoWeek(new Date(new Date(activeAt).getTime() + (metric.windowDays ?? 14) * 86400000));
    const marker = { pr: pr.number, mergeCommit: mergeSha, deployedCommit: deployment.sha, activeAt, effectiveEvaluateWeek, evaluationBaseline: pr.metadata?.proposalBaseline ?? null };
    await updateExperimentMetadata(cwd, pr, { ...pr.metadata, plannedEvaluateWeek: effectiveEvaluateWeek });
    await comment(cwd, pr.number, `## 実験を開始\n\nproduction deployment を確認しました。\n\n<!-- x-growth-activation:v1 ${JSON.stringify(marker)} -->`);
    await addLabels(cwd, pr.number, [ACTIVE_LABEL]);
    results.push({ pr: pr.number, status: "activated", activeAt });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadBrowserPostConfig([], process.cwd());
  const page = await openCdpChromePage(config.cdpUrl, { bringToFront: config.bringToFront });
  try {
    await page.verifyLoggedInAccount(config.accountHandle);
    const result = await maintainGrowthTelemetry({ config: { ...config, metricsMaxPerRun: args.metricsMaxPerRun ?? config.metricsMaxPerRun }, page });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await page.close?.().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await runWithLocalLog({ cwd: process.cwd(), automationId: "x-growth-maintain", command: `npm run x:growth-maintain ${process.argv.slice(2).join(" ")}` }, main));
}

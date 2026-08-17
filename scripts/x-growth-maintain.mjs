#!/usr/bin/env node

import { pathToFileURL } from "url";

import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import { openCdpChromePage } from "./x-browser-posting/cdpChromePage.mjs";
import { capturePostMetrics } from "./x-browser-posting/growthTelemetry.mjs";
import { recordFollowerSnapshot } from "./x-browser-posting/followerSnapshots.mjs";
import { readBrowserPostLedger } from "./x-browser-posting/postLedger.mjs";
import { telemetryHealth } from "./x-growth/reportMetrics.mjs";
import { runWithLocalLog } from "./x-browser-posting/runLog.mjs";
import { ACTIVE_LABEL, ATTENTION_LABEL, KEEP_LABEL, REVERT_LABEL, addLabels, classifyExperiment, comment, editLabels, findProductionDeployment, getExperimentPr, getJstIsoWeek, listExperimentPrs, runGit, updateExperimentMetadata } from "./x-growth/githubExperiments.mjs";

export const AUTO_KEEP_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

const DEFAULT_EXPERIMENT_OPERATIONS = {
  addLabels,
  comment,
  editLabels,
  findProductionDeployment,
  getExperimentPr,
  listExperimentPrs,
  runGit,
  updateExperimentMetadata,
};

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

export async function prepareGrowthMaintenancePage({ accountHandle, page }) {
  await page.goto(`https://x.com/${accountHandle}`);
  await page.assertNoBlockingState();
  return page.verifyLoggedInAccount(accountHandle);
}

export function evaluateAutoKeepSchedule(metadata, now = new Date()) {
  const checkedAt = new Date(now);
  if (!Number.isFinite(checkedAt.getTime())) {
    throw new Error("auto keep check time is invalid");
  }
  if (metadata?.activeAt == null) {
    const activeAt = checkedAt.toISOString();
    return {
      status: "pending",
      activeAt,
      autoKeepAt: new Date(checkedAt.getTime() + AUTO_KEEP_DELAY_MS).toISOString(),
      metadataChanged: true,
      migrated: true,
    };
  }
  const activeAtDate = new Date(metadata.activeAt);
  if (!Number.isFinite(activeAtDate.getTime())) {
    return { status: "invalid", reason: "activeAt is invalid" };
  }
  const activeAt = activeAtDate.toISOString();
  const autoKeepAt = new Date(activeAtDate.getTime() + AUTO_KEEP_DELAY_MS).toISOString();
  return {
    status: checkedAt.getTime() >= new Date(autoKeepAt).getTime() ? "due" : "pending",
    activeAt,
    autoKeepAt,
    metadataChanged: metadata.activeAt !== activeAt || metadata.autoKeepAt !== autoKeepAt,
    migrated: false,
  };
}

export async function reconcileExperimentActivation({ cwd, telemetry, now = new Date(), operations = {} }) {
  const ops = { ...DEFAULT_EXPERIMENT_OPERATIONS, ...operations };
  await ops.runGit(cwd, ["fetch", "--prune", "origin", "main"]);
  const prs = await ops.listExperimentPrs(cwd);
  const results = [];
  for (const pr of prs.filter((item) => (item.mergedAt || item.state === "MERGED") && classifyExperiment(item).blocking)) {
    const lifecycle = classifyExperiment(pr);
    if (!pr.metadata) {
      if (lifecycle.phase !== "needs_attention") {
        await ops.comment(cwd, pr.number, "## 実験開始を保留\n\nexperiment metadata marker が欠損または不正なため、自動 activation を停止しました。");
        await ops.addLabels(cwd, pr.number, [ATTENTION_LABEL]);
        results.push({ pr: pr.number, status: "activation_blocked_invalid_metadata" });
      }
      continue;
    }
    if (lifecycle.phase === "active") {
      const schedule = evaluateAutoKeepSchedule(pr.metadata, now);
      if (schedule.status === "invalid") {
        await ops.comment(cwd, pr.number, "## 自動 keep を保留\n\nactivation metadata の時刻が不正なため、自動 keep を停止しました。");
        await ops.addLabels(cwd, pr.number, [ATTENTION_LABEL]);
        results.push({ pr: pr.number, status: "auto_keep_blocked_invalid_metadata" });
        continue;
      }
      const scheduledMetadata = schedule.metadataChanged
        ? {
            ...pr.metadata,
            activeAt: schedule.activeAt,
            autoKeepAt: schedule.autoKeepAt,
            plannedEvaluateWeek: getJstIsoWeek(new Date(schedule.autoKeepAt)),
          }
        : pr.metadata;
      if (schedule.metadataChanged) {
        await ops.updateExperimentMetadata(cwd, pr, scheduledMetadata);
      }
      if (schedule.migrated) {
        await ops.comment(cwd, pr.number, `## 自動 keep の確認期間を開始\n\n既存の active 実験に開始時刻がなかったため、この時点から72時間の確認期間を開始します。問題がある場合は \`${REVERT_LABEL}\` label を付けてください。\n\n<!-- x-growth-auto-keep-scheduled:v1 ${JSON.stringify({ pr: pr.number, activeAt: schedule.activeAt, autoKeepAt: schedule.autoKeepAt })} -->`);
      }
      if (schedule.status !== "due") {
        results.push({ pr: pr.number, status: "auto_keep_pending", autoKeepAt: schedule.autoKeepAt });
        continue;
      }
      const current = await ops.getExperimentPr(cwd, pr.number);
      const currentLifecycle = classifyExperiment(current);
      if (currentLifecycle.phase !== "active") {
        results.push({ pr: pr.number, status: "auto_keep_skipped", phase: currentLifecycle.phase });
        continue;
      }
      if (!current.metadata) {
        await ops.comment(cwd, pr.number, "## 自動 keep を保留\n\nexperiment metadata marker が欠損または不正なため、自動 keep を停止しました。");
        await ops.addLabels(cwd, pr.number, [ATTENTION_LABEL]);
        results.push({ pr: pr.number, status: "auto_keep_blocked_invalid_metadata" });
        continue;
      }
      const currentSchedule = evaluateAutoKeepSchedule(current.metadata, now);
      if (currentSchedule.status === "invalid") {
        await ops.comment(cwd, pr.number, "## 自動 keep を保留\n\nactivation metadata の時刻が不正なため、自動 keep を停止しました。");
        await ops.addLabels(cwd, pr.number, [ATTENTION_LABEL]);
        results.push({ pr: pr.number, status: "auto_keep_blocked_invalid_metadata" });
        continue;
      }
      if (currentSchedule.status !== "due") {
        results.push({ pr: pr.number, status: "auto_keep_skipped", phase: currentLifecycle.phase });
        continue;
      }
      await ops.editLabels(cwd, pr.number, { add: [KEEP_LABEL], remove: [ACTIVE_LABEL] });
      await ops.comment(cwd, pr.number, `## 実験を自動 keep\n\nProduction activation から72時間、revert または要手動対応の指定がなかったため、この変更を継続します。\n\n<!-- x-growth-auto-keep:v1 ${JSON.stringify({ pr: pr.number, activeAt: currentSchedule.activeAt, autoKeepAt: currentSchedule.autoKeepAt, keptAt: new Date(now).toISOString() })} -->`);
      results.push({ pr: pr.number, status: "auto_kept", keptAt: new Date(now).toISOString() });
      continue;
    }
    if (lifecycle.phase !== "pending_activation") continue;
    const mergeSha = pr.mergeCommit?.oid ?? pr.headRefOid;
    if (!mergeSha) {
      results.push({ pr: pr.number, status: "activation_pending", reason: "merge commit is unavailable" });
      continue;
    }
    const deployment = await ops.findProductionDeployment(cwd, mergeSha);
    if (!deployment) {
      results.push({ pr: pr.number, status: "activation_pending" });
      continue;
    }
    if (telemetry.eligible < 5 || telemetry.rate < 0.7) {
      const marker = { pr: pr.number, deployedCommit: deployment.sha, deployedAt: deployment.deployedAt, reason: "insufficient_telemetry", sampleSize: telemetry.mature, telemetryMaturityRate: telemetry.rate };
      await ops.comment(cwd, pr.number, `## 実験開始を保留\n\nproduction デプロイは確認できましたが、テレメトリが不足しています。\n\n<!-- x-growth-activation-blocked:v1 ${JSON.stringify(marker)} -->`);
      await ops.addLabels(cwd, pr.number, [ATTENTION_LABEL]);
      results.push({ pr: pr.number, status: "activation_blocked_insufficient_telemetry" });
      continue;
    }
    const activeAt = deployment.deployedAt ?? new Date(now).toISOString();
    const autoKeepAt = new Date(new Date(activeAt).getTime() + AUTO_KEEP_DELAY_MS).toISOString();
    const effectiveEvaluateWeek = getJstIsoWeek(new Date(autoKeepAt));
    const marker = { pr: pr.number, mergeCommit: mergeSha, deployedCommit: deployment.sha, activeAt, autoKeepAt };
    await ops.updateExperimentMetadata(cwd, pr, { ...pr.metadata, activeAt, autoKeepAt, plannedEvaluateWeek: effectiveEvaluateWeek });
    await ops.comment(cwd, pr.number, `## 実験を開始\n\nproduction deployment を確認しました。72時間以内に問題があれば \`${REVERT_LABEL}\` label を付けてください。指定がなければ自動 keep します。\n\n<!-- x-growth-activation:v1 ${JSON.stringify(marker)} -->`);
    await ops.addLabels(cwd, pr.number, [ACTIVE_LABEL]);
    results.push({ pr: pr.number, status: "activated", activeAt });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadBrowserPostConfig([], process.cwd());
  const page = await openCdpChromePage(config.cdpUrl, { bringToFront: config.bringToFront });
  try {
    await prepareGrowthMaintenancePage({
      accountHandle: config.accountHandle,
      page,
    });
    const result = await maintainGrowthTelemetry({ config: { ...config, metricsMaxPerRun: args.metricsMaxPerRun ?? config.metricsMaxPerRun }, page });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await page.close?.().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await runWithLocalLog({ cwd: process.cwd(), automationId: "x-growth-maintain", command: `npm run x:growth-maintain ${process.argv.slice(2).join(" ")}` }, main));
}

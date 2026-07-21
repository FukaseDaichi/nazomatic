import {
  readBrowserPostLedger,
  updateBrowserPostMetrics,
} from "./postLedger.mjs";
import { recordFollowerSnapshot } from "./followerSnapshots.mjs";

// 投稿が成立した実行に相乗りして、ログイン済み CDP セッションから
// フォロワー数と、投稿から24時間前後を過ぎた過去投稿の公開数値を取得し、
// フォロワー台帳と投稿台帳へ記録する。
//
// 方針:
// - 実投稿の後だけ呼ぶ。取得はベストエフォートで、失敗しても投稿処理を巻き込まない。
// - 各投稿の数値取得は成熟後に1回だけ行い、mature フラグで再取得しない。
// - 追加のページ遷移は METRICS_MAX_PER_RUN で上限を設け、自動化の足跡を抑える。

const METRIC_MATURITY_MIN_MS = 20 * 60 * 60 * 1000;
const METRIC_MATURITY_MAX_MS = 8 * 24 * 60 * 60 * 1000;

export async function captureGrowthTelemetry(session, config) {
  const page = session?.cdpPage;
  if (!config?.captureTelemetry || !page) {
    return { followers: null, postMetricsCaptured: 0 };
  }

  const summary = { followers: null, postMetricsCaptured: 0 };

  try {
    const stats = await page.readProfileStats(config.accountHandle);
    if (stats && (stats.followers != null || stats.posts != null)) {
      await recordFollowerSnapshot(config.cwd, {
        capturedAt: new Date().toISOString(),
        accountHandle: config.accountHandle,
        followers: stats.followers,
        posts: stats.posts,
        source: "post-run",
      });
      summary.followers = stats.followers;
    }
  } catch (error) {
    console.warn(
      `Follower snapshot capture skipped: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  try {
    summary.postMetricsCaptured = await capturePostMetrics(page, config);
  } catch (error) {
    console.warn(
      `Post metrics capture skipped: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return summary;
}

async function capturePostMetrics(page, config) {
  const maxPerRun = Number.isFinite(config.metricsMaxPerRun)
    ? Math.max(0, config.metricsMaxPerRun)
    : 8;
  if (maxPerRun === 0) {
    return 0;
  }

  const ledger = await readBrowserPostLedger(config);
  const now = Date.now();
  const account = normalizeHandle(config.accountHandle);
  const candidates = ledger.entries
    .filter((entry) => {
      if (normalizeHandle(entry.accountHandle) !== account) {
        return false;
      }
      if (!entry.postedPostURL) {
        return false;
      }
      if (entry.metrics && entry.metrics.mature) {
        return false;
      }
      const age = now - new Date(entry.postedAt).getTime();
      return age >= METRIC_MATURITY_MIN_MS && age <= METRIC_MATURITY_MAX_MS;
    })
    .sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    )
    .slice(0, maxPerRun);

  let captured = 0;
  for (const entry of candidates) {
    const metrics = await page.readPostMetrics(entry.postedPostURL).catch(() => null);
    if (!metrics) {
      continue;
    }
    // 数値が1つも取れなかった（記事はあるが数値が未描画などの一時失敗）場合は
    // mature にせず、次回以降の再取得対象として残す。
    const hasNumeric = ["views", "replies", "reposts", "likes"].some((key) =>
      Number.isFinite(metrics[key])
    );
    const wrote = await updateBrowserPostMetrics(
      config,
      { statusId: entry.statusId, postedPostURL: entry.postedPostURL },
      { ...metrics, capturedAt: new Date().toISOString(), mature: hasNumeric }
    );
    if (wrote && hasNumeric) {
      captured += 1;
    }
  }
  return captured;
}

function normalizeHandle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

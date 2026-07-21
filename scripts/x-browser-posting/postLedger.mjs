import fs from "fs/promises";
import path from "path";

const LEDGER_VERSION = 1;
const MAX_LEDGER_ENTRIES = 1000;

export async function recordBrowserPost(config, entry) {
  const filePath = getBrowserPostLedgerPath(config);
  const ledger = await readBrowserPostLedger(config);
  const normalized = {
    postedAt: new Date().toISOString(),
    accountHandle: config.accountHandle,
    postType: String(entry.postType),
    text: String(entry.text ?? ""),
    postedPostURL: entry.postedPostURL ?? null,
    statusId: extractStatusId(entry.postedPostURL),
    metadata:
      entry.metadata && typeof entry.metadata === "object"
        ? entry.metadata
        : {},
  };
  const next = {
    version: LEDGER_VERSION,
    maxEntries: MAX_LEDGER_ENTRIES,
    entries: [normalized, ...ledger.entries].slice(0, MAX_LEDGER_ENTRIES),
  };
  await writeJsonFileAtomic(filePath, next);
  return normalized;
}

export async function readBrowserPostLedger(config) {
  const filePath = getBrowserPostLedgerPath(config);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    return {
      version: LEDGER_VERSION,
      maxEntries: MAX_LEDGER_ENTRIES,
      entries: Array.isArray(parsed?.entries)
        ? parsed.entries.filter(
            (entry) => entry && typeof entry === "object"
          )
        : [],
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(
        `Browser post ledger could not be read; starting with an empty ledger: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return {
      version: LEDGER_VERSION,
      maxEntries: MAX_LEDGER_ENTRIES,
      entries: [],
    };
  }
}

// 既存の台帳エントリへ、後追いで取得した表示数・エンゲージメントを合流させる。
// statusId 優先、無ければ postedPostURL で一致させる。該当が無ければ false。
export async function updateBrowserPostMetrics(config, key, metrics) {
  const statusId = key?.statusId ? String(key.statusId) : null;
  const postedPostURL = key?.postedPostURL ?? null;
  if (!statusId && !postedPostURL) {
    return false;
  }
  const filePath = getBrowserPostLedgerPath(config);
  const ledger = await readBrowserPostLedger(config);
  let updated = false;
  const entries = ledger.entries.map((entry) => {
    const matches = statusId
      ? entry.statusId && String(entry.statusId) === statusId
      : entry.postedPostURL === postedPostURL;
    if (!matches) {
      return entry;
    }
    updated = true;
    return {
      ...entry,
      metrics: {
        ...(entry.metrics && typeof entry.metrics === "object"
          ? entry.metrics
          : {}),
        ...metrics,
      },
    };
  });
  if (!updated) {
    return false;
  }
  await writeJsonFileAtomic(filePath, {
    version: LEDGER_VERSION,
    maxEntries: MAX_LEDGER_ENTRIES,
    entries,
  });
  return true;
}

export function getBrowserPostLedgerPath(config) {
  return path.join(config.cwd, "local/x-browser-posting/post-ledger.json");
}

function extractStatusId(url) {
  const match = /\/status\/(\d+)/.exec(String(url ?? ""));
  return match ? match[1] : null;
}

async function writeJsonFileAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

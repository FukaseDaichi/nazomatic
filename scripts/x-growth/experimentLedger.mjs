import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const LEDGER_VERSION = 1;
const MAX_ENTRIES = 500;

export function getExperimentLedgerPath(cwd) {
  return path.join(cwd, "local/x-browser-posting/experiment-ledger.json");
}

export async function readExperiments(cwd) {
  const filePath = getExperimentLedgerPath(cwd);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    return Array.isArray(parsed?.experiments) ? parsed.experiments : [];
  } catch (error) {
    if (error?.code !== "ENOENT") {
      // 破損ファイルを空とみなして上書きすると実験履歴が消えるため、先に退避する。
      await fs
        .rename(filePath, `${filePath}.corrupt-${Date.now()}`)
        .catch(() => {});
    }
    return [];
  }
}

export async function recordExperiment(cwd, experiment) {
  const experiments = await readExperiments(cwd);
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "open",
    hypothesis: String(experiment.hypothesis ?? ""),
    path: String(experiment.path ?? ""),
    kind: String(experiment.kind ?? ""),
    metric: String(experiment.metric ?? ""),
    evaluateWeek: String(experiment.evaluateWeek ?? ""),
    prUrl: experiment.prUrl ?? null,
    baselineNote: experiment.baselineNote ?? null,
  };
  const next = {
    version: LEDGER_VERSION,
    experiments: [entry, ...experiments].slice(0, MAX_ENTRIES),
  };
  await writeJsonFileAtomic(getExperimentLedgerPath(cwd), next);
  return entry;
}

export async function resolveExperiment(cwd, id, { status, resultMetric, verdict } = {}) {
  const experiments = await readExperiments(cwd);
  let found = false;
  const next = experiments.map((entry) => {
    if (entry.id !== id) {
      return entry;
    }
    found = true;
    return {
      ...entry,
      status: status ?? entry.status,
      resultMetric: resultMetric ?? entry.resultMetric ?? null,
      verdict: verdict ?? entry.verdict ?? null,
      resolvedAt: new Date().toISOString(),
    };
  });
  if (!found) {
    return false;
  }
  await writeJsonFileAtomic(getExperimentLedgerPath(cwd), {
    version: LEDGER_VERSION,
    experiments: next,
  });
  return true;
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

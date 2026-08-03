import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ProcessExecutionError, runProcess } from "./processRunner.mjs";

const CACHE_SCHEMA_VERSION = 1;
const CACHE_RETENTION_COUNT = 2;
const COPY_TIMEOUT_MS = 300000;
export const DEPENDENCY_INSTALL_TIMEOUT_MS = 300000;
export const NPM_CI_ARGS = [
  "ci",
  "--prefer-offline",
  "--no-audit",
  "--no-fund",
  "--foreground-scripts",
];

export async function prepareWorktreeWithDependencies({
  tempRoot,
  createWorktree,
  removeWorktree,
  provisionDependencies,
  logger = console,
  maxAttempts = 2,
}) {
  const failures = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const worktreeRoot = path.join(tempRoot, `worktree-${attempt}`);
    try {
      await createWorktree(worktreeRoot);
    } catch (error) {
      return {
        ok: false,
        reason: `dependency worktree creation failed: ${formatError(error)}`,
        failures,
        retryCount: attempt - 1,
      };
    }

    try {
      const dependency = await provisionDependencies({ worktreeRoot, attempt });
      logger.log(
        `dependency_attempt=${attempt} result=success cache=${dependency.cacheStatus}`,
      );
      return {
        ok: true,
        worktreeRoot,
        dependency,
        failures,
        retryCount: attempt - 1,
      };
    } catch (error) {
      const diagnostic = formatError(error);
      failures.push({ attempt, diagnostic });
      logger.warn(`dependency_attempt=${attempt} result=failed\n${diagnostic}`);

      try {
        await removeWorktree(worktreeRoot);
      } catch (cleanupError) {
        const cleanupDiagnostic = formatError(cleanupError);
        failures.push({ attempt, diagnostic: `cleanup failed: ${cleanupDiagnostic}` });
        return {
          ok: false,
          reason: formatAttemptFailures(failures),
          failures,
          retryCount: attempt - 1,
        };
      }

      if (attempt >= maxAttempts || !isRetryableDependencyError(error)) {
        return {
          ok: false,
          reason: formatAttemptFailures(failures),
          failures,
          retryCount: attempt - 1,
        };
      }

      logger.warn(
        `dependency_retry=1 remediation=terminated_process_group,discarded_partial_worktree,fresh_worktree`,
      );
    }
  }

  return {
    ok: false,
    reason: formatAttemptFailures(failures),
    failures,
    retryCount: Math.max(0, maxAttempts - 1),
  };
}

export async function provisionWorktreeDependencies({
  worktreeRoot,
  cacheRoot = resolveDependencyCacheRoot(),
  logger = console,
  runCommand = runProcess,
  copyDirectory = copyDependencyDirectory,
  npmVersion,
  installTimeoutMs = DEPENDENCY_INSTALL_TIMEOUT_MS,
}) {
  const resolvedCacheRoot = await ensureSafeDependencyCacheRoot(cacheRoot);
  const resolvedNpmVersion = npmVersion ?? await readNpmVersion({
    worktreeRoot,
    runCommand,
  });
  const identity = await buildDependencyCacheIdentity({
    worktreeRoot,
    npmVersion: resolvedNpmVersion,
  });
  const cacheEntry = path.join(resolvedCacheRoot, identity.key);
  const destination = path.join(worktreeRoot, "node_modules");

  if (await isReadyCacheEntry(cacheEntry, identity)) {
    try {
      await fs.rm(destination, { recursive: true, force: true });
      await copyDirectory(
        path.join(cacheEntry, "node_modules"),
        destination,
        { runCommand },
      );
      await touchCacheEntry(cacheEntry);
      logger.log(`dependency_cache=hit key=${identity.key}`);
      return { cacheStatus: "hit", cacheKey: identity.key, cacheRoot: resolvedCacheRoot };
    } catch (error) {
      logger.warn(
        `dependency_cache=invalid key=${identity.key} reason=${formatError(error)}`,
      );
      await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
      await fs.rm(cacheEntry, { recursive: true, force: true }).catch(() => {});
    }
  } else {
    await fs.rm(cacheEntry, { recursive: true, force: true }).catch(() => {});
  }

  logger.log(`dependency_cache=miss key=${identity.key}`);
  await runCommand("npm", NPM_CI_ARGS, {
    cwd: worktreeRoot,
    timeoutMs: installTimeoutMs,
  });

  try {
    await populateDependencyCache({
      cacheRoot: resolvedCacheRoot,
      cacheEntry,
      identity,
      source: destination,
      copyDirectory,
      runCommand,
    });
    await pruneDependencyCache(resolvedCacheRoot, identity.key);
    logger.log(`dependency_cache=stored key=${identity.key}`);
  } catch (error) {
    logger.warn(
      `dependency_cache=store_failed key=${identity.key} reason=${formatError(error)}`,
    );
  }

  return { cacheStatus: "miss", cacheKey: identity.key, cacheRoot: resolvedCacheRoot };
}

export async function buildDependencyCacheIdentity({
  worktreeRoot,
  npmVersion,
  nodeVersion = process.version,
  platform = process.platform,
  arch = process.arch,
}) {
  const [packageJson, packageLock] = await Promise.all([
    fs.readFile(path.join(worktreeRoot, "package.json")),
    fs.readFile(path.join(worktreeRoot, "package-lock.json")),
  ]);
  const descriptor = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    packageJsonSha256: sha256(packageJson),
    packageLockSha256: sha256(packageLock),
    nodeVersion,
    npmVersion: String(npmVersion).trim(),
    platform,
    arch,
  };
  return {
    ...descriptor,
    key: sha256(JSON.stringify(descriptor)).slice(0, 32),
  };
}

export function resolveDependencyCacheRoot({
  env = process.env,
  platform = process.platform,
  homedir = os.homedir(),
} = {}) {
  const override = String(env.X_GROWTH_DEPENDENCY_CACHE_DIR ?? "").trim();
  if (override) return validateDependencyCacheRoot(path.resolve(override), homedir);
  if (platform === "darwin") {
    return validateDependencyCacheRoot(path.join(
      homedir,
      "Library",
      "Caches",
      "nazomatic",
      "x-growth-dependencies",
    ), homedir);
  }
  if (platform === "win32") {
    const localAppData = String(env.LOCALAPPDATA ?? "").trim()
      || path.join(homedir, "AppData", "Local");
    return validateDependencyCacheRoot(
      path.join(localAppData, "nazomatic", "x-growth-dependencies"),
      homedir,
    );
  }
  const xdgCache = String(env.XDG_CACHE_HOME ?? "").trim()
    || path.join(homedir, ".cache");
  return validateDependencyCacheRoot(
    path.join(xdgCache, "nazomatic", "x-growth-dependencies"),
    homedir,
  );
}

export function isRetryableDependencyError(error) {
  if (error instanceof ProcessExecutionError) {
    if (error.timedOut || error.signal) return true;
    return hasTransientInstallError(`${error.stdout}\n${error.stderr}`);
  }
  return false;
}

async function readNpmVersion({ worktreeRoot, runCommand }) {
  const result = await runCommand("npm", ["--version"], {
    cwd: worktreeRoot,
    timeoutMs: 30000,
  });
  return result.stdout.trim();
}

async function isReadyCacheEntry(cacheEntry, identity) {
  try {
    const marker = JSON.parse(
      await fs.readFile(path.join(cacheEntry, "ready.json"), "utf8"),
    );
    const nodeModules = await fs.stat(path.join(cacheEntry, "node_modules"));
    return nodeModules.isDirectory()
      && marker.schemaVersion === CACHE_SCHEMA_VERSION
      && marker.key === identity.key
      && marker.packageJsonSha256 === identity.packageJsonSha256
      && marker.packageLockSha256 === identity.packageLockSha256
      && marker.nodeVersion === identity.nodeVersion
      && marker.npmVersion === identity.npmVersion
      && marker.platform === identity.platform
      && marker.arch === identity.arch;
  } catch {
    return false;
  }
}

async function populateDependencyCache({
  cacheRoot,
  cacheEntry,
  identity,
  source,
  copyDirectory,
  runCommand,
}) {
  await fs.mkdir(cacheRoot, { recursive: true });
  const staging = path.join(
    cacheRoot,
    `.${identity.key}.tmp-${process.pid}-${randomUUID()}`,
  );
  try {
    await fs.mkdir(staging, { recursive: true });
    await copyDirectory(source, path.join(staging, "node_modules"), {
      runCommand,
    });
    await fs.writeFile(
      path.join(staging, "ready.json"),
      `${JSON.stringify({
        ...identity,
        createdAt: new Date().toISOString(),
      }, null, 2)}\n`,
    );
    try {
      await fs.rename(staging, cacheEntry);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes(error?.code)) throw error;
      await fs.rm(staging, { recursive: true, force: true });
    }
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function copyDependencyDirectory(source, destination, { runCommand = runProcess } = {}) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  if (process.platform === "darwin") {
    try {
      await runCommand("cp", ["-cR", source, destination], {
        timeoutMs: COPY_TIMEOUT_MS,
      });
      return;
    } catch (error) {
      await fs.rm(destination, { recursive: true, force: true });
      if (error instanceof ProcessExecutionError && error.timedOut) throw error;
    }
  }
  await fs.cp(source, destination, {
    recursive: true,
    force: false,
    errorOnExist: true,
    preserveTimestamps: true,
  });
}

async function touchCacheEntry(cacheEntry) {
  const now = new Date();
  await fs.utimes(cacheEntry, now, now).catch(() => {});
}

async function pruneDependencyCache(cacheRoot, currentKey) {
  const entries = await fs.readdir(cacheRoot, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry) => {
        const entryPath = path.join(cacheRoot, entry.name);
        const stats = await fs.stat(entryPath);
        return { key: entry.name, entryPath, mtimeMs: stats.mtimeMs };
      }),
  );
  candidates.sort((a, b) => {
    if (a.key === currentKey) return -1;
    if (b.key === currentKey) return 1;
    return b.mtimeMs - a.mtimeMs;
  });
  await Promise.all(
    candidates.slice(CACHE_RETENTION_COUNT).map((entry) =>
      fs.rm(entry.entryPath, { recursive: true, force: true })),
  );
}

function hasTransientInstallError(output) {
  return /(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ERR_SOCKET_TIMEOUT|network timeout|fetch failed)/i.test(output);
}

async function ensureSafeDependencyCacheRoot(cacheRoot) {
  const resolved = validateDependencyCacheRoot(cacheRoot, os.homedir());
  try {
    const stats = await fs.lstat(resolved);
    if (stats.isSymbolicLink()) {
      throw new Error("dependency cache root must not be a symbolic link");
    }
    validateDependencyCacheRoot(await fs.realpath(resolved), os.homedir());
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return resolved;
}

function validateDependencyCacheRoot(cacheRoot, homedir) {
  const resolved = path.resolve(cacheRoot);
  const filesystemRoot = path.parse(resolved).root;
  if (
    resolved === filesystemRoot
    || resolved === path.resolve(homedir)
    || resolved === path.resolve(process.cwd())
    || path.basename(resolved) !== "x-growth-dependencies"
  ) {
    throw new Error(
      "X_GROWTH_DEPENDENCY_CACHE_DIR must end with x-growth-dependencies and must not be a filesystem, home, or workspace root",
    );
  }
  return resolved;
}

function formatAttemptFailures(failures) {
  if (!failures.length) return "dependency bootstrap failed without diagnostics";
  return [
    `dependency bootstrap failed after ${Math.max(...failures.map((x) => x.attempt))} attempt(s)`,
    ...failures.map(({ attempt, diagnostic }) =>
      `\n--- dependency attempt ${attempt} ---\n${diagnostic}`),
  ].join("\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

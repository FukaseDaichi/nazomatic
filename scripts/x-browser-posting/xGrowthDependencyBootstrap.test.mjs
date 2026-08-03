import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildDependencyCacheIdentity,
  copyDependencyDirectory,
  prepareWorktreeWithDependencies,
  provisionWorktreeDependencies,
  resolveDependencyCacheRoot,
} from "../x-growth/dependencyBootstrap.mjs";
import {
  ProcessExecutionError,
  runProcess,
} from "../x-growth/processRunner.mjs";

const silentLogger = {
  log() {},
  warn() {},
};

test("process runner reports stdout, stderr, exit code, and duration", async () => {
  await assert.rejects(
    runProcess(
      process.execPath,
      [
        "-e",
        'process.stdout.write("stdout marker"); process.stderr.write("stderr marker"); process.exit(7);',
      ],
      { timeoutMs: 2000 },
    ),
    (error) => {
      assert.equal(error instanceof ProcessExecutionError, true);
      assert.equal(error.exitCode, 7);
      assert.equal(error.timedOut, false);
      assert.match(error.stdout, /stdout marker/);
      assert.match(error.stderr, /stderr marker/);
      assert.match(error.message, /exit_code=7/);
      assert.match(error.message, /duration_ms=/);
      return true;
    },
  );
});

test("process runner marks timeout and terminates the child process group", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-process-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const orphanMarker = path.join(root, "orphan.txt");
  const grandchild = [
    "const fs = require('node:fs');",
    "process.on('SIGTERM', () => {});",
    `setTimeout(() => fs.writeFileSync(${JSON.stringify(orphanMarker)}, 'orphan'), 700);`,
  ].join(" ");
  const parent = [
    "const { spawn } = require('node:child_process');",
    `spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' });`,
    "process.stdout.write('timeout stdout');",
    "process.stderr.write('timeout stderr');",
    "setInterval(() => {}, 1000);",
  ].join(" ");

  await assert.rejects(
    runProcess(process.execPath, ["-e", parent], {
      timeoutMs: 250,
      killGraceMs: 50,
    }),
    (error) => {
      assert.equal(error instanceof ProcessExecutionError, true);
      assert.equal(error.timedOut, true);
      assert.match(error.message, /timed_out=true/);
      assert.match(error.stdout, /timeout stdout/);
      assert.match(error.stderr, /timeout stderr/);
      return true;
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 800));
  await assert.rejects(fs.access(orphanMarker), { code: "ENOENT" });
});

test("dependency cache identity changes with manifests and runtime", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-cache-key-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await writeManifest(root, { version: "1" });

  const first = await buildDependencyCacheIdentity({
    worktreeRoot: root,
    npmVersion: "11.0.0",
    nodeVersion: "v22.0.0",
    platform: "darwin",
    arch: "arm64",
  });
  const same = await buildDependencyCacheIdentity({
    worktreeRoot: root,
    npmVersion: "11.0.0",
    nodeVersion: "v22.0.0",
    platform: "darwin",
    arch: "arm64",
  });
  const differentRuntime = await buildDependencyCacheIdentity({
    worktreeRoot: root,
    npmVersion: "11.0.0",
    nodeVersion: "v26.0.0",
    platform: "darwin",
    arch: "arm64",
  });

  assert.equal(first.key, same.key);
  assert.notEqual(first.key, differentRuntime.key);

  await writeManifest(root, { version: "2" });
  const differentManifest = await buildDependencyCacheIdentity({
    worktreeRoot: root,
    npmVersion: "11.0.0",
    nodeVersion: "v22.0.0",
    platform: "darwin",
    arch: "arm64",
  });
  assert.notEqual(first.key, differentManifest.key);
});

test("dependency cache override rejects broad or ambiguous paths", () => {
  assert.throws(
    () => resolveDependencyCacheRoot({
      env: { X_GROWTH_DEPENDENCY_CACHE_DIR: "/" },
      platform: "linux",
      homedir: "/home/example",
    }),
    /must end with x-growth-dependencies/,
  );
  assert.throws(
    () => resolveDependencyCacheRoot({
      env: { X_GROWTH_DEPENDENCY_CACHE_DIR: "/tmp/shared-cache" },
      platform: "linux",
      homedir: "/home/example",
    }),
    /must end with x-growth-dependencies/,
  );
  assert.equal(
    resolveDependencyCacheRoot({
      env: { X_GROWTH_DEPENDENCY_CACHE_DIR: "/tmp/nazomatic/x-growth-dependencies" },
      platform: "linux",
      homedir: "/home/example",
    }),
    "/tmp/nazomatic/x-growth-dependencies",
  );
});

test("dependency cache copy keeps the cached tree isolated", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-cache-copy-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "cached-node-modules");
  const destination = path.join(root, "worktree-node-modules");
  await fs.mkdir(source, { recursive: true });
  await fs.writeFile(path.join(source, "fixture.txt"), "cached\n");

  await copyDependencyDirectory(source, destination);
  await fs.writeFile(path.join(destination, "fixture.txt"), "worktree\n");

  assert.equal(await fs.readFile(path.join(source, "fixture.txt"), "utf8"), "cached\n");
  assert.equal(await fs.readFile(path.join(destination, "fixture.txt"), "utf8"), "worktree\n");
});

test("dependency provisioning stores and restores a validated installed tree", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-cache-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const cacheRoot = path.join(root, "x-growth-dependencies");
  const firstWorktree = path.join(root, "worktree-1");
  const secondWorktree = path.join(root, "worktree-2");
  await writeManifest(firstWorktree, { version: "1" });
  await writeManifest(secondWorktree, { version: "1" });
  let installCount = 0;
  const runCommand = async (command, args, options) => {
    if (command === "npm" && args[0] === "--version") {
      return { stdout: "11.0.0\n", stderr: "", exitCode: 0 };
    }
    assert.equal(command, "npm");
    assert.equal(args[0], "ci");
    installCount += 1;
    const nodeModules = path.join(options.cwd, "node_modules");
    await fs.mkdir(nodeModules, { recursive: true });
    await fs.writeFile(path.join(nodeModules, "installed.txt"), "ready\n");
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const copyDirectory = (source, destination) =>
    fs.cp(source, destination, { recursive: true });

  const first = await provisionWorktreeDependencies({
    worktreeRoot: firstWorktree,
    cacheRoot,
    runCommand,
    copyDirectory,
    logger: silentLogger,
  });
  const second = await provisionWorktreeDependencies({
    worktreeRoot: secondWorktree,
    cacheRoot,
    runCommand,
    copyDirectory,
    logger: silentLogger,
  });

  assert.equal(first.cacheStatus, "miss");
  assert.equal(second.cacheStatus, "hit");
  assert.equal(first.cacheKey, second.cacheKey);
  assert.equal(installCount, 1);
  assert.equal(
    await fs.readFile(path.join(secondWorktree, "node_modules", "installed.txt"), "utf8"),
    "ready\n",
  );
});

test("dependency bootstrap retries one timeout with a fresh worktree", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-retry-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const created = [];
  const removed = [];
  let provisionCount = 0;

  const result = await prepareWorktreeWithDependencies({
    tempRoot: root,
    createWorktree: async (worktreeRoot) => created.push(worktreeRoot),
    removeWorktree: async (worktreeRoot) => removed.push(worktreeRoot),
    provisionDependencies: async () => {
      provisionCount += 1;
      if (provisionCount === 1) throw timeoutError();
      return { cacheStatus: "miss", cacheKey: "key" };
    },
    logger: silentLogger,
  });

  assert.equal(result.ok, true);
  assert.equal(result.retryCount, 1);
  assert.equal(provisionCount, 2);
  assert.deepEqual(created, [
    path.join(root, "worktree-1"),
    path.join(root, "worktree-2"),
  ]);
  assert.deepEqual(removed, [path.join(root, "worktree-1")]);
  assert.equal(result.worktreeRoot, path.join(root, "worktree-2"));
});

test("dependency bootstrap preserves both diagnostics when the retry fails", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-retry-failure-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let provisionCount = 0;

  const result = await prepareWorktreeWithDependencies({
    tempRoot: root,
    createWorktree: async () => {},
    removeWorktree: async () => {},
    provisionDependencies: async () => {
      provisionCount += 1;
      throw processError({
        timedOut: true,
        signal: "SIGKILL",
        stderr: `attempt-${provisionCount}`,
      });
    },
    logger: silentLogger,
  });

  assert.equal(result.ok, false);
  assert.equal(result.retryCount, 1);
  assert.equal(provisionCount, 2);
  assert.match(result.reason, /dependency attempt 1/);
  assert.match(result.reason, /attempt-1/);
  assert.match(result.reason, /dependency attempt 2/);
  assert.match(result.reason, /attempt-2/);
});

test("dependency bootstrap does not retry deterministic install errors", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "x-growth-no-retry-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let createCount = 0;
  let removeCount = 0;

  const result = await prepareWorktreeWithDependencies({
    tempRoot: root,
    createWorktree: async () => { createCount += 1; },
    removeWorktree: async () => { removeCount += 1; },
    provisionDependencies: async () => {
      throw processError({ stderr: "npm error EUSAGE lock file mismatch" });
    },
    logger: silentLogger,
  });

  assert.equal(result.ok, false);
  assert.equal(result.retryCount, 0);
  assert.equal(createCount, 1);
  assert.equal(removeCount, 1);
  assert.match(result.reason, /dependency bootstrap failed after 1 attempt/);
  assert.match(result.reason, /EUSAGE lock file mismatch/);
});

async function writeManifest(root, { version }) {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", version })}\n`,
  );
  await fs.writeFile(
    path.join(root, "package-lock.json"),
    `${JSON.stringify({ name: "fixture", version, lockfileVersion: 3 })}\n`,
  );
}

function timeoutError() {
  return processError({ timedOut: true, signal: "SIGKILL" });
}

function processError({ timedOut = false, signal = null, stderr = "" } = {}) {
  return new ProcessExecutionError({
    command: "npm",
    args: ["ci"],
    cwd: "/tmp/worktree",
    exitCode: timedOut ? null : 1,
    signal,
    timedOut,
    timeoutMs: 300000,
    durationMs: timedOut ? 300001 : 50,
    stdout: "",
    stderr,
    stdoutTruncated: false,
    stderrTruncated: false,
    cause: null,
  });
}

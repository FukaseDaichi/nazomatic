import { spawn } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";

const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const MAX_OUTPUT_BYTES = 256 * 1024;

const GENERATE_INSTRUCTION_PREFIX = [
  "Use the imagegen skill. Built-in image_gen tool path only — do not use the CLI fallback (no OPENAI_API_KEY required).",
  "Generate exactly one image and save it under the current working directory.",
  "After saving, print exactly one line in the form `SAVED: <absolute path>` as your final output.",
  "",
].join("\n");

export function parseSavedImagePaths(stdout) {
  return String(stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.match(/^SAVED:\s*(.+?)\s*$/)?.[1])
    .filter(Boolean);
}

// Codex が誤って無関係のローカル画像パスを報告しても添付しないための境界。
// workDir 配下の realpath かつ生成開始以降に書かれたファイルだけを通す。
export function filterSavedPaths(paths, { workDir, startedAtMs }) {
  let workRoot;
  try {
    workRoot = fsSync.realpathSync(workDir);
  } catch {
    return [];
  }

  return (paths ?? []).filter((filePath) => {
    if (typeof filePath !== "string") {
      return false;
    }
    try {
      const real = fsSync.realpathSync(filePath);
      if (real !== workRoot && !real.startsWith(workRoot + path.sep)) {
        return false;
      }
      return fsSync.statSync(real).mtimeMs >= startedAtMs;
    } catch {
      return false;
    }
  });
}

export function validateGeneratedImage(filePath, { minBytes = 10_000 } = {}) {
  try {
    const stats = fsSync.statSync(filePath);
    if (!stats.isFile() || stats.size < minBytes) {
      return false;
    }
    const fd = fsSync.openSync(filePath, "r");
    try {
      const header = Buffer.alloc(8);
      fsSync.readSync(fd, header, 0, 8, 0);
      return (
        header.equals(PNG_MAGIC) || header.subarray(0, 3).equals(JPEG_MAGIC)
      );
    } finally {
      fsSync.closeSync(fd);
    }
  } catch {
    return false;
  }
}

// 画像はベストエフォート。生成失敗・検証不合格・timeout・想定外の例外はすべて
// null を返し、呼び出し側がテキストのみ投稿へフォールバックする。
export async function generateObservationLogImage({
  prompt,
  workDir,
  timeoutMs = 240_000,
  log = console,
}) {
  try {
    const startedAtMs = Date.now();
    const instruction = `${GENERATE_INSTRUCTION_PREFIX}${prompt}`;
    const stdout = await runCodexExec({ instruction, workDir, timeoutMs, log });
    if (stdout === null) {
      return null;
    }
    const saved = filterSavedPaths(parseSavedImagePaths(stdout), {
      workDir,
      startedAtMs,
    });
    const valid = saved.find((filePath) => validateGeneratedImage(filePath));
    if (!valid) {
      log.warn?.(
        `Observation log image generation returned no valid image (saved: ${
          saved.join(", ") || "none"
        })`
      );
      return null;
    }
    return valid;
  } catch (error) {
    log.warn?.(
      `Observation log image generation failed unexpectedly: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function runCodexExec({ instruction, workDir, timeoutMs, log }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        "codex",
        [
          "exec",
          "--sandbox",
          "workspace-write",
          "--skip-git-repo-check",
          "--ephemeral",
          "-C",
          workDir,
          "--",
          instruction,
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
    } catch (error) {
      log.warn?.(
        `codex exec failed to start: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      resolve(null);
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutHandle;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(value);
    };

    timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      child.kill("SIGKILL");
      log.warn?.(`codex exec timed out after ${timeoutMs}ms`);
      finish(null);
    }, timeoutMs);

    const append = (target, chunk) => {
      if (settled) {
        return;
      }
      const value = chunk.toString("utf8");
      if (target === "stdout") {
        stdout += value;
      } else {
        stderr += value;
      }
      if (
        Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES
      ) {
        log.warn?.("codex exec output exceeded local size limit");
        child.kill("SIGKILL");
        finish(null);
      }
    };

    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => {
      log.warn?.(`codex exec failed to start: ${error.message}`);
      finish(null);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      if (code !== 0) {
        log.warn?.(
          `codex exec exited with ${code}: ${stderr.slice(0, 500)}`
        );
        finish(null);
        return;
      }
      finish(stdout);
    });
  });
}

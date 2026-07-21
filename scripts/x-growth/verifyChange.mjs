import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

export async function verifyChangedFile(cwd, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === ".json") {
    try {
      JSON.parse(await fs.readFile(path.join(cwd, relPath), "utf8"));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: `invalid JSON: ${error.message}` };
    }
  }
  if (ext === ".mjs" || ext === ".js") {
    const r = await run(cwd, "node", ["--check", relPath]);
    return r.code === 0 ? { ok: true } : { ok: false, reason: `node --check failed: ${r.stderr}` };
  }
  if (ext === ".ts" || ext === ".tsx") {
    const tsc = await run(cwd, "npx", ["tsc", "--noEmit"]);
    if (tsc.code !== 0) {
      return { ok: false, reason: `tsc failed: ${tsc.stdout || tsc.stderr}` };
    }
    const lint = await run(cwd, "npm", ["run", "lint"]);
    return lint.code === 0 ? { ok: true } : { ok: false, reason: `lint failed: ${lint.stdout || lint.stderr}` };
  }
  // md 等はそのまま可（doc は構文検証不要）。
  return { ok: true };
}

export async function revertChangedFile(cwd, relPath) {
  await run(cwd, "git", ["checkout", "--", relPath]);
}

function run(cwd, command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", (e) => resolve({ code: 1, stdout, stderr: String(e) }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

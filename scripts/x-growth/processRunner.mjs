import { spawn } from "node:child_process";

const DEFAULT_OUTPUT_LIMIT_BYTES = 512 * 1024;
const DEFAULT_KILL_GRACE_MS = 1000;
const DIAGNOSTIC_OUTPUT_LIMIT_CHARS = 8000;

export class ProcessExecutionError extends Error {
  constructor(details) {
    super(formatProcessFailure(details));
    this.name = "ProcessExecutionError";
    this.command = details.command;
    this.args = [...details.args];
    this.cwd = details.cwd;
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.timedOut = details.timedOut;
    this.timeoutMs = details.timeoutMs;
    this.durationMs = details.durationMs;
    this.stdout = details.stdout;
    this.stderr = details.stderr;
    this.stdoutTruncated = details.stdoutTruncated;
    this.stderrTruncated = details.stderrTruncated;
    this.cause = details.cause;
  }
}

export function runProcess(
  command,
  args,
  {
    cwd,
    input = "",
    timeoutMs = 120000,
    env = process.env,
    killGraceMs = DEFAULT_KILL_GRACE_MS,
    outputLimitBytes = DEFAULT_OUTPUT_LIMIT_BYTES,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const useProcessGroup = process.platform !== "win32";
    const child = spawn(command, args, {
      cwd,
      env,
      detached: useProcessGroup,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let settled = false;
    let timedOut = false;
    let forceKillTimer = null;

    const finish = ({ exitCode = null, signal = null, cause = null } = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (timedOut) terminate("SIGKILL");
      if (forceKillTimer) clearTimeout(forceKillTimer);
      const details = {
        command,
        args,
        cwd,
        exitCode,
        signal,
        timedOut,
        timeoutMs,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
        stdoutTruncated,
        stderrTruncated,
        cause,
      };
      if (!timedOut && !cause && exitCode === 0) {
        resolve(details);
        return;
      }
      reject(new ProcessExecutionError(details));
    };

    const terminate = (signal) => {
      try {
        if (useProcessGroup && child.pid) {
          process.kill(-child.pid, signal);
        } else {
          child.kill(signal);
        }
      } catch (error) {
        if (error?.code !== "ESRCH") {
          stderr = appendOutput(
            stderr,
            `\nprocess termination failed: ${formatError(error)}\n`,
            outputLimitBytes,
          ).value;
        }
      }
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      terminate("SIGTERM");
      forceKillTimer = setTimeout(() => terminate("SIGKILL"), killGraceMs);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      const appended = appendOutput(stdout, chunk, outputLimitBytes);
      stdout = appended.value;
      stdoutTruncated ||= appended.truncated;
    });
    child.stderr.on("data", (chunk) => {
      const appended = appendOutput(stderr, chunk, outputLimitBytes);
      stderr = appended.value;
      stderrTruncated ||= appended.truncated;
    });
    child.on("error", (cause) => finish({ cause }));
    child.on("close", (exitCode, signal) => finish({ exitCode, signal }));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

export function formatProcessFailure(details) {
  const lines = [
    `command=${formatCommand(details.command, details.args)}`,
    `cwd=${details.cwd ?? ""}`,
    `exit_code=${details.exitCode ?? "null"}`,
    `signal=${details.signal ?? "null"}`,
    `timed_out=${Boolean(details.timedOut)}`,
    `timeout_ms=${details.timeoutMs ?? ""}`,
    `duration_ms=${details.durationMs ?? ""}`,
  ];
  if (details.cause) lines.push(`spawn_error=${formatError(details.cause)}`);
  lines.push(
    formatOutputSection("stdout", details.stdout, details.stdoutTruncated),
    formatOutputSection("stderr", details.stderr, details.stderrTruncated),
  );
  return lines.join("\n");
}

function appendOutput(current, chunk, maxBytes) {
  const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
  const combined = Buffer.concat([Buffer.from(current), chunkBuffer]);
  if (combined.byteLength <= maxBytes) {
    return { value: combined.toString("utf8"), truncated: false };
  }
  return {
    value: combined.subarray(combined.byteLength - maxBytes).toString("utf8"),
    truncated: true,
  };
}

function formatOutputSection(name, value, truncated) {
  const text = String(value ?? "");
  const tail = text.length > DIAGNOSTIC_OUTPUT_LIMIT_CHARS
    ? text.slice(-DIAGNOSTIC_OUTPUT_LIMIT_CHARS)
    : text;
  const note = truncated || tail.length < text.length ? " (tail; truncated)" : "";
  return `${name}${note}:\n${tail || "(empty)"}`;
}

function formatCommand(command, args) {
  return [command, ...args].map((value) => JSON.stringify(String(value))).join(" ");
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

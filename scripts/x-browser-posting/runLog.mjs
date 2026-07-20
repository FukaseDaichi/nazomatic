import fs from "fs";
import path from "path";
import { format } from "util";

const DEFAULT_ENV_FILE = ".env.x-browser-posting.local";
const DEFAULT_LOG_RETENTION_COUNT = 70;

export async function runWithLocalLog(
  { cwd, automationId, logPrefix, command, envFile },
  task
) {
  const startedAt = new Date();
  const resolvedAutomationId = normalizeAutomationId(automationId ?? logPrefix);
  const retentionCount = resolveLogRetentionCount({ cwd, envFile });
  const logPath = createLogPath(cwd, resolvedAutomationId, startedAt);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const stream = fs.createWriteStream(logPath, { flags: "a" });
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const writeLine = (line) => {
    stream.write(`${line}\n`);
  };
  const writeConsoleLine = (args) => {
    writeLine(format(...args));
  };

  writeLine(`started_at=${formatJstDateTime(startedAt)}`);
  writeLine(`command=${command}`);

  console.log = (...args) => {
    originalLog(...args);
    writeConsoleLine(args);
  };
  console.error = (...args) => {
    originalError(...args);
    writeConsoleLine(args);
  };
  console.warn = (...args) => {
    originalWarn(...args);
    writeConsoleLine(args);
  };

  let exitStatus = 0;
  try {
    await task();
  } catch (error) {
    exitStatus = 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    writeLine(`finished_at=${formatJstDateTime(new Date())}`);
    writeLine(`exit_status=${exitStatus}`);
    await closeStream(stream);
    pruneLocalLogs({
      logDir: path.dirname(logPath),
      retentionCount,
      warn: originalWarn,
    });
  }

  return exitStatus;
}

function createLogPath(cwd, automationId, date) {
  return path.join(
    cwd,
    "logs",
    automationId,
    `${formatJstFileStamp(date)}-jst.log`
  );
}

function pruneLocalLogs({ logDir, retentionCount, warn }) {
  try {
    const logs = fs
      .readdirSync(logDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map((entry) => {
        const filePath = path.join(logDir, entry.name);
        const stats = fs.statSync(filePath);
        return { filePath, name: entry.name, mtimeMs: stats.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));

    for (const log of logs.slice(retentionCount)) {
      fs.unlinkSync(log.filePath);
    }
  } catch (error) {
    warn(
      `Could not prune local logs in ${logDir}: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

function resolveLogRetentionCount({ cwd, envFile }) {
  const resolvedEnvFile =
    envFile ??
    readArgValue(process.argv.slice(2), "--env-file") ??
    DEFAULT_ENV_FILE;
  const env = {
    ...readEnvFile(path.join(cwd, ".env.local")),
    ...readEnvFile(path.resolve(cwd, resolvedEnvFile)),
    ...process.env,
  };
  return readRetentionCount(env.X_BROWSER_POST_LOG_RETENTION_COUNT);
}

function readRetentionCount(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_LOG_RETENTION_COUNT;
  }
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return DEFAULT_LOG_RETENTION_COUNT;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return parsed > 0 ? parsed : DEFAULT_LOG_RETENTION_COUNT;
}

function readArgValue(argv, name) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) {
      const next = argv[index + 1];
      return next && !next.startsWith("--") ? next : null;
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return null;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    parsed[match[1]] = unquote(match[2].trim());
  }
  return parsed;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeAutomationId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    throw new Error(
      "automationId must contain only lowercase letters, numbers, and hyphens"
    );
  }
  return normalized;
}

function formatJstFileStamp(date) {
  const parts = getJstParts(date);
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

function formatJstDateTime(date) {
  const parts = getJstParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

function getJstParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

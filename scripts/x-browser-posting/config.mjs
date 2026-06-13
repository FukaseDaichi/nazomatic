import fs from "fs";
import os from "os";
import path from "path";

export const DEFAULT_ENV_FILE = ".env.x-browser-posting.local";
export const DEFAULT_HASHTAG = "#謎チケ売ります";
export const DEFAULT_API_BASE_URL = "http://localhost:3000";
export const DEFAULT_COOLDOWN_MINUTES = 120;
export const DEFAULT_DAILY_LIMIT = 6;
export const DEFAULT_MAX_PER_RUN = 1;
export const MIN_COOLDOWN_MINUTES = 30;
export const MAX_DAILY_LIMIT = 8;
export const MAX_PER_RUN = 1;

export function loadBrowserPostConfig(argv, cwd = process.cwd()) {
  const args = parseArgs(argv);
  const envFile = args.envFile ?? DEFAULT_ENV_FILE;
  const env = {
    ...readEnvFile(path.join(cwd, ".env.local")),
    ...readEnvFile(path.resolve(cwd, envFile)),
    ...process.env,
  };

  const execute = args.execute === true;
  const requireConfirmation = readBoolean(
    env.X_BROWSER_POST_REQUIRE_CONFIRMATION,
    true
  );
  const allowUnattended = readBoolean(
    env.X_BROWSER_POST_ALLOW_UNATTENDED,
    false
  );
  const confirmationMode =
    !requireConfirmation && allowUnattended ? "unattended" : "interactive";

  const accountHandle = normalizeHandle(
    args.accountHandle ?? env.X_BROWSER_POST_ACCOUNT_HANDLE ?? ""
  );
  if (!accountHandle) {
    throw new Error(
      "X_BROWSER_POST_ACCOUNT_HANDLE is required in .env.x-browser-posting.local"
    );
  }

  const storageState =
    args.storageState ?? env.X_BROWSER_POST_STORAGE_STATE ?? "";
  const userDataDir =
    args.userDataDir ?? env.X_BROWSER_POST_USER_DATA_DIR ?? "";
  if (!storageState && !userDataDir) {
    throw new Error(
      "Set X_BROWSER_POST_STORAGE_STATE or X_BROWSER_POST_USER_DATA_DIR"
    );
  }

  const cooldownMinutes = readInteger(
    args.cooldownMinutes ?? env.X_BROWSER_POST_COOLDOWN_MINUTES,
    DEFAULT_COOLDOWN_MINUTES
  );
  const dailyLimit = readInteger(
    args.dailyLimit ?? env.X_BROWSER_POST_DAILY_LIMIT,
    DEFAULT_DAILY_LIMIT
  );
  const maxPerRun = readInteger(
    args.maxPerRun ?? env.X_BROWSER_POST_MAX_PER_RUN,
    DEFAULT_MAX_PER_RUN
  );

  assertLimits({ cooldownMinutes, dailyLimit, maxPerRun });

  const apiBaseUrl = stripTrailingSlash(
    firstNonEmpty(
      args.baseUrl,
      env.X_BROWSER_POST_API_BASE_URL,
      env.REALTIME_API_BASE_URL,
      env.NEXT_PUBLIC_BASE_URL,
      DEFAULT_API_BASE_URL
    )
  );
  const internalToken = firstNonEmpty(
    args.token,
    env.X_BROWSER_POST_INTERNAL_TOKEN,
    env.REALTIME_INTERNAL_API_TOKEN,
    env.REALTIME_API_TOKEN,
    ""
  );

  if (!internalToken) {
    throw new Error(
      "Set REALTIME_INTERNAL_API_TOKEN or X_BROWSER_POST_INTERNAL_TOKEN"
    );
  }

  return {
    cwd,
    envFile,
    execute,
    dryRun: !execute,
    confirmationMode,
    accountHandle,
    hashtag: args.hashtag ?? env.X_BROWSER_POST_HASHTAG ?? DEFAULT_HASHTAG,
    comment: args.comment ?? env.X_BROWSER_POST_COMMENT ?? "",
    storageState: storageState ? path.resolve(cwd, storageState) : "",
    userDataDir: userDataDir ? path.resolve(cwd, userDataDir) : "",
    apiBaseUrl,
    internalToken,
    cooldownMinutes,
    dailyLimit,
    maxPerRun,
    browserChannel:
      args.browserChannel ?? env.X_BROWSER_POST_BROWSER_CHANNEL ?? "",
    headless: readBoolean(args.headless ?? env.X_BROWSER_POST_HEADLESS, false),
    keepOpen: readBoolean(
      args.keepOpen ?? env.X_BROWSER_POST_KEEP_OPEN,
      false
    ),
    reservedBy:
      args.reservedBy ??
      env.X_BROWSER_POST_RESERVED_BY ??
      `${os.userInfo().username}@${os.hostname()}`,
  };
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") {
      args.execute = true;
    } else if (arg === "--headless") {
      args.headless = true;
    } else if (arg === "--keep-open") {
      args.keepOpen = true;
    } else if (arg.startsWith("--")) {
      const key = toCamelCase(arg.slice(2));
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      args[key] = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
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

function toCamelCase(input) {
  return input.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function normalizeHandle(value) {
  const normalized = String(value).trim().replace(/^@/, "").toLowerCase();
  if (!normalized) {
    return "";
  }
  if (!/^[a-z0-9_]{1,15}$/.test(normalized)) {
    throw new Error("X_BROWSER_POST_ACCOUNT_HANDLE must be a valid X handle");
  }
  return normalized;
}

function readBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function readInteger(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assertLimits({ cooldownMinutes, dailyLimit, maxPerRun }) {
  if (cooldownMinutes < MIN_COOLDOWN_MINUTES) {
    throw new Error(
      `X_BROWSER_POST_COOLDOWN_MINUTES must be at least ${MIN_COOLDOWN_MINUTES}`
    );
  }
  if (dailyLimit < 1 || dailyLimit > MAX_DAILY_LIMIT) {
    throw new Error(
      `X_BROWSER_POST_DAILY_LIMIT must be between 1 and ${MAX_DAILY_LIMIT}`
    );
  }
  if (maxPerRun < 1 || maxPerRun > MAX_PER_RUN) {
    throw new Error(`X_BROWSER_POST_MAX_PER_RUN must be ${MAX_PER_RUN}`);
  }
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return "";
}

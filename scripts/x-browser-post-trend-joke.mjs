#!/usr/bin/env node

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { spawn } from "child_process";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import { openCdpChromePage } from "./x-browser-posting/cdpChromePage.mjs";
import {
  assertSubmitReady,
  fillComposer,
  openComposer,
  submitPost,
  verifyLoggedInAccount,
} from "./x-browser-posting/xComposerPage.mjs";
import { runWithLocalLog } from "./x-browser-posting/runLog.mjs";

async function main() {
  const { configArgv, trendArgs } = splitTrendJokeArgs(process.argv.slice(2));
  if (trendArgs.help) {
    printHelp();
    return;
  }

  const config = loadBrowserPostConfig(configArgv);
  if (config.loginOnly) {
    await openLoginOnlyBrowser(config);
    return;
  }

  const trendEnv = readTrendEnv(config);
  const requestedRunSlot =
    trendArgs.runSlot ??
    firstNonEmpty(trendEnv.X_BROWSER_POST_TREND_JOKE_RUN_SLOT, null);
  const runSlot =
    requestedRunSlot ?? (await buildNextAutoRunSlot(config, trendArgs.runDate));
  const prepared = await prepareTrendJoke(config, {
    runDate: trendArgs.runDate,
    runSlot,
    queryBundleKey:
      trendArgs.queryBundleKey ??
      firstNonEmpty(trendEnv.X_BROWSER_POST_TREND_JOKE_QUERY_BUNDLE, null),
    searchQueries: trendArgs.searchQueries.length
      ? trendArgs.searchQueries
      : readSearchQueries(trendEnv.X_BROWSER_POST_TREND_JOKE_SEARCH_QUERIES),
    maxSearchQueries:
      trendArgs.maxSearchQueries ??
      readIntegerOrNull(trendEnv.X_BROWSER_POST_TREND_JOKE_MAX_SEARCH_QUERIES),
    maxPostsPerQuery:
      trendArgs.maxPostsPerQuery ??
      readIntegerOrNull(trendEnv.X_BROWSER_POST_TREND_JOKE_MAX_POSTS_PER_QUERY),
    topicKey:
      trendArgs.topicKey ??
      firstNonEmpty(trendEnv.X_BROWSER_POST_TREND_JOKE_TOPIC, null),
  });

  const text =
    (trendArgs.line ?? trendEnv.X_BROWSER_POST_TREND_JOKE_LINE ?? "").trim() ||
    prepared.fallbackText;
  const composedText = validateTrendJokeText(text);
  const localTrendKey = buildLocalTrendKey(config, prepared);

  if (config.execute) {
    await assertLocalRateLimit(config);
    await assertTrendJokeNotPosted(config, localTrendKey, {
      force: trendArgs.forceLocalDuplicate,
    });
  }

  await prepareAutomationRuntime(config);
  const session = await openAutomationSession(config);
  let postSubmitted = false;

  try {
    await session.openComposer();
    const verifiedHandle = await session.verifyLoggedInAccount(
      config.accountHandle
    );
    await session.fillComposer(composedText);
    await session.assertSubmitReady();

    printPreparedTrendJoke({
      prepared,
      composedText,
      verifiedHandle,
      config,
      localTrendKey,
    });

    if (trendArgs.printPrompt) {
      console.log("Copy prompt:");
      console.log(prepared.copyPrompt);
      console.log("");
    }

    if (!config.execute) {
      console.log("Dry-run complete. No post was submitted.");
      return;
    }

    if (config.confirmationMode === "interactive") {
      const allowed = await promptForConfirmation();
      if (!allowed) {
        console.log("Cancelled. No local posted state was written.");
        return;
      }
    }

    const postedPostURL = await session.submitPost(config.accountHandle);
    postSubmitted = true;
    await updateLocalRateState(config);
    await updateTrendJokeState(config, localTrendKey, {
      prepared,
      composedText,
    });
    console.log("Posted trend joke via X browser session.");
    if (postedPostURL) {
      console.log(`Posted URL: ${postedPostURL}`);
    }
  } catch (error) {
    const errorScreenshotPath = await session
      .saveScreenshot("trend-joke-error")
      .catch(() => null);
    if (errorScreenshotPath) {
      console.error(`Error screenshot: ${errorScreenshotPath}`);
    }
    if (postSubmitted) {
      console.error(
        "The post may have been submitted, but local state was not updated."
      );
    }
    throw error;
  } finally {
    if (!config.keepOpen) {
      await session.close();
    }
  }
}

function splitTrendJokeArgs(argv) {
  const configArgv = [];
  const trendArgs = {
    line: null,
    runDate: null,
    runSlot: null,
    queryBundleKey: null,
    searchQueries: [],
    maxSearchQueries: null,
    maxPostsPerQuery: null,
    topicKey: null,
    forceLocalDuplicate: false,
    printPrompt: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--line") {
      trendArgs.line = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--run-date") {
      trendArgs.runDate = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--run-slot") {
      trendArgs.runSlot = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--query-bundle") {
      trendArgs.queryBundleKey = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--query") {
      trendArgs.searchQueries.push(readRequiredArg(argv, index, arg));
      index += 1;
    } else if (arg === "--max-search-queries") {
      trendArgs.maxSearchQueries = readIntegerArg(argv, index, arg);
      index += 1;
    } else if (arg === "--max-posts-per-query") {
      trendArgs.maxPostsPerQuery = readIntegerArg(argv, index, arg);
      index += 1;
    } else if (arg === "--topic") {
      trendArgs.topicKey = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--force-local-duplicate") {
      trendArgs.forceLocalDuplicate = true;
    } else if (arg === "--print-prompt") {
      trendArgs.printPrompt = true;
    } else if (arg === "--help" || arg === "-h") {
      trendArgs.help = true;
    } else {
      configArgv.push(arg);
    }
  }

  return { configArgv, trendArgs };
}

function printHelp() {
  console.log(`Usage:
  npm run x:browser-post:trend-joke -- [options]

Options:
  --execute                         Submit the post. Omit for dry-run.
  --line <text>                     Override the generated one-line post.
  --query-bundle <key>              event_title_general | ticket_title_window | companion_title_window | title_aruaru_words | weekend_title_window
  --query <text>                    Override/add a search query. Can be repeated.
  --topic <topic>                   Override topic when available.
  --run-date <YYYY-MM-DD>           Override the local run date for testing.
  --run-slot <slot>                 Override the local run slot for duplicate guard.
  --max-search-queries <number>     Limit search queries per prepare.
  --max-posts-per-query <number>    Limit posts fetched per query.
  --force-local-duplicate           Ignore local same-slot duplicate guard.
  --print-prompt                    Print the Codex writing prompt.
  --login-only                      Open the login Chrome profile.
`);
}

function readRequiredArg(argv, index, arg) {
  const next = argv[index + 1];
  if (!next || next.startsWith("--")) {
    throw new Error(`${arg} requires a value`);
  }
  return next;
}

function readIntegerArg(argv, index, arg) {
  const value = Number(readRequiredArg(argv, index, arg));
  if (!Number.isFinite(value)) {
    throw new Error(`${arg} requires a numeric value`);
  }
  return Math.floor(value);
}

async function prepareTrendJoke(config, trendArgs) {
  const response = await postJson(
    config,
    "/api/internal/x/browser-post/trend-joke/prepare",
    {
      timezone: "Asia/Tokyo",
      runDate: trendArgs.runDate,
      runSlot: trendArgs.runSlot,
      queryBundleKey: trendArgs.queryBundleKey,
      searchQueries: trendArgs.searchQueries,
      maxSearchQueries: trendArgs.maxSearchQueries,
      maxPostsPerQuery: trendArgs.maxPostsPerQuery,
      topicKey: trendArgs.topicKey,
    }
  );

  return response.body;
}

async function postJson(config, pathname, payload) {
  const response = await fetch(`${config.apiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.internalToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const body = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    const details =
      body && typeof body === "object" ? JSON.stringify(body) : text;
    throw new Error(`API ${pathname} failed (${response.status}): ${details}`);
  }

  return { status: response.status, body };
}

function validateTrendJokeText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Trend joke text must not be empty");
  }
  if (Array.from(trimmed).length >= 180) {
    throw new Error("Trend joke text must be fewer than 180 characters");
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new Error("Trend joke text must be one line");
  }
  if (/https?:\/\//i.test(trimmed)) {
    throw new Error("Trend joke text must not contain URLs");
  }
  if (/[#＃＠@]/.test(trimmed)) {
    throw new Error("Trend joke text must not contain hashtags or mentions");
  }
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    throw new Error("Trend joke text must not contain emoji");
  }
  if (/(必ず|保証|安全|まだ買える|お得|空いている|空いてます)/.test(trimmed)) {
    throw new Error(
      "Trend joke text must not make availability or safety claims"
    );
  }
  return trimmed;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run `npm install` after pulling this change."
    );
  }
}

async function openAutomationSession(config) {
  if (config.cdpUrl) {
    const page = await openCdpChromePage(config.cdpUrl).catch((error) => {
      throw new Error(
        [
          `Could not connect to Chrome at ${config.cdpUrl}.`,
          "Run `npm run x:browser-post -- --login-only` once, log in manually, then retry.",
          "If an older Chrome window is already using the same profile without CDP, close it first.",
          error instanceof Error ? error.message : String(error),
        ].join("\n")
      );
    });
    return {
      async openComposer() {
        await page.goto("https://x.com/compose/post");
        await page.assertNoBlockingState();
      },
      verifyLoggedInAccount: (accountHandle) =>
        page.verifyLoggedInAccount(accountHandle),
      fillComposer: (text) => page.fillComposer(text),
      assertSubmitReady: () => page.assertSubmitReady(),
      submitPost: (accountHandle) => page.submitPost(accountHandle),
      saveScreenshot: (label) => saveCdpScreenshot(page, config, label),
      close: () => page.close(),
    };
  }

  const browserRuntime = await loadPlaywright();
  const session = await openBrowserSession(browserRuntime, config);
  return {
    async openComposer() {
      await openComposer(session.page);
    },
    verifyLoggedInAccount: (accountHandle) =>
      verifyLoggedInAccount(session.page, accountHandle),
    fillComposer: (text) => fillComposer(session.page, text),
    assertSubmitReady: () => assertSubmitReady(session.page),
    submitPost: (accountHandle) => submitPost(session.page, accountHandle),
    saveScreenshot: (label) => saveScreenshot(session.page, config, label),
    close: () => session.close(),
  };
}

async function prepareAutomationRuntime(config) {
  if (!config.cdpUrl) {
    return;
  }

  await ensureCdpChromeAvailable(config);

  if (config.cleanupComposeTabs) {
    const closedCount = await closeStaleComposeTabs(config.cdpUrl);
    if (closedCount > 0) {
      console.log(`Closed stale X compose tabs: ${closedCount}`);
    }
  }
}

async function ensureCdpChromeAvailable(config) {
  if (await isCdpAvailable(config.cdpUrl)) {
    return;
  }

  if (!config.autoStartChrome) {
    throw new Error(
      [
        `Could not connect to Chrome at ${config.cdpUrl}.`,
        "X_BROWSER_POST_AUTO_START_CHROME=false, so Chrome was not started automatically.",
        "Start Chrome with `npm run x:browser-post -- --login-only` and keep it open, or enable auto start.",
      ].join("\n")
    );
  }

  await launchCdpChrome(config, "https://x.com/home");
  await waitForCdpAvailable(config.cdpUrl, config.chromeStartupTimeoutMs).catch(
    (error) => {
      throw new Error(
        [
          `Chrome was started, but ${config.cdpUrl} did not become available.`,
          "If an existing Chrome window is already using the same profile, close it and retry.",
          "For first-time setup, run `npm run x:browser-post -- --login-only` and complete manual login.",
          error instanceof Error ? error.message : String(error),
        ].join("\n")
      );
    }
  );
  console.log(`Started Chrome for X browser posting: ${config.cdpUrl}`);
}

async function openBrowserSession(playwright, config) {
  const launchOptions = {
    headless: config.headless,
  };
  const contextOptions = {
    viewport: { width: 1365, height: 900 },
  };
  if (config.browserChannel) {
    launchOptions.channel = config.browserChannel;
  }
  if (config.chromeExecutablePath) {
    delete launchOptions.channel;
    launchOptions.executablePath = config.chromeExecutablePath;
  }

  if (config.userDataDir) {
    const context = await playwright.chromium.launchPersistentContext(
      config.userDataDir,
      {
        ...launchOptions,
        ...contextOptions,
      }
    );
    return {
      page: context.pages()[0] ?? (await context.newPage()),
      close: () => context.close(),
    };
  }

  const browser = await playwright.chromium.launch(launchOptions);
  const context = await browser.newContext({
    storageState: config.storageState,
    ...contextOptions,
  });
  const page = await context.newPage();
  return {
    page,
    close: () => browser.close(),
  };
}

async function openLoginOnlyBrowser(config) {
  await launchCdpChrome(config, "https://x.com/login");

  console.log("");
  console.log("Normal Chrome login-only mode is open.");
  console.log(`Chrome: ${config.chromeExecutablePath}`);
  console.log(`Profile: ${config.userDataDir}`);
  console.log(`CDP: ${config.cdpUrl}`);
  console.log("Log in to X manually in the opened Chrome window.");
  console.log(
    "After that, keep this Chrome open or let --execute auto-start it next time."
  );
  console.log("");
}

async function launchCdpChrome(config, url) {
  if (!config.chromeExecutablePath) {
    throw new Error(
      "Set X_BROWSER_POST_CHROME_EXECUTABLE_PATH so normal Chrome can be launched directly"
    );
  }
  if (!config.userDataDir) {
    throw new Error(
      "Set X_BROWSER_POST_USER_DATA_DIR so the login session can be saved in a dedicated Chrome profile"
    );
  }

  await fs.access(config.chromeExecutablePath).catch(() => {
    throw new Error(
      `Chrome executable was not found: ${config.chromeExecutablePath}`
    );
  });
  await fs.mkdir(config.userDataDir, { recursive: true });

  const child = spawn(
    config.chromeExecutablePath,
    [
      `--user-data-dir=${config.userDataDir}`,
      `--remote-debugging-port=${config.remoteDebuggingPort}`,
      url,
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );
  child.on("error", () => {});
  child.unref();
}

async function isCdpAvailable(cdpUrl) {
  return Boolean(await fetchCdpJson(cdpUrl, "/json/version", 1000));
}

async function waitForCdpAvailable(cdpUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isCdpAvailable(cdpUrl)) {
      return;
    }
    await wait(500);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for Chrome CDP`);
}

async function closeStaleComposeTabs(cdpUrl) {
  const targets = await fetchCdpJson(cdpUrl, "/json/list", 2000);
  if (!Array.isArray(targets)) {
    return 0;
  }

  const composeTargets = targets.filter(
    (target) =>
      target?.type === "page" &&
      /^https:\/\/(x|twitter)\.com\/compose\/post(?:[?#].*)?$/.test(
        target.url ?? ""
      )
  );

  for (const target of composeTargets) {
    await fetchCdpJson(
      cdpUrl,
      `/json/close/${encodeURIComponent(target.id)}`,
      1000
    );
  }
  return composeTargets.length;
}

async function fetchCdpJson(cdpUrl, pathname, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${cdpUrl.replace(/\/+$/, "")}${pathname}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveCdpScreenshot(page, config, label) {
  const dir = path.join(config.cwd, "local/x-browser-posting/screenshots");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dir, `${stamp}-${label}.png`);
  await page.screenshot(filePath);
  return filePath;
}

async function saveScreenshot(page, config, label) {
  const dir = path.join(config.cwd, "local/x-browser-posting/screenshots");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dir, `${stamp}-${label}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function assertLocalRateLimit(config) {
  const state = await readLocalRateState(config);
  const account = state.accounts?.[config.accountHandle] ?? {};
  const now = new Date();

  if (account.lastPostedAt) {
    const lastPostedAt = new Date(account.lastPostedAt);
    const nextAllowedAt = new Date(
      lastPostedAt.getTime() + config.cooldownMinutes * 60 * 1000
    );
    if (nextAllowedAt.getTime() > now.getTime()) {
      throw new Error(
        `Local cooldown is active until ${nextAllowedAt.toISOString()}`
      );
    }
  }

  const dailyKey = now.toISOString().slice(0, 10);
  const dailyCount =
    account.dailyKey === dailyKey && Number.isFinite(account.dailyCount)
      ? account.dailyCount
      : 0;
  if (dailyCount >= config.dailyLimit) {
    throw new Error("Local daily browser post limit has been reached");
  }
}

async function updateLocalRateState(config) {
  const state = await readLocalRateState(config);
  const now = new Date();
  const dailyKey = now.toISOString().slice(0, 10);
  const account = state.accounts?.[config.accountHandle] ?? {};
  const dailyCount =
    account.dailyKey === dailyKey && Number.isFinite(account.dailyCount)
      ? account.dailyCount + 1
      : 1;

  const nextState = {
    ...state,
    accounts: {
      ...(state.accounts ?? {}),
      [config.accountHandle]: {
        lastPostedAt: now.toISOString(),
        dailyKey,
        dailyCount,
      },
    },
  };

  const filePath = getLocalRateStatePath(config);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(nextState, null, 2));
}

async function readLocalRateState(config) {
  const filePath = getLocalRateStatePath(config);
  try {
    const text = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getLocalRateStatePath(config) {
  return path.join(config.cwd, "local/x-browser-posting/rate-state.json");
}

async function assertTrendJokeNotPosted(config, key, { force }) {
  if (force) {
    return;
  }
  const state = await readTrendJokeState(config);
  if (state.posted?.[key]) {
    throw new Error(
      `Trend joke already posted locally for ${key}. Use --force-local-duplicate to override.`
    );
  }
}

async function updateTrendJokeState(config, key, { prepared, composedText }) {
  const state = await readTrendJokeState(config);
  const nextState = {
    ...state,
    posted: {
      ...(state.posted ?? {}),
      [key]: {
        postedAt: new Date().toISOString(),
        queryBundleKey: prepared.queryBundleKey,
        topicKey: prepared.topicKey,
        searchFingerprint: prepared.searchFingerprint,
        textLength: Array.from(composedText).length,
      },
    },
  };

  const filePath = getTrendJokeStatePath(config);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(nextState, null, 2));
}

async function readTrendJokeState(config) {
  const filePath = getTrendJokeStatePath(config);
  try {
    const text = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getTrendJokeStatePath(config) {
  return path.join(config.cwd, "local/x-browser-posting/trend-joke-state.json");
}

async function buildNextAutoRunSlot(config, runDate) {
  const state = await readTrendJokeState(config);
  const dateKey = runDate ?? formatJstDate(new Date());
  const prefix = `${config.accountHandle}:${dateKey}:slot-`;
  let maxSlot = 0;
  for (const key of Object.keys(state.posted ?? {})) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const rest = key.slice(prefix.length);
    const slotNumber = Number(rest.split(":")[0]);
    if (Number.isFinite(slotNumber)) {
      maxSlot = Math.max(maxSlot, slotNumber);
    }
  }
  return `slot-${maxSlot + 1}`;
}

function formatJstDate(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function buildLocalTrendKey(config, prepared) {
  return [
    config.accountHandle,
    prepared.runDate,
    prepared.runSlot,
    prepared.topicKey,
  ].join(":");
}

function printPreparedTrendJoke({
  prepared,
  composedText,
  verifiedHandle,
  config,
  localTrendKey,
}) {
  console.log("");
  console.log("X trend joke post");
  console.log(`Mode: ${config.execute ? config.confirmationMode : "dry-run"}`);
  console.log(`Account: @${verifiedHandle}`);
  console.log(`Run: ${prepared.runDate} / ${prepared.runSlot}`);
  console.log(`Query bundle: ${prepared.queryBundleKey}`);
  console.log(`Queries: ${prepared.searchQueries.join(" / ")}`);
  console.log(`Topic: ${prepared.topicKey} (${prepared.topicLabel})`);
  console.log(`Search fingerprint: ${prepared.searchFingerprint}`);
  console.log(`Local key: ${localTrendKey}`);
  console.log("");
  console.log("Signals:");
  for (const signal of prepared.signals ?? []) {
    console.log(`- ${signal.name}: ${signal.value}`);
  }
  console.log("");
  console.log("Sample titles:");
  if (prepared.sampleTicketTitles?.length) {
    for (const title of prepared.sampleTicketTitles) {
      console.log(`- ${title}`);
    }
  } else {
    console.log("- none");
  }
  console.log("");
  console.log("Composed text:");
  console.log(composedText);
  console.log("");
}

async function promptForConfirmation() {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive confirmation requires a TTY");
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      'Type "post" to submit, or anything else to cancel: '
    );
    return answer.trim() === "post";
  } finally {
    rl.close();
  }
}

function readTrendEnv(config) {
  return {
    ...readEnvFile(path.join(config.cwd, ".env.local")),
    ...readEnvFile(path.resolve(config.cwd, config.envFile)),
    ...process.env,
  };
}

function readEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) {
    return {};
  }
  const parsed = {};
  const content = fsSync.readFileSync(filePath, "utf8");
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

function readSearchQueries(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  return value
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);
}

function readIntegerOrNull(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return null;
}

const exitStatus = await runWithLocalLog(
  {
    cwd: process.cwd(),
    logPrefix: "x-browser-post-trend-joke",
    command: buildLoggedCommand("x:browser-post:trend-joke"),
  },
  main
);
process.exit(exitStatus);

function buildLoggedCommand(defaultLifecycleEvent) {
  const lifecycleEvent =
    process.env.npm_lifecycle_event || defaultLifecycleEvent;
  const args = process.argv.slice(2);
  return `npm run ${lifecycleEvent}${args.length ? ` -- ${args.join(" ")}` : ""}`;
}

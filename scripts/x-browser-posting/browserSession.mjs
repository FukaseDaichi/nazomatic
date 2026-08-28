import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { openCdpChromePage } from "./cdpChromePage.mjs";
import {
  addMedia as addPlaywrightMedia,
  assertNoBlockingState as assertPlaywrightNoBlockingState,
  assertSubmitReady as assertPlaywrightSubmitReady,
  fillComposer as fillPlaywrightComposer,
  openComposer as openPlaywrightComposer,
  submitPost as submitPlaywrightPost,
  verifyLoggedInAccount as verifyPlaywrightLoggedInAccount,
} from "./xComposerPage.mjs";

export async function openAutomationSession(config) {
  if (config.cdpUrl) {
    const page = await openCdpChromePage(config.cdpUrl, {
      bringToFront: config.bringToFront,
    }).catch((error) => {
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
      addMedia: (filePath) => page.addMedia(filePath),
      assertNoBlockingState: () => page.assertNoBlockingState(),
      assertSubmitReady: () => page.assertSubmitReady(),
      submitPost: (accountHandle, expectedText) =>
        page.submitPost(accountHandle, expectedText),
      saveScreenshot: (label) => saveCdpScreenshot(page, config, label),
      cdpPage: page,
      close: () => page.close(),
    };
  }

  const browserRuntime = await loadPlaywright();
  const session = await openBrowserSession(browserRuntime, config);
  return {
    openComposer: () => openPlaywrightComposer(session.page),
    verifyLoggedInAccount: (accountHandle) =>
      verifyPlaywrightLoggedInAccount(session.page, accountHandle),
    fillComposer: (text) => fillPlaywrightComposer(session.page, text),
    addMedia: (filePath) => addPlaywrightMedia(session.page, filePath),
    assertNoBlockingState: () =>
      assertPlaywrightNoBlockingState(session.page),
    assertSubmitReady: () => assertPlaywrightSubmitReady(session.page),
    submitPost: (accountHandle, expectedText) =>
      submitPlaywrightPost(session.page, accountHandle, expectedText),
    saveScreenshot: (label) => saveScreenshot(session.page, config, label),
    cdpPage: null,
    close: () => session.close(),
  };
}

export async function prepareAutomationRuntime(config) {
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

export async function openLoginOnlyBrowser(config) {
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

export async function assertLocalRateLimit(config) {
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

export async function updateLocalRateState(config) {
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

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run `npm install` after pulling this change."
    );
  }
}

async function openBrowserSession(playwright, config) {
  const launchOptions = { headless: config.headless };
  const contextOptions = { viewport: { width: 1365, height: 900 } };
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
      { ...launchOptions, ...contextOptions }
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
  return { page, close: () => browser.close() };
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

  await launchCdpChrome(config, "https://x.com/home", {
    headless: config.headless,
  });
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

async function launchCdpChrome(config, url, { headless = false } = {}) {
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
    throw new Error(`Chrome executable was not found: ${config.chromeExecutablePath}`);
  });
  await fs.mkdir(config.userDataDir, { recursive: true });

  const child = spawn(
    config.chromeExecutablePath,
    [
      `--user-data-dir=${config.userDataDir}`,
      `--remote-debugging-port=${config.remoteDebuggingPort}`,
      ...(headless ? ["--headless=new"] : []),
      url,
    ],
    { detached: true, stdio: "ignore" }
  );
  child.on("error", () => {});
  child.unref();
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
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveScreenshot(page, config, label) {
  const filePath = await createScreenshotPath(config, label);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function saveCdpScreenshot(page, config, label) {
  const filePath = await createScreenshotPath(config, label);
  await page.screenshot(filePath);
  return filePath;
}

async function createScreenshotPath(config, label) {
  const dir = path.join(config.cwd, "local/x-browser-posting/screenshots");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(dir, `${stamp}-${label}.png`);
}

async function readLocalRateState(config) {
  try {
    const text = await fs.readFile(getLocalRateStatePath(config), "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getLocalRateStatePath(config) {
  return path.join(config.cwd, "local/x-browser-posting/rate-state.json");
}

#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import { openCdpChromePage } from "./x-browser-posting/cdpChromePage.mjs";
import {
  SELECTOR_PROFILE_VERSION,
  assertSubmitReady,
  fillComposer,
  openComposer,
  submitPost,
  verifyLoggedInAccount,
} from "./x-browser-posting/xComposerPage.mjs";

async function main() {
  const config = loadBrowserPostConfig(process.argv.slice(2));
  if (config.loginOnly) {
    await openLoginOnlyBrowser(config);
    return;
  }
  if (config.execute) {
    await assertLocalRateLimit(config);
  }
  await prepareAutomationRuntime(config);
  const prepared = await prepareCandidate(config);

  if (!prepared) {
    console.log("No browser post candidate found.");
    return;
  }

  if (!prepared.postURL) {
    throw new Error("Prepared candidate does not have a postURL");
  }

  const quoteText = config.comment || prepared.suggestedComment;
  const composedText = `${quoteText.trim()}\n\n${prepared.postURL}`;
  const session = await openAutomationSession(config);
  let confirmed = false;
  let postSubmitted = false;

  try {
    await session.openComposer();
    const verifiedHandle = await session.verifyLoggedInAccount(
      config.accountHandle
    );
    await session.fillComposer(composedText);
    await session.assertSubmitReady();
    const screenshotPath = await session.saveScreenshot(
      config.execute ? "ready" : "dry-run"
    );

    printPreparedSummary({
      prepared,
      quoteText,
      composedText,
      verifiedHandle,
      screenshotPath,
      config,
    });

    if (!config.execute) {
      console.log(
        "Dry-run complete. No post was submitted and DB was not updated."
      );
      return;
    }

    if (config.confirmationMode === "interactive") {
      const allowed = await promptForConfirmation();
      if (!allowed) {
        await confirmCandidate(config, prepared, {
          status: "failed",
          quoteText,
          error: "cancelled_by_user",
        });
        confirmed = true;
        console.log("Cancelled. Reservation was released as failed.");
        return;
      }
    }

    const postedPostURL = await session.submitPost(config.accountHandle);
    postSubmitted = true;
    await confirmCandidate(config, prepared, {
      status: "posted",
      quoteText,
      postedPostURL,
    });
    await updateLocalRateState(config);
    confirmed = true;
    console.log("Posted via X browser session.");
    if (postedPostURL) {
      console.log(`Posted URL: ${postedPostURL}`);
    }
  } catch (error) {
    await session.saveScreenshot("error").catch(() => null);
    if (config.execute && !config.dryRun && !confirmed && !postSubmitted) {
      await confirmCandidate(config, prepared, {
        status: "failed",
        quoteText,
        error: error instanceof Error ? error.message : String(error),
      }).catch((confirmError) => {
        console.error("Failed to release reservation:", confirmError);
      });
    }
    if (config.execute && postSubmitted && !confirmed) {
      await writePendingConfirm(config, prepared, {
        status: "posted",
        quoteText,
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => null);
      console.error(
        "The post may have been submitted, but DB confirmation failed. A pending confirmation file was written under local/x-browser-posting/pending."
      );
    }
    throw error;
  } finally {
    if (!config.keepOpen) {
      await session.close();
    }
  }
}

async function prepareCandidate(config) {
  const response = await postJson(
    config,
    "/api/internal/x/browser-post/events/prepare",
    {
      hashtag: config.hashtag,
      accountHandle: config.accountHandle,
      dryRun: config.dryRun,
      reservedBy: config.reservedBy,
      cooldownMinutes: config.cooldownMinutes,
      dailyLimit: config.dailyLimit,
      maxPerRun: config.maxPerRun,
    },
    true
  );

  if (response.status === 204) {
    return null;
  }
  return response.body;
}

async function confirmCandidate(config, prepared, result) {
  return postJson(
    config,
    "/api/internal/x/browser-post/events/confirm",
    {
      eventId: prepared.pickedEventId,
      reservationId: prepared.reservationId,
      accountHandle: config.accountHandle,
      status: result.status,
      quoteText: result.quoteText,
      quoteMode: "post_url",
      postedPostURL: result.postedPostURL ?? null,
      postedPostId: parsePostId(result.postedPostURL),
      confirmationMode: config.confirmationMode,
      selectorProfileVersion: SELECTOR_PROFILE_VERSION,
      error: result.error ?? null,
    },
    false
  );
}

async function postJson(config, pathname, payload, allowNoContent) {
  const response = await fetch(`${config.apiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.internalToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 204 && allowNoContent) {
    return { status: 204, body: null };
  }

  const text = await response.text();
  const body = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    const details =
      body && typeof body === "object" ? JSON.stringify(body) : text;
    throw new Error(`API ${pathname} failed (${response.status}): ${details}`);
  }

  return { status: response.status, body };
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
          "The script tried to prepare Chrome before reserving a candidate, but CDP was still unavailable.",
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
  console.log("After that, keep this Chrome open or let --execute auto-start it next time.");
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

async function saveScreenshot(page, config, label) {
  const dir = path.join(config.cwd, "local/x-browser-posting/screenshots");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dir, `${stamp}-${label}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function saveCdpScreenshot(page, config, label) {
  const dir = path.join(config.cwd, "local/x-browser-posting/screenshots");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dir, `${stamp}-${label}.png`);
  await page.screenshot(filePath);
  return filePath;
}

async function writePendingConfirm(config, prepared, result) {
  const dir = path.join(config.cwd, "local/x-browser-posting/pending");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dir, `${stamp}-${prepared.pickedEventId}.json`);
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        apiBaseUrl: config.apiBaseUrl,
        eventId: prepared.pickedEventId,
        reservationId: prepared.reservationId,
        accountHandle: config.accountHandle,
        status: result.status,
        quoteText: result.quoteText,
        quoteMode: "post_url",
        confirmationMode: config.confirmationMode,
        selectorProfileVersion: SELECTOR_PROFILE_VERSION,
        error: result.error,
      },
      null,
      2
    )
  );
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

function printPreparedSummary({
  prepared,
  quoteText,
  composedText,
  verifiedHandle,
  screenshotPath,
  config,
}) {
  console.log("");
  console.log("X browser post candidate");
  console.log(`Mode: ${config.execute ? config.confirmationMode : "dry-run"}`);
  console.log(`Account: @${verifiedHandle}`);
  console.log(`Event doc: ${prepared.pickedEventId}`);
  console.log(`Source post: ${prepared.postURL}`);
  if (prepared.ticketTitle) {
    console.log(`Ticket: ${prepared.ticketTitle}`);
  }
  if (prepared.eventTime) {
    console.log(`Event time: ${prepared.eventTime}`);
  }
  console.log("");
  console.log("Quote comment:");
  console.log(quoteText.trim());
  console.log("");
  console.log("Composed text:");
  console.log(composedText);
  console.log("");
  console.log(`Screenshot: ${screenshotPath}`);
  console.log("");
}

async function promptForConfirmation() {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive confirmation requires a TTY");
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('Type "post" to submit, or anything else to cancel: ');
    return answer.trim() === "post";
  } finally {
    rl.close();
  }
}

function parsePostId(postedPostURL) {
  if (!postedPostURL) {
    return null;
  }
  const match = /\/status\/([0-9]+)/.exec(postedPostURL);
  return match ? match[1] : null;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

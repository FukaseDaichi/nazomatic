#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { buildSignedHeaders } from "./internal-api/signing.mjs";
import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import { captureGrowthTelemetry } from "./x-browser-posting/growthTelemetry.mjs";
import {
  generateObservationLogImage,
} from "./x-browser-posting/observationLogImage.mjs";
import { recordBrowserPost } from "./x-browser-posting/postLedger.mjs";
import {
  assertLocalRateLimit,
  openAutomationSession,
  openLoginOnlyBrowser,
  prepareAutomationRuntime,
  updateLocalRateState,
} from "./x-browser-posting/browserSession.mjs";
import { runWithLocalLog } from "./x-browser-posting/runLog.mjs";

const STATE_VERSION = 1;
const STATE_PATH = "local/x-browser-posting/observation-log-state.json";
const LOCK_PATH = "local/x-browser-posting/locks/observation-log.lock";
const MEDIA_PATH = "local/x-browser-posting/observation-log-media";
const LAST_ATTEMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LAST_POST_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000;

async function main() {
  const { configArgv, observationArgs } = splitObservationLogArgs(
    process.argv.slice(2)
  );
  if (observationArgs.help) {
    printHelp();
    return;
  }

  const config = loadBrowserPostConfig(configArgv);
  if (config.loginOnly) {
    await openLoginOnlyBrowser(config);
    return;
  }

  const statePath = getStatePath(config);
  let lockHandle = null;
  let state = createEmptyState();
  let session = null;
  let postSubmitted = false;

  try {
    if (config.execute) {
      lockHandle = await acquireLock(config);
    }
    const prepared = await prepareObservationLog(config, observationArgs);
    if (!prepared || typeof prepared !== "object") {
      throw new Error("Observation log prepare API returned no result");
    }
    assertPreparedObservationLog(prepared);

    const rawState = await readState(config, { strict: config.execute });
    assertStateAccount(rawState, config.accountHandle);
    state = stateForCurrentAccount(rawState, config.accountHandle);
    checkLastAttempt(state, {
      execute: config.execute,
      force: observationArgs.forceLocalDuplicate,
    });
    if (config.execute) {
      await assertLocalRateLimit(config);
      assertObservationLogNotPosted(config, state, prepared, {
        force: observationArgs.forceLocalDuplicate,
      });
    }

    let imagePath = null;
    if (!observationArgs.noImage) {
      const workDir = path.join(
        config.cwd,
        MEDIA_PATH,
        prepared.runDate
      );
      await fs.mkdir(workDir, { recursive: true });
      imagePath = await generateObservationLogImage({
        prompt: prepared.imagePrompt,
        workDir,
        pastWindow: prepared.pastWindow,
        browserChannel: config.browserChannel,
        chromeExecutablePath: config.chromeExecutablePath,
      });
      if (!imagePath) {
        console.warn("image generation degraded; posting text only");
      }
    }

    await prepareAutomationRuntime(config);
    session = await openAutomationSession(config);
    await session.openComposer();
    const verifiedHandle = await session.verifyLoggedInAccount(
      config.accountHandle
    );
    await session.fillComposer(prepared.composedText);
    if (imagePath) {
      await session.addMedia(imagePath);
    }
    await session.assertNoBlockingState();
    await session.assertSubmitReady();

    printPreparedObservationLog({
      prepared,
      imagePath,
      verifiedHandle,
      config,
      statePath,
      state,
    });

    if (!config.execute) {
      console.log("result=dry_run");
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

    const startedAt = new Date().toISOString();
    await writeState(config, {
      ...stateForCurrentAccount(state, config.accountHandle),
      lastAttempt: { runDate: prepared.runDate, startedAt },
    });
    const postedPostURL = await session.submitPost(
      config.accountHandle,
      prepared.composedText
    );
    postSubmitted = true;
    await updateLocalRateState(config);
    await writeState(config, {
      version: STATE_VERSION,
      accountHandle: config.accountHandle,
      lastRunDate: prepared.runDate,
      lastPostedAt: new Date().toISOString(),
      lastPostURL: postedPostURL ?? null,
      lastAttempt: null,
    });
    await recordBrowserPost(config, {
      postType: "observation_log",
      text: prepared.composedText,
      postedPostURL,
      metadata: {
        runDate: prepared.runDate,
        pastCount: prepared.pastWindow.count,
        upcomingCount: prepared.upcomingWindow.count,
        hasMedia: Boolean(imagePath),
      },
    }).catch((error) =>
      console.warn(
        `Could not update browser post ledger: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
    console.log("Posted observation log via X browser session.");
    console.log("result=posted");
    if (postedPostURL) {
      console.log(`Posted URL: ${postedPostURL}`);
    }
    await captureGrowthTelemetry(session, config).catch(() => {});
  } catch (error) {
    if (session) {
      const errorScreenshotPath = await session
        .saveScreenshot("observation-log-error")
        .catch(() => null);
      if (errorScreenshotPath) {
        console.error(`Error screenshot: ${errorScreenshotPath}`);
      }
    }
    if (postSubmitted) {
      console.error(
        "The post may have been submitted, but local state was not fully updated."
      );
    }
    throw error;
  } finally {
    if (session && !config.keepOpen) {
      await session.close().catch(() => {});
    }
    await releaseLock(lockHandle);
  }
}

async function prepareObservationLog(config, observationArgs) {
  const response = await postJson(
    config,
    "/api/internal/x/browser-post/observation-log/prepare",
    {
      hashtag: config.hashtag,
      timezone: "Asia/Tokyo",
      runDate: observationArgs.runDate,
      line: observationArgs.line,
    }
  );
  return response.body;
}

async function postJson(config, pathname, payload) {
  const url = `${config.apiBaseUrl}${pathname}`;
  const requestBody = JSON.stringify(payload);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...buildSignedHeaders({
        method: "POST",
        url,
        body: requestBody,
        token: config.internalToken,
        signingSecret: config.internalSigningSecret,
      }),
      "Content-Type": "application/json",
    },
    body: requestBody,
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

function assertPreparedObservationLog(prepared) {
  const text = String(prepared.composedText ?? "");
  const urls = text.match(/https?:\/\/[^\s]+/gi) ?? [];
  if (
    urls.length !== 1 ||
    urls[0] !== prepared.calendarUrl ||
    /[#＃@＠]/.test(text) ||
    /\p{Extended_Pictographic}/u.test(text) ||
    /\n{3,}/.test(text) ||
    weightedTextLength(text) > 280
  ) {
    throw new Error("Observation log prepare result failed local text validation");
  }
}

function splitObservationLogArgs(argv) {
  const configArgv = [];
  const observationArgs = {
    line: null,
    runDate: null,
    noImage: false,
    forceLocalDuplicate: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--line") {
      observationArgs.line = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--run-date") {
      observationArgs.runDate = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--no-image") {
      observationArgs.noImage = true;
    } else if (arg === "--force-local-duplicate") {
      observationArgs.forceLocalDuplicate = true;
    } else if (arg === "--help" || arg === "-h") {
      observationArgs.help = true;
    } else {
      configArgv.push(arg);
    }
  }
  if (observationArgs.line !== null) {
    validateLineOverride(observationArgs.line);
  }
  return { configArgv, observationArgs };
}

function printHelp() {
  console.log(`Usage:
  npm run x:browser-post:observation-log -- [options]

Options:
  --execute                         Submit the post. Omit for dry-run.
  --line <text>                     Override the generated one-line copy.
  --run-date <YYYY-MM-DD>           Override the local run date for testing.
  --no-image                        Skip Codex image generation.
  --force-local-duplicate           Ignore local duplicate and attempt guards.
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

function validateLineOverride(value) {
  const trimmed = String(value).trim();
  if (!trimmed || Array.from(trimmed).length >= 100) {
    throw new Error("--line must be non-empty and fewer than 100 characters");
  }
  if (/https?:\/\//i.test(trimmed) || /[\r\n]/.test(trimmed)) {
    throw new Error("--line must not contain URLs or line breaks");
  }
}

function assertObservationLogNotPosted(config, state, prepared, { force }) {
  if (force || state.accountHandle !== config.accountHandle) {
    return;
  }
  if (state.lastRunDate === prepared.runDate) {
    throw new Error(
      `Observation log already posted locally for ${prepared.runDate}. Use --force-local-duplicate to override.`
    );
  }
  const lastPostedAt = Date.parse(state.lastPostedAt ?? "");
  const age = Date.now() - lastPostedAt;
  if (Number.isFinite(lastPostedAt) && age >= 0 && age <= LAST_POST_MAX_AGE_MS) {
    throw new Error(
      "Observation log was posted within the last 6 days. Use --force-local-duplicate to override."
    );
  }
}

function checkLastAttempt(state, { execute, force }) {
  const lastAttempt = state.lastAttempt;
  if (!lastAttempt || typeof lastAttempt !== "object") {
    return;
  }
  const startedAt = Date.parse(lastAttempt.startedAt ?? "");
  if (!Number.isFinite(startedAt)) {
    const message =
      "Observation log state has an invalid lastAttempt. Move the state file aside before retrying.";
    if (execute) {
      throw new Error(message);
    }
    console.warn(`${message} Dry-run continues.`);
    return;
  }
  const age = Date.now() - startedAt;
  if (!force && age <= LAST_ATTEMPT_MAX_AGE_MS) {
    const message =
      "前回の実行が投稿後に中断した可能性があります。X上の投稿を確認し、必要なら --force-local-duplicate で再実行してください";
    if (execute) {
      throw new Error(message);
    }
    console.warn(message);
  }
}

function assertStateAccount(state, accountHandle) {
  if (state.accountHandle && state.accountHandle !== accountHandle) {
    console.warn(
      `Observation log state belongs to @${state.accountHandle}; ignoring it for @${accountHandle}.`
    );
  }
}

async function acquireLock(config) {
  const filePath = path.join(config.cwd, LOCK_PATH);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  let handle;
  try {
    handle = await fs.open(filePath, "wx");
    await handle.writeFile(
      `${JSON.stringify({ startedAt: new Date().toISOString(), pid: process.pid })}\n`
    );
    return { handle, filePath };
  } catch (error) {
    await handle?.close().catch(() => {});
    throw new Error(
      `Observation log lock is held; another process may be running (${error?.code ?? error?.message ?? error})`
    );
  }
}

async function releaseLock(lock) {
  if (!lock) {
    return;
  }
  await lock.handle.close().catch(() => {});
  await fs.unlink(lock.filePath).catch(() => {});
}

async function readState(config, { strict }) {
  const filePath = getStatePath(config);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("state root must be an object");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createEmptyState();
    }
    const message = `Observation log state is corrupt: ${filePath}`;
    if (strict) {
      throw new Error(`${message}. Move it aside before retrying.`);
    }
    console.warn(`${message}. Continuing dry-run with empty state.`);
    return createEmptyState();
  }
}

function createEmptyState() {
  return {
    version: STATE_VERSION,
    accountHandle: null,
    lastRunDate: null,
    lastPostedAt: null,
    lastPostURL: null,
    lastAttempt: null,
  };
}

function stateForCurrentAccount(state, accountHandle) {
  return state.accountHandle === accountHandle ? state : createEmptyState();
}

async function writeState(config, state) {
  const filePath = getStatePath(config);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`);
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

function getStatePath(config) {
  return path.join(config.cwd, STATE_PATH);
}

function printPreparedObservationLog({
  prepared,
  imagePath,
  verifiedHandle,
  config,
  statePath,
  state,
}) {
  console.log("");
  console.log("X observation log");
  console.log(`Mode: ${config.execute ? config.confirmationMode : "dry-run"}`);
  console.log(`Account: @${verifiedHandle}`);
  console.log(
    `Past: ${prepared.pastWindow.startDate}〜${prepared.pastWindow.endDate} ${prepared.pastWindow.count}件`
  );
  console.log(
    `Upcoming: ${prepared.upcomingWindow.startDate}〜${prepared.upcomingWindow.endDate} ${prepared.upcomingWindow.count}件`
  );
  console.log(`Image: ${imagePath ?? "(none)"}`);
  console.log(`State: ${statePath}`);
  console.log(
    `State keys: accountHandle=${state.accountHandle ?? "(none)"}, lastRunDate=${
      state.lastRunDate ?? "(none)"
    }, lastPostedAt=${state.lastPostedAt ?? "(none)"}`
  );
  console.log("");
  console.log("Composed text:");
  console.log(prepared.composedText);
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

function weightedTextLength(text) {
  let weight = 0;
  for (const char of text) {
    weight += (char.codePointAt(0) ?? 0) <= 0x10ff ? 1 : 2;
  }
  return weight;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const exitStatus = await runWithLocalLog(
  {
    cwd: process.cwd(),
    automationId: "x-browser-post-observation-log",
    command: buildLoggedCommand("x:browser-post:observation-log"),
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

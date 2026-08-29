#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { randomInt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadBrowserPostConfig } from "./x-browser-posting/config.mjs";
import {
  DEFAULT_PUZZLE_DENYLIST,
  buildPuzzleAnswerText,
  buildPuzzleQuestionText,
  decideCasualPuzzlePhase,
  generateCasualPuzzle,
  loadPuzzleDictionary,
  shiftKanaWord,
} from "./x-browser-posting/casualPuzzle.mjs";
import { captureGrowthTelemetry } from "./x-browser-posting/growthTelemetry.mjs";
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
const STATE_PATH = "local/x-browser-posting/casual-puzzle-state.json";
const LOCK_PATH = "local/x-browser-posting/locks/casual-puzzle.lock";
const DICTIONARY_PATH = "public/dic/buta.dic";
const PUZZLE_TOOL_PATH = "/shift-search";
const PUZZLE_TOOL_UTM =
  "utm_source=x&utm_medium=social&utm_campaign=casual_puzzle";
const LAST_ATTEMPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function main() {
  const { configArgv, puzzleArgs } = splitCasualPuzzleArgs(
    process.argv.slice(2)
  );
  if (puzzleArgs.help) {
    printHelp();
    return;
  }

  const config = loadBrowserPostConfig(configArgv);
  if (config.loginOnly) {
    await openLoginOnlyBrowser(config);
    return;
  }

  const statePath = getStatePath(config);
  let lock = null;
  let session = null;
  let postSubmitted = false;

  try {
    if (config.execute) {
      lock = await acquireLock(config);
    }
    const rawState = await readState(config, {
      strict: config.execute,
      accountHandle: config.accountHandle,
    });
    const state = stateForCurrentAccount(rawState, config.accountHandle);
    if (rawState.accountHandle && rawState.accountHandle !== config.accountHandle) {
      console.warn(
        `Casual puzzle state belongs to @${rawState.accountHandle}; ignoring it for @${config.accountHandle}.`
      );
    }

    checkLastAttempt(state, {
      execute: config.execute,
      force: puzzleArgs.forceLocalDuplicate,
    });

    const decision = decideCasualPuzzlePhase({
      state,
      now: new Date(),
      timezone: "Asia/Tokyo",
    });
    const phase = resolvePhase({
      requestedPhase: puzzleArgs.phase,
      decision,
      state,
      force: puzzleArgs.forceLocalDuplicate,
    });

    if (phase.phase === "skip") {
      if (phase.reason === "stale_pending") {
        console.warn(
          "Casual puzzle pending state is more than 7 days old; discarding it without posting."
        );
        if (config.execute) {
          await writeState(config, {
            ...state,
            pending: null,
            lastAttempt: null,
          });
        }
      }
      console.log(`phase=skip reason=${phase.reason}`);
      return;
    }

    const payload = await buildPuzzlePayload({
      phase: phase.phase,
      state,
      config,
    });
    assertPuzzleText(payload.text, phase.phase, buildPuzzleToolUrl(config));

    if (config.execute) {
      await assertLocalRateLimit(config);
    }

    await prepareAutomationRuntime(config);
    session = await openAutomationSession(config);
    await session.openComposer();
    const verifiedHandle = await session.verifyLoggedInAccount(
      config.accountHandle
    );
    await session.fillComposer(payload.text);
    await session.assertNoBlockingState();
    await session.assertSubmitReady();

    printPreparedPuzzle({
      phase: phase.phase,
      reason: phase.reason,
      payload,
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

    await writeState(config, {
      ...state,
      lastAttempt: {
        phase: phase.phase,
        startedAt: new Date().toISOString(),
      },
    });
    const postedPostURL = await session.submitPost(
      config.accountHandle,
      payload.text
    );
    postSubmitted = true;
    await updateLocalRateState(config);
    await writeState(config, buildPostedState({
      state,
      accountHandle: config.accountHandle,
      phase: phase.phase,
      payload,
      postedPostURL,
    }));
    await recordBrowserPost(config, {
      postType: "casual_puzzle",
      text: payload.text,
      postedPostURL,
      metadata: {
        phase: phase.phase,
        display: payload.display,
        shift: payload.shift,
        hasMedia: false,
      },
    }).catch((error) =>
      console.warn(
        `Could not update browser post ledger: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
    console.log(`Posted casual puzzle (${phase.phase}) via X browser session.`);
    console.log("result=posted");
    if (postedPostURL) {
      console.log(`Posted URL: ${postedPostURL}`);
    }
    await captureGrowthTelemetry(session, config).catch(() => {});
  } catch (error) {
    if (session) {
      const errorScreenshotPath = await session
        .saveScreenshot("casual-puzzle-error")
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
    await releaseLock(lock);
  }
}

function splitCasualPuzzleArgs(argv) {
  const configArgv = [];
  const puzzleArgs = {
    phase: null,
    forceLocalDuplicate: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--phase") {
      puzzleArgs.phase = readRequiredArg(argv, index, arg);
      index += 1;
      if (!["question", "answer"].includes(puzzleArgs.phase)) {
        throw new Error("--phase must be question or answer");
      }
    } else if (arg === "--force-local-duplicate") {
      puzzleArgs.forceLocalDuplicate = true;
    } else if (arg === "--help" || arg === "-h") {
      puzzleArgs.help = true;
    } else {
      configArgv.push(arg);
    }
  }
  return { configArgv, puzzleArgs };
}

function printHelp() {
  console.log(`Usage:
  npm run x:browser-post:casual-puzzle -- [options]

Options:
  --execute                         Submit the post. Omit for dry-run.
  --phase question|answer           Override the automatic Sunday/Monday phase.
  --force-local-duplicate           Ignore duplicate and attempt guards.
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

function resolvePhase({ requestedPhase, decision, state, force }) {
  if (!requestedPhase) {
    return decision;
  }
  if (requestedPhase === "answer" && !state.pending) {
    throw new Error("Cannot force answer phase without a pending puzzle");
  }
  if (requestedPhase === "question" && state.pending && !force) {
    throw new Error(
      "Cannot force question phase while a pending puzzle exists. Use --force-local-duplicate only after checking X."
    );
  }
  return {
    phase: requestedPhase,
    reason: `forced_${requestedPhase}`,
  };
}

// 投稿 URL は config.publicBaseUrl（src/app/config.ts の baseURL と同じ解決規則）
// から組み立てる。週末サマリ・トレンドネタ・観測ログと同じ規則に揃える。
function buildPuzzleToolUrl(config) {
  return `${config.publicBaseUrl}${PUZZLE_TOOL_PATH}?${PUZZLE_TOOL_UTM}`;
}

async function buildPuzzlePayload({ phase, state, config }) {
  if (phase === "answer") {
    const pending = state.pending;
    return {
      text: buildPuzzleAnswerText({
        answer: pending.answer,
        display: pending.display,
        shift: pending.shift,
        toolUrl: buildPuzzleToolUrl(config),
      }),
      answer: pending.answer,
      display: pending.display,
      shift: pending.shift,
    };
  }

  const words = loadPuzzleDictionary(
    path.join(config.cwd, DICTIONARY_PATH)
  );
  const puzzle = generateCasualPuzzle({ words, randomInt });
  if (!puzzle) {
    throw new Error(
      `Could not generate a safe casual puzzle from ${words.length} dictionary candidates`
    );
  }
  return {
    text: buildPuzzleQuestionText(puzzle),
    answer: puzzle.answer,
    display: puzzle.display,
    shift: puzzle.shift,
  };
}

function assertPuzzleText(text, phase, toolUrl) {
  const value = String(text ?? "");
  const urls = value.match(/https?:\/\/[^\s]+/gi) ?? [];
  if (phase === "question" && urls.length !== 0) {
    throw new Error("Question text must not contain a URL");
  }
  if (
    phase === "answer" &&
    (urls.length !== 1 || urls[0] !== toolUrl)
  ) {
    throw new Error("Answer text must contain exactly the approved tool URL");
  }
  const missingQuestionMark = phase === "question" && !/[?？]/.test(value);
  if (
    !value ||
    missingQuestionMark ||
    /[#＃@＠]/.test(value) ||
    /\p{Extended_Pictographic}/u.test(value) ||
    /\n{3,}/.test(value) ||
    weightedTextLength(value) > 280
  ) {
    throw new Error("Casual puzzle text failed local validation");
  }
}

function buildPostedState({
  state,
  accountHandle,
  phase,
  payload,
  postedPostURL,
}) {
  return {
    version: STATE_VERSION,
    accountHandle,
    pending:
      phase === "question"
        ? {
            answer: payload.answer,
            display: payload.display,
            shift: payload.shift,
            questionPostedAt: new Date().toISOString(),
            questionPostURL: postedPostURL ?? null,
          }
        : null,
    lastAttempt: null,
    ...(phase === "answer"
      ? {
          lastAnswerPostURL: postedPostURL ?? null,
          lastAnsweredAt: new Date().toISOString(),
        }
      : {}),
    ...(state.lastAnswerPostURL && phase === "question"
      ? { lastAnswerPostURL: state.lastAnswerPostURL }
      : {}),
  };
}

function checkLastAttempt(state, { execute, force }) {
  const lastAttempt = state.lastAttempt;
  if (!lastAttempt || typeof lastAttempt !== "object") {
    return;
  }
  const startedAt = Date.parse(lastAttempt.startedAt ?? "");
  if (!Number.isFinite(startedAt)) {
    if (execute) {
      throw new Error(
        "Casual puzzle state has an invalid lastAttempt. Move the state file aside before retrying."
      );
    }
    console.warn("Casual puzzle state has an invalid lastAttempt; dry-run continues.");
    return;
  }
  const age = Date.now() - startedAt;
  if (age <= LAST_ATTEMPT_MAX_AGE_MS) {
    const message =
      "前回の実行が投稿後に中断した可能性があります。X上の投稿を確認し、必要なら --force-local-duplicate で再実行してください";
    if (execute && !force) {
      throw new Error(message);
    }
    if (!execute) {
      console.warn(message);
    }
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
      `Casual puzzle lock is held; another process may be running (${error?.code ?? error?.message ?? error})`
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

async function readState(config, { strict, accountHandle }) {
  const filePath = getStatePath(config);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("state root must be an object");
    }
    // 別アカウントの state は内容を検査せず、そのまま呼び出し側で無視する。
    // 共有 checkout 上の別アカウントに対して、壊れた pending が実行を妨げないようにする。
    if (parsed.accountHandle && parsed.accountHandle !== accountHandle) {
      return parsed;
    }
    if (parsed.pending !== null && parsed.pending !== undefined) {
      if (
        typeof parsed.pending !== "object" ||
        typeof parsed.pending.answer !== "string" ||
        typeof parsed.pending.display !== "string" ||
        !Number.isInteger(parsed.pending.shift) ||
        typeof parsed.pending.questionPostedAt !== "string"
      ) {
        throw new Error("pending state has an invalid shape");
      }
      validatePendingPuzzle(parsed.pending);
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createEmptyState();
    }
    const message = `Casual puzzle state is corrupt: ${filePath}`;
    if (strict) {
      throw new Error(`${message}. Move it aside before retrying.`);
    }
    console.warn(`${message}. Continuing dry-run with empty state.`);
    return createEmptyState();
  }
}

function validatePendingPuzzle(pending) {
  const answerLength = Array.from(pending.answer).length;
  const displayLength = Array.from(pending.display).length;
  if (
    answerLength < 4 ||
    answerLength > 6 ||
    displayLength < 4 ||
    displayLength > 6 ||
    pending.shift < 1 ||
    pending.shift > 3 ||
    shiftKanaWord(pending.display, pending.shift) !== pending.answer ||
    DEFAULT_PUZZLE_DENYLIST.some((pattern) =>
      pending.answer.includes(pattern) || pending.display.includes(pattern)
    )
  ) {
    throw new Error("pending state contains an invalid or unsafe puzzle");
  }
}

function createEmptyState() {
  return {
    version: STATE_VERSION,
    accountHandle: null,
    pending: null,
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

function printPreparedPuzzle({
  phase,
  reason,
  payload,
  verifiedHandle,
  config,
  statePath,
  state,
}) {
  console.log("");
  console.log("X casual puzzle");
  console.log(`Mode: ${config.execute ? config.confirmationMode : "dry-run"}`);
  console.log(`Account: @${verifiedHandle}`);
  console.log(`Phase: ${phase} (${reason})`);
  console.log(`Display: ${payload.display}`);
  console.log(`Answer: ${payload.answer}`);
  console.log(`Shift: ${payload.shift}`);
  console.log(`State: ${statePath}`);
  console.log(
    `Pending question: ${state.pending?.questionPostedAt ?? "(none)"}`
  );
  console.log("");
  console.log("Composed text:");
  console.log(payload.text);
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

const exitStatus = await runWithLocalLog(
  {
    cwd: process.cwd(),
    automationId: "x-browser-post-casual-puzzle",
    command: buildLoggedCommand("x:browser-post:casual-puzzle"),
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

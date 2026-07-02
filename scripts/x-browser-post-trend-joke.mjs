#!/usr/bin/env node

import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { randomInt } from "crypto";
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

const MAX_TREND_JOKE_WEIGHTED_LENGTH = 280;
const MAX_TREND_JOKE_NEWLINES = 4;
const TREND_JOKE_HISTORY_MAX_ENTRIES = 30;
const TREND_JOKE_HISTORY_ENDING_LENGTH = 48;
const TREND_JOKE_FULL_SIMILARITY_THRESHOLD = 0.68;
const TREND_JOKE_ENDING_SIMILARITY_THRESHOLD = 0.72;
const DEFAULT_TREND_JOKE_PROVIDER_TIMEOUT_MS = 120000;
const DEFAULT_TREND_JOKE_PROVIDER_ATTEMPTS = 2;
const TREND_JOKE_PROVIDER_OUTPUT_LIMIT_BYTES = 64 * 1024;
const TREND_JOKE_KNOWN_SHAPES = new Set([
  "sugari",
  "suneru",
  "midnight",
  "false_hope",
  "heavy_love",
  "void",
  "jealousy",
  "fake_calm",
  "mood_swing",
  "defiance",
]);

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
  const copyProvider = resolveTrendJokeCopyProvider({
    trendArgs,
    trendEnv,
  });
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

  const overrideText = (
    trendArgs.line ??
    trendEnv.X_BROWSER_POST_TREND_JOKE_LINE ??
    ""
  ).trim();
  const history = await readTrendJokeHistory(config, {
    strict: config.execute,
  });
  const selected = await selectTrendJokeCopy({
    config,
    copyProvider,
    overrideText,
    history,
    prepared,
    force: trendArgs.forceLocalDuplicate,
  });
  const composedText = selected.text;
  const localTrendKey = buildLocalTrendKey(config, prepared);
  assertTrendJokeCopyAutoSafety({ config, trendEnv, selected });

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
      shape: selected.shape,
      copySource: selected.source,
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
      copySource: selected.source,
    });
    await updateTrendJokeHistory(config, {
      prepared,
      composedText,
      shape: selected.shape,
      copySource: selected.source,
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
        "The post may have been submitted, but local state/history was not fully updated."
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
    copyProvider: null,
    copyProviderCommand: null,
    copyProviderTimeoutMs: null,
    copyProviderAttempts: null,
    codexModel: null,
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
    } else if (arg === "--copy-provider") {
      trendArgs.copyProvider = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--copy-provider-command") {
      trendArgs.copyProviderCommand = readRequiredArg(argv, index, arg);
      index += 1;
    } else if (arg === "--copy-provider-timeout-ms") {
      trendArgs.copyProviderTimeoutMs = readIntegerArg(argv, index, arg);
      index += 1;
    } else if (arg === "--copy-provider-attempts") {
      trendArgs.copyProviderAttempts = readIntegerArg(argv, index, arg);
      index += 1;
    } else if (arg === "--codex-model") {
      trendArgs.codexModel = readRequiredArg(argv, index, arg);
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
  --line <text>                     Override the generated post text.
  --query-bundle <key>              event_title_general | ticket_title_window | companion_title_window | title_aruaru_words | weekend_title_window
  --query <text>                    Override/add a search query. Can be repeated.
  --topic <topic>                   Override topic when available.
  --run-date <YYYY-MM-DD>           Override the local run date for testing.
  --run-slot <slot>                 Override the local run slot for duplicate guard.
  --max-search-queries <number>     Limit search queries per prepare.
  --max-posts-per-query <number>    Limit posts fetched per query.
  --copy-provider <provider>        fallback | codex | command. Defaults to fallback.
  --copy-provider-command <command> Command provider shell command. Reads JSON from stdin.
  --copy-provider-timeout-ms <ms>   Timeout for codex/command copy generation.
  --copy-provider-attempts <number> Provider attempts before falling back.
  --codex-model <model>             Optional model for the codex provider.
  --force-local-duplicate           Ignore local same-slot and recent-history duplicate guards.
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

function resolveTrendJokeCopyProvider({ trendArgs, trendEnv }) {
  const kind = String(
    firstNonEmpty(
      trendArgs.copyProvider,
      trendEnv.X_BROWSER_POST_TREND_JOKE_COPY_PROVIDER,
      "fallback"
    )
  )
    .trim()
    .toLowerCase();
  if (!["fallback", "codex", "command"].includes(kind)) {
    throw new Error(
      "X_BROWSER_POST_TREND_JOKE_COPY_PROVIDER must be fallback, codex, or command"
    );
  }

  const timeoutMs = clampInteger(
    trendArgs.copyProviderTimeoutMs ??
      readIntegerOrNull(
        trendEnv.X_BROWSER_POST_TREND_JOKE_PROVIDER_TIMEOUT_MS
      ) ??
      DEFAULT_TREND_JOKE_PROVIDER_TIMEOUT_MS,
    5000,
    600000
  );
  const attempts = clampInteger(
    trendArgs.copyProviderAttempts ??
      readIntegerOrNull(
        trendEnv.X_BROWSER_POST_TREND_JOKE_PROVIDER_ATTEMPTS
      ) ??
      DEFAULT_TREND_JOKE_PROVIDER_ATTEMPTS,
    1,
    3
  );
  const command = firstNonEmpty(
    trendArgs.copyProviderCommand,
    trendEnv.X_BROWSER_POST_TREND_JOKE_PROVIDER_COMMAND,
    ""
  );
  if (kind === "command" && !command) {
    throw new Error(
      "X_BROWSER_POST_TREND_JOKE_PROVIDER_COMMAND is required when copy provider is command"
    );
  }

  return {
    kind,
    command,
    timeoutMs,
    attempts,
    codexModel: firstNonEmpty(
      trendArgs.codexModel,
      trendEnv.X_BROWSER_POST_TREND_JOKE_CODEX_MODEL,
      ""
    ),
  };
}

async function selectTrendJokeCopy({
  config,
  copyProvider,
  overrideText,
  history,
  prepared,
  force,
}) {
  const historyPath = getTrendJokeHistoryPath(config);
  const commonSelectionParams = {
    history,
    prepared,
    accountHandle: config.accountHandle,
    historyPath,
    force,
  };

  if (overrideText) {
    return selectTrendJokeText({
      ...commonSelectionParams,
      candidatePairs: [{ source: "manual", shape: "manual", text: overrideText }],
    });
  }

  const generatedCandidates = await generateTrendJokeProviderCandidates({
    config,
    copyProvider,
    prepared,
  });
  if (generatedCandidates.length > 0) {
    try {
      return selectTrendJokeText({
        ...commonSelectionParams,
        candidatePairs: generatedCandidates,
      });
    } catch (error) {
      console.warn(
        `Generated trend joke copy was rejected by local history guard: ${formatErrorMessage(
          error
        )}`
      );
      console.warn("Falling back to local trend joke candidates.");
    }
  }

  return selectTrendJokeText({
    ...commonSelectionParams,
    candidatePairs: getPreparedFallbackCandidatePairs(prepared).map(
      (candidate) => ({
        source: "fallback",
        ...candidate,
      })
    ),
  });
}

async function generateTrendJokeProviderCandidates({
  config,
  copyProvider,
  prepared,
}) {
  if (copyProvider.kind === "fallback") {
    return [];
  }

  let previousError = "";
  for (let attempt = 1; attempt <= copyProvider.attempts; attempt += 1) {
    try {
      const prompt = buildTrendJokeProviderPrompt({
        prepared,
        attempt,
        previousError,
      });
      const rawOutput =
        copyProvider.kind === "codex"
          ? await runCodexTrendJokeProvider(config, copyProvider, prompt)
          : await runCommandTrendJokeProvider(config, copyProvider, {
              prompt,
              prepared,
            });
      const generated = parseTrendJokeProviderOutput(rawOutput);
      const text = validateTrendJokeText(generated.text);
      const shape = normalizeTrendJokeProviderShape(generated.shape);
      console.log(
        `Generated trend joke copy via ${copyProvider.kind} provider (attempt ${attempt}).`
      );
      return [
        {
          source: copyProvider.kind,
          shape,
          text,
        },
      ];
    } catch (error) {
      previousError = formatErrorMessage(error);
      console.warn(
        `Trend joke copy provider ${copyProvider.kind} attempt ${attempt} failed: ${previousError}`
      );
    }
  }

  console.warn(
    `Trend joke copy provider ${copyProvider.kind} failed; using local fallback candidates.`
  );
  return [];
}

function buildTrendJokeProviderPrompt({ prepared, attempt, previousError }) {
  return [
    "次の文案生成プロンプトに従い、X投稿文を1つだけ作ってください。",
    "返答は JSON オブジェクトだけにしてください。Markdown、説明文、コードフェンスは禁止です。",
    '形式: {"text":"投稿文","shape":"sugari"}',
    `shape は次のどれか: ${Array.from(TREND_JOKE_KNOWN_SHAPES).join(
      " / "
    )}`,
    "text は validator に通る必要があります。URL、hashtag、mention、emoji は入れないでください。",
    "検索材料は今日のスイッチにすぎません。主役は投稿人格の情緒です。",
    previousError
      ? `前回の失敗理由: ${previousError}。この問題を直して再生成してください。`
      : "",
    `attempt: ${attempt}`,
    "",
    "文案生成プロンプト:",
    prepared.copyPrompt,
  ]
    .filter(Boolean)
    .join("\n");
}

async function runCodexTrendJokeProvider(config, copyProvider, prompt) {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "nazomatic-trend-joke-")
  );
  const outputPath = path.join(tempDir, "codex-output.json");
  const schemaPath = path.join(tempDir, "codex-output-schema.json");
  try {
    await fs.writeFile(
      schemaPath,
      JSON.stringify(buildTrendJokeProviderOutputSchema(), null, 2)
    );
    const args = ["exec"];
    if (copyProvider.codexModel) {
      args.push("--model", copyProvider.codexModel);
    }
    args.push(
      "--cd",
      config.cwd,
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "-"
    );
    const result = await runChildProcess("codex", args, {
      cwd: config.cwd,
      input: prompt,
      timeoutMs: copyProvider.timeoutMs,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `codex exited with ${result.exitCode}: ${result.stderr || result.stdout}`
      );
    }
    const output = await fs.readFile(outputPath, "utf8").catch(() => "");
    return output.trim() || result.stdout;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runCommandTrendJokeProvider(config, copyProvider, payload) {
  const result = await runChildProcess(copyProvider.command, [], {
    cwd: config.cwd,
    input: JSON.stringify(
      {
        prompt: payload.prompt,
        copyPrompt: payload.prepared.copyPrompt,
        prepared: buildTrendJokeProviderPayload(payload.prepared),
      },
      null,
      2
    ),
    timeoutMs: copyProvider.timeoutMs,
    shell: true,
    env: {
      ...process.env,
      X_BROWSER_POST_TREND_JOKE_COPY_PROMPT: payload.prompt,
    },
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `provider command exited with ${result.exitCode}: ${
        result.stderr || result.stdout
      }`
    );
  }
  return result.stdout;
}

function buildTrendJokeProviderOutputSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["text", "shape"],
    properties: {
      text: {
        type: "string",
        minLength: 1,
      },
      shape: {
        type: "string",
        enum: Array.from(TREND_JOKE_KNOWN_SHAPES),
      },
    },
  };
}

function buildTrendJokeProviderPayload(prepared) {
  return {
    runDate: prepared.runDate,
    runSlot: prepared.runSlot,
    queryBundleKey: prepared.queryBundleKey,
    searchQueries: prepared.searchQueries,
    topicKey: prepared.topicKey,
    topicLabel: prepared.topicLabel,
    trendSummary: prepared.trendSummary,
    signals: prepared.signals,
    sampleTicketTitles: prepared.sampleTicketTitles,
    frequentTitleWords: prepared.frequentTitleWords,
    searchFingerprint: prepared.searchFingerprint,
  };
}

function parseTrendJokeProviderOutput(rawOutput) {
  const output = stripJsonCodeFence(String(rawOutput ?? "").trim());
  if (!output) {
    throw new Error("provider output was empty");
  }

  const jsonText = extractJsonObject(output);
  if (jsonText) {
    const parsed = safeJsonParse(jsonText);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.text === "string"
    ) {
      return {
        text: parsed.text,
        shape: typeof parsed.shape === "string" ? parsed.shape : null,
      };
    }
  }

  return {
    text: output,
    shape: null,
  };
}

function stripJsonCodeFence(value) {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(value);
  return match ? match[1].trim() : value;
}

function extractJsonObject(value) {
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }
  return value.slice(first, last + 1);
}

function normalizeTrendJokeProviderShape(shape) {
  if (typeof shape !== "string") {
    return null;
  }
  const normalized = shape.trim();
  return TREND_JOKE_KNOWN_SHAPES.has(normalized) ? normalized : null;
}

function assertTrendJokeCopyAutoSafety({ config, trendEnv, selected }) {
  const isUnattendedPost =
    config.confirmationMode === "auto" ||
    config.confirmationMode === "unattended";
  if (
    !config.execute ||
    !isUnattendedPost ||
    selected.source === "fallback" ||
    selected.source === "manual"
  ) {
    return;
  }

  if (
    readBooleanEnv(
      trendEnv.X_BROWSER_POST_TREND_JOKE_PROVIDER_AUTO_APPROVE,
      false
    )
  ) {
    return;
  }

  throw new Error(
    [
      "Generated provider copy cannot be auto-posted unless X_BROWSER_POST_TREND_JOKE_PROVIDER_AUTO_APPROVE=true.",
      "Keep X_BROWSER_POST_CONFIRMATION_MODE=interactive for initial monitoring, or enable the extra lock after reviewing provider output quality.",
    ].join("\n")
  );
}

function runChildProcess(
  command,
  args,
  { cwd, input, timeoutMs, shell = false, env = process.env }
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finishReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    const append = (streamName, chunk) => {
      const value = chunk.toString("utf8");
      if (streamName === "stdout") {
        stdout += value;
      } else {
        stderr += value;
      }
      if (
        Buffer.byteLength(stdout) + Buffer.byteLength(stderr) >
        TREND_JOKE_PROVIDER_OUTPUT_LIMIT_BYTES
      ) {
        child.kill("SIGTERM");
        finishReject(new Error("provider output exceeded local size limit"));
      }
    };

    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      finishReject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (settled) {
        return;
      }
      settled = true;
      if (timedOut) {
        reject(new Error(`provider timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({
        exitCode: code ?? (signal ? 1 : 0),
        signal,
        stdout,
        stderr,
      });
    });

    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function formatErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// X の重み付け文字数の近似。server (trend-joke-post.ts) と同じルール。
// 0x10FF 以下（半角英数・改行など）は 1、それ以外（全角・かな・漢字・絵文字）は 2。
function weightedTextLength(text) {
  let weight = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    weight += codePoint <= 0x10ff ? 1 : 2;
  }
  return weight;
}

function validateTrendJokeText(text) {
  const trimmed = String(text).replace(/\r\n?/g, "\n").trim();
  if (!trimmed) {
    throw new Error("Trend joke text must not be empty");
  }
  if (weightedTextLength(trimmed) > MAX_TREND_JOKE_WEIGHTED_LENGTH) {
    throw new Error(
      `Trend joke text must not exceed ${MAX_TREND_JOKE_WEIGHTED_LENGTH} weighted characters`
    );
  }
  if (/\n{3,}/.test(trimmed)) {
    throw new Error("Trend joke text must not contain more than one blank line");
  }
  if ((trimmed.match(/\n/g)?.length ?? 0) > MAX_TREND_JOKE_NEWLINES) {
    throw new Error("Trend joke text must not contain too many line breaks");
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

function getPreparedFallbackCandidates(prepared) {
  const candidates = Array.isArray(prepared.fallbackTextCandidates)
    ? prepared.fallbackTextCandidates
    : [];
  const unique = new Set([
    ...candidates,
    prepared.fallbackText,
    prepared.composedText,
  ]);
  return Array.from(unique).filter(
    (candidate) => typeof candidate === "string" && candidate.trim() !== ""
  );
}

function getPreparedFallbackCandidatePairs(prepared) {
  const pairs = Array.isArray(prepared.fallbackCandidates)
    ? prepared.fallbackCandidates
    : [];
  const normalized = pairs
    .filter(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        typeof candidate.text === "string" &&
        candidate.text.trim() !== ""
    )
    .map((candidate) => ({
      shape: typeof candidate.shape === "string" ? candidate.shape : null,
      text: candidate.text,
    }));
  if (normalized.length > 0) {
    return normalized;
  }
  return getPreparedFallbackCandidates(prepared).map((text) => ({
    shape: null,
    text,
  }));
}

function selectTrendJokeText({
  candidatePairs,
  history,
  prepared,
  accountHandle,
  historyPath,
  force,
}) {
  const validatedCandidates = dedupeTrendJokeCandidatePairs(candidatePairs);
  if (validatedCandidates.length === 0) {
    throw new Error("Trend joke text candidates must not be empty");
  }
  if (force) {
    return validatedCandidates[0];
  }

  const recentEntries = getRelevantTrendJokeHistoryEntries(
    history,
    accountHandle
  );
  warnIfTrendJokeTopicRecentlyRepeated({
    entries: recentEntries,
    topicKey: prepared.topicKey,
  });
  const recentShapes = collectRecentTrendJokeShapes(recentEntries);
  const lastShape =
    recentEntries.length > 0 && typeof recentEntries[0].shape === "string"
      ? recentEntries[0].shape
      : null;
  const ordered = orderTrendJokeCandidatesByShape(
    shuffleArray(validatedCandidates),
    recentShapes,
    lastShape
  );

  const blocked = [];
  for (const candidate of ordered) {
    const blockReason = findTrendJokeHistoryBlockReason({
      text: candidate.text,
      entries: recentEntries,
      prepared,
    });
    if (!blockReason) {
      if (candidate.shape && recentShapes.has(candidate.shape)) {
        console.warn(
          `Selected trend joke reuses recent shape ${candidate.shape}; no fresher-shape candidate survived the history guard.`
        );
      }
      return candidate;
    }
    blocked.push({ text: candidate.text, reason: blockReason });
  }

  throw new Error(
    [
      "All trend joke text candidates were too similar to recent local history.",
      summarizeBlockedTrendJokeCandidates(blocked),
      `History file: ${historyPath}`,
      "Use --force-local-duplicate only if you intentionally want to bypass the local history guard.",
    ].join("\n")
  );
}

function dedupeTrendJokeCandidatePairs(candidatePairs) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidatePairs ?? []) {
    const text = validateTrendJokeText(
      typeof candidate?.text === "string" ? candidate.text : ""
    );
    if (seen.has(text)) {
      continue;
    }
    seen.add(text);
    result.push({
      source:
        typeof candidate?.source === "string" && candidate.source
          ? candidate.source
          : "fallback",
      shape: typeof candidate?.shape === "string" ? candidate.shape : null,
      text,
    });
  }
  return result;
}

function collectRecentTrendJokeShapes(entries, limit = 3) {
  const shapes = new Set();
  for (const entry of entries.slice(0, limit)) {
    if (entry && typeof entry.shape === "string" && entry.shape) {
      shapes.add(entry.shape);
    }
  }
  return shapes;
}

// 湿っぽい温度。直前がこれらだった場合、連投を避けるため後回しにする。
const TREND_JOKE_WET_SHAPES = new Set(["void", "heavy_love"]);

function orderTrendJokeCandidatesByShape(candidates, recentShapes, lastShape) {
  const lastWasWet = Boolean(
    lastShape && TREND_JOKE_WET_SHAPES.has(lastShape)
  );
  const penalty = (candidate) => {
    let score = 0;
    if (candidate.shape && recentShapes.has(candidate.shape)) {
      score += 2; // 直近 3 件で使った温度は後回し
    }
    if (
      lastWasWet &&
      candidate.shape &&
      TREND_JOKE_WET_SHAPES.has(candidate.shape)
    ) {
      score += 1; // 湿っぽい温度の連投を避ける
    }
    return score;
  };
  // 入力は shuffle 済み。index を tiebreak にして同スコア内のランダム性を保つ。
  return candidates
    .map((candidate, index) => ({ candidate, index, score: penalty(candidate) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.candidate);
}

function warnIfTrendJokeTopicRecentlyRepeated({ entries, topicKey }) {
  const sameTopicCount = entries
    .slice(0, 3)
    .filter((entry) => entry.topicKey === topicKey).length;
  if (sameTopicCount >= 2) {
    console.warn(
      `Recent trend joke history already contains ${sameTopicCount}/3 posts for topic ${topicKey}.`
    );
  }
}

function getRelevantTrendJokeHistoryEntries(history, accountHandle) {
  if (!Array.isArray(history.entries)) {
    return [];
  }
  return history.entries.filter((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    return !entry.accountHandle || entry.accountHandle === accountHandle;
  });
}

function findTrendJokeHistoryBlockReason({ text, entries, prepared }) {
  const normalizedText = normalizeTrendJokeText(text);
  const normalizedEndingText = normalizeTrendJokeText(getEndingText(text));
  for (const entry of entries) {
    const entryText = typeof entry.text === "string" ? entry.text : "";
    const entryNormalizedText =
      typeof entry.normalizedText === "string" && entry.normalizedText.trim()
        ? entry.normalizedText
        : normalizeTrendJokeText(entryText);
    const entryEndingText =
      typeof entry.endingText === "string" && entry.endingText.trim()
        ? entry.endingText
        : getEndingText(entryText);
    const entryNormalizedEndingText = normalizeTrendJokeText(entryEndingText);

    if (entryText === text || entryNormalizedText === normalizedText) {
      return buildTrendJokeHistoryReason("exact text match", entry);
    }

    const fullSimilarity = calculateTextSimilarity(
      normalizedText,
      entryNormalizedText
    );
    if (fullSimilarity >= TREND_JOKE_FULL_SIMILARITY_THRESHOLD) {
      return buildTrendJokeHistoryReason(
        `similar full text (${fullSimilarity.toFixed(2)})`,
        entry
      );
    }

    if (
      normalizedEndingText.length >= 12 &&
      entryNormalizedEndingText.length >= 12
    ) {
      const endingSimilarity = calculateTextSimilarity(
        normalizedEndingText,
        entryNormalizedEndingText
      );
      if (endingSimilarity >= TREND_JOKE_ENDING_SIMILARITY_THRESHOLD) {
        return buildTrendJokeHistoryReason(
          `similar ending (${endingSimilarity.toFixed(2)})`,
          entry
        );
      }
    }

    if (
      prepared.searchFingerprint &&
      entry.searchFingerprint === prepared.searchFingerprint &&
      fullSimilarity >= 0.5
    ) {
      return buildTrendJokeHistoryReason(
        `same search fingerprint with related text (${fullSimilarity.toFixed(
          2
        )})`,
        entry
      );
    }
  }
  return null;
}

function buildTrendJokeHistoryReason(reason, entry) {
  const postedAt = entry.postedAt ? ` postedAt=${entry.postedAt}` : "";
  const topicKey = entry.topicKey ? ` topic=${entry.topicKey}` : "";
  return `${reason}${postedAt}${topicKey}`;
}

function summarizeBlockedTrendJokeCandidates(blocked) {
  return blocked
    .slice(0, 5)
    .map((entry, index) => {
      const preview = Array.from(entry.text).slice(0, 48).join("");
      return `- candidate ${index + 1}: ${entry.reason}; "${preview}"`;
    })
    .join("\n");
}

function calculateTextSimilarity(left, right) {
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  const leftGrams = makeCharacterBigrams(left);
  const rightGrams = makeCharacterBigrams(right);
  if (leftGrams.size === 0 || rightGrams.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) {
      intersection += 1;
    }
  }
  const union = leftGrams.size + rightGrams.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function makeCharacterBigrams(value) {
  const chars = Array.from(value);
  if (chars.length < 2) {
    return new Set(chars);
  }
  const grams = new Set();
  for (let index = 0; index < chars.length - 1; index += 1) {
    grams.add(`${chars[index]}${chars[index + 1]}`);
  }
  return grams;
}

function normalizeTrendJokeText(text) {
  return Array.from(String(text ?? "").normalize("NFKC").toLowerCase())
    .filter(
      (char) =>
        !/[\s。、，,.!?！？「」『』（）()【】\[\]{}〈〉《》:：;；'"“”‘’…・]/u.test(
          char
        )
    )
    .join("");
}

function getEndingText(text) {
  return Array.from(String(text ?? "").trim())
    .slice(-TREND_JOKE_HISTORY_ENDING_LENGTH)
    .join("");
}

function shuffleArray(values) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
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

async function updateTrendJokeState(
  config,
  key,
  { prepared, composedText, copySource }
) {
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
        copySource: copySource ?? "fallback",
        textLength: Array.from(composedText).length,
      },
    },
  };

  const filePath = getTrendJokeStatePath(config);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(nextState, null, 2));
}

async function readTrendJokeHistory(config, { strict }) {
  const filePath = getTrendJokeHistoryPath(config);
  try {
    const text = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("history root must be an object");
    }
    if (!Array.isArray(parsed.entries)) {
      throw new Error("history entries must be an array");
    }
    return {
      version: 1,
      maxEntries: TREND_JOKE_HISTORY_MAX_ENTRIES,
      ...parsed,
      entries: parsed.entries.filter(
        (entry) => entry && typeof entry === "object"
      ),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createEmptyTrendJokeHistory();
    }
    const message = `Trend joke history could not be read: ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (strict) {
      throw new Error(message);
    }
    console.warn(`${message}. Continuing dry-run with empty history.`);
    return createEmptyTrendJokeHistory();
  }
}

async function updateTrendJokeHistory(
  config,
  { prepared, composedText, shape, copySource }
) {
  const history = await readTrendJokeHistory(config, { strict: true });
  const entry = buildTrendJokeHistoryEntry(config, {
    prepared,
    composedText,
    shape,
    copySource,
  });
  const nextHistory = {
    version: 1,
    maxEntries: TREND_JOKE_HISTORY_MAX_ENTRIES,
    entries: [entry, ...(history.entries ?? [])].slice(
      0,
      TREND_JOKE_HISTORY_MAX_ENTRIES
    ),
  };
  await writeJsonFileAtomic(
    getTrendJokeHistoryPath(config),
    JSON.stringify(nextHistory, null, 2)
  );
}

function buildTrendJokeHistoryEntry(
  config,
  { prepared, composedText, shape, copySource }
) {
  const text = validateTrendJokeText(composedText);
  return {
    postedAt: new Date().toISOString(),
    accountHandle: config.accountHandle,
    runDate: prepared.runDate,
    runSlot: prepared.runSlot,
    topicKey: prepared.topicKey,
    queryBundleKey: prepared.queryBundleKey,
    searchFingerprint: prepared.searchFingerprint,
    copySource: copySource ?? "fallback",
    shape: typeof shape === "string" && shape ? shape : null,
    text,
    normalizedText: normalizeTrendJokeText(text),
    endingText: getEndingText(text),
  };
}

function createEmptyTrendJokeHistory() {
  return {
    version: 1,
    maxEntries: TREND_JOKE_HISTORY_MAX_ENTRIES,
    entries: [],
  };
}

function getTrendJokeHistoryPath(config) {
  return path.join(
    config.cwd,
    "local/x-browser-posting/trend-joke-history.json"
  );
}

async function writeJsonFileAtomic(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${content}\n`);
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
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
  shape,
  copySource,
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
  console.log(`Copy source: ${copySource ?? "fallback"}`);
  console.log(`Shape: ${shape ?? "(none)"}`);
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
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
}

function clampInteger(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function readBooleanEnv(value, fallback) {
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
    automationId: "x-browser-post-trend-joke",
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

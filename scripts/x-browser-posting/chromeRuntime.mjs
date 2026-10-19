import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const STDERR_LIMIT = 16 * 1024;

// Dependencies are injectable so startup failures can be tested without opening Chrome.
export function createChromeRuntime({
  fetchImpl = globalThis.fetch,
  spawnImpl = spawn,
  access = fs.access,
  mkdir = fs.mkdir,
  now = Date.now,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  async function request(cdpUrl, pathname, timeoutMs, json = true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${cdpUrl.replace(/\/+$/, "")}${pathname}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Chrome CDP returned HTTP ${response.status}`);
      return json ? await response.json() : await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function probe(cdpUrl, timeoutMs = 1000) {
    try {
      const version = await request(cdpUrl, "/json/version", timeoutMs);
      if (!version?.webSocketDebuggerUrl) {
        throw new Error("Chrome CDP /json/version did not include webSocketDebuggerUrl");
      }
      return null;
    } catch (error) {
      return error;
    }
  }

  function assertPermission(error, config) {
    if (errorCodes(error).some((code) => code === "EPERM" || code === "EACCES")) {
      throw diagnostic(
        "Chrome CDP access was denied by execution permissions (EPERM/EACCES). Allow local network access in the execution environment before retrying; starting Chrome cannot fix this restriction.",
        config,
        error
      );
    }
  }

  async function ensureCdpChromeAvailable(config) {
    const error = await probe(config.cdpUrl);
    if (!error) return;
    assertPermission(error, config);
    if (!config.autoStartChrome) {
      throw diagnostic("X_BROWSER_POST_AUTO_START_CHROME=false, so Chrome was not started automatically.", config, error);
    }
    await start(config, "https://x.com/home", { headless: config.headless }, error);
    console.log(`Started Chrome for X browser posting: ${config.cdpUrl}`);
  }

  async function launchCdpChrome(config, url, { headless = false } = {}) {
    const error = await probe(config.cdpUrl);
    if (!error) return;
    assertPermission(error, config);
    await start(config, url, { headless }, error);
  }

  async function start(config, url, { headless }, initialError) {
    const endpoint = new URL(config.cdpUrl);
    if (endpoint.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) {
      throw diagnostic("Chrome CDP is unavailable at a non-local HTTP endpoint; local Chrome was not started.", config, initialError);
    }
    if (!errorCodes(initialError).includes("ECONNREFUSED")) {
      throw diagnostic("Chrome CDP probe failed without a refused connection; resolve the connection error before starting another Chrome.", config, initialError);
    }
    if (!config.chromeExecutablePath || !config.userDataDir) {
      throw diagnostic("Set X_BROWSER_POST_CHROME_EXECUTABLE_PATH and X_BROWSER_POST_USER_DATA_DIR to launch Chrome with a dedicated persistent profile.", config, initialError);
    }
    try {
      await access(config.chromeExecutablePath);
      await mkdir(config.userDataDir, { recursive: true });
    } catch (error) {
      throw diagnostic("Chrome executable or profile could not be accessed.", config, error);
    }

    let child;
    let stderr = "";
    let childFailure = null;
    const capture = (chunk) => { stderr = (stderr + chunk.toString()).slice(-STDERR_LIMIT); };
    const onError = (error) => { childFailure = error; };
    const onExit = (code, signal) => {
      childFailure = new Error(`Chrome exited before CDP became ready (exit=${code}, signal=${signal ?? "none"}). An existing Chrome using the same profile may have accepted the launch without enabling CDP.`);
    };
    try {
      child = spawnImpl(config.chromeExecutablePath, [
        `--user-data-dir=${config.userDataDir}`,
        `--remote-debugging-port=${endpoint.port || "80"}`,
        ...(headless ? ["--headless=new"] : []),
        url,
      ], { detached: true, stdio: ["ignore", "ignore", "pipe"] });
      child.on("error", onError);
      child.on("exit", onExit);
      child.stderr?.on("data", capture);
      child.unref();
      const timeoutMs = config.chromeStartupTimeoutMs ?? 20000;
      const deadline = now() + timeoutMs;
      let lastError = initialError;
      while (now() < deadline) {
        if (childFailure) throw childFailure;
        lastError = await probe(config.cdpUrl, Math.max(1, Math.min(1000, deadline - now())));
        if (childFailure) throw childFailure;
        if (!lastError) return;
        assertPermission(lastError, config);
        await wait(Math.min(500, Math.max(0, deadline - now())));
      }
      if (childFailure) throw childFailure;
      throw new Error(`Timed out after ${timeoutMs}ms waiting for Chrome CDP. Last connection error: ${describeError(lastError)}`, { cause: lastError });
    } catch (error) {
      throw diagnostic("Chrome did not become ready. If another Chrome uses this profile without CDP, close that Chrome normally and retry.", config, error, stderr);
    } finally {
      child?.removeListener("exit", onExit);
      // Keep the error listener to consume asynchronous spawn errors, but drop
      // captured stderr and unref the draining pipe so the CLI can exit normally.
      child?.stderr?.removeListener("data", capture);
      child?.stderr?.resume();
      child?.stderr?.unref?.();
      stderr = "";
    }
  }

  async function closeStaleComposeTabs(cdpUrl) {
    let targets;
    try {
      targets = await request(cdpUrl, "/json/list", 2000);
    } catch {
      return 0;
    }
    if (!Array.isArray(targets)) return 0;
    let closedCount = 0;
    for (const target of targets) {
      if (target?.type !== "page" || !/^https:\/\/(x|twitter)\.com\/compose\/post(?:[?#].*)?$/.test(target.url ?? "")) continue;
      try {
        await request(cdpUrl, `/json/close/${encodeURIComponent(target.id)}`, 1000, false);
        closedCount += 1;
      } catch {
        // An already-closed compose tab must not prevent posting.
      }
    }
    return closedCount;
  }
  return { ensureCdpChromeAvailable, launchCdpChrome, closeStaleComposeTabs };
}

function errorCodes(error, seen = new Set()) {
  if (!error || typeof error !== "object" || seen.has(error)) return [];
  seen.add(error);
  return [error.code, ...errorCodes(error.cause, seen), ...(error.errors ?? []).flatMap((nested) => errorCodes(nested, seen))].filter(Boolean);
}

function describeError(error) {
  const codes = errorCodes(error).join(", ");
  const messages = [error?.message, error?.cause?.message].filter(Boolean).join(": ");
  return `${messages || String(error)}${codes ? ` (${codes})` : ""}`;
}

function diagnostic(message, config, cause, stderr = "") {
  return new Error([
    message,
    `CDP: ${config.cdpUrl}`,
    `Profile: ${config.userDataDir || "(not configured)"}`,
    "Manual login: npm run x:browser-post -- --login-only (use the same environment/profile).",
    `Cause: ${describeError(cause)}`,
    ...(stderr.trim() ? [`Chrome stderr (last ${STDERR_LIMIT} characters):\n${stderr.trim()}`] : []),
  ].join("\n"), { cause });
}

export const { ensureCdpChromeAvailable, launchCdpChrome, closeStaleComposeTabs } = createChromeRuntime();

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { createChromeRuntime } from "./chromeRuntime.mjs";

const config = {
  cdpUrl: "http://127.0.0.1:9222",
  chromeExecutablePath: "/Applications/Chrome",
  userDataDir: "/tmp/x-test-profile",
  autoStartChrome: true,
  chromeStartupTimeoutMs: 1000,
};
function unavailable(code = "ECONNREFUSED") {
  return new TypeError("fetch failed", { cause: Object.assign(new Error("connect failed"), { code }) });
}
function harness({ fetchImpl, onSpawn } = {}) {
  let time = 0;
  let starts = 0;
  let pipeUnrefs = 0;
  const child = new EventEmitter();
  child.stderr = new PassThrough();
  child.stderr.unref = () => { pipeUnrefs += 1; };
  child.unref = () => {};
  const runtime = createChromeRuntime({
    fetchImpl: fetchImpl ?? (async () => { throw unavailable(); }),
    spawnImpl: (...args) => { starts += 1; queueMicrotask(() => onSpawn?.(child)); return child; },
    access: async () => {},
    mkdir: async () => {},
    now: () => time,
    wait: async (ms) => { time += ms; },
  });
  return { runtime, child, starts: () => starts, pipeUnrefs: () => pipeUnrefs };
}
const ready = () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1/devtools/browser/1" }) });

test("existing CDP is reused without launching Chrome", async () => {
  const h = harness({ fetchImpl: async () => ready() });
  await h.runtime.ensureCdpChromeAvailable(config);
  assert.equal(h.starts(), 0);
});

test("nested permission failure stops before launch and describes environment fix", async () => {
  const h = harness({ fetchImpl: async () => { throw new AggregateError([unavailable("EPERM")]); } });
  await assert.rejects(h.runtime.ensureCdpChromeAvailable(config), /execution permissions.*EPERM\/EACCES/);
  assert.equal(h.starts(), 0);
});

test("refused connection launches and waits for CDP, then drops stderr capture", async () => {
  let probes = 0;
  const h = harness({ fetchImpl: async () => { if (++probes < 3) throw unavailable(); return ready(); } });
  await h.runtime.launchCdpChrome(config, "https://x.com/login");
  assert.equal(h.starts(), 1);
  assert.equal(probes, 3);
  assert.equal(h.child.stderr.listenerCount("data"), 0);
  assert.equal(h.pipeUnrefs(), 1);
});

test("login startup detects early Chrome exit and includes bounded stderr", async () => {
  const h = harness({ onSpawn: (child) => {
    child.stderr.write("a".repeat(20000) + "PROFILE_IN_USE");
    child.emit("exit", 0, null);
  } });
  await assert.rejects(h.runtime.launchCdpChrome(config, "https://x.com/login"), (error) => {
    assert.match(error.message, /exited before CDP became ready/);
    assert.match(error.message, /PROFILE_IN_USE/);
    assert.ok(error.message.length < 18000);
    assert.match(error.message, /Profile: \/tmp\/x-test-profile/);
    return true;
  });
  assert.equal(h.pipeUnrefs(), 1);
});

test("asynchronous spawn permission error is reported instead of timing out", async () => {
  const h = harness({ onSpawn: (child) => child.emit("error", Object.assign(new Error("spawn denied"), { code: "EACCES" })) });
  await assert.rejects(h.runtime.launchCdpChrome(config, "https://x.com/login"), /spawn denied.*EACCES/);
});

test("timeout reports last connection cause, profile and manual recovery command", async () => {
  const h = harness();
  await assert.rejects(h.runtime.ensureCdpChromeAvailable(config), (error) => {
    assert.match(error.message, /Timed out after 1000ms/);
    assert.match(error.message, /ECONNREFUSED/);
    assert.match(error.message, /Profile: \/tmp\/x-test-profile/);
    assert.match(error.message, /npm run x:browser-post -- --login-only/);
    return true;
  });
});

test("remote or ambiguous endpoints never trigger a local Chrome launch", async () => {
  for (const cdpUrl of ["http://other.example:9222", "https://127.0.0.1:9222"]) {
    const h = harness();
    await assert.rejects(h.runtime.launchCdpChrome({ ...config, cdpUrl }, "https://x.com/login"), /non-local HTTP endpoint/);
    assert.equal(h.starts(), 0);
  }
  const h = harness({ fetchImpl: async () => { throw unavailable("ETIMEDOUT"); } });
  await assert.rejects(h.runtime.ensureCdpChromeAvailable(config), /without a refused connection/);
  assert.equal(h.starts(), 0);
});

test("compose cleanup accepts Chrome's text close response and counts successful closes", async () => {
  const paths = [];
  const h = harness({ fetchImpl: async (url) => {
    paths.push(url);
    if (url.endsWith("/json/list")) return { ok: true, json: async () => [
      { id: "one", type: "page", url: "https://x.com/compose/post" },
      { id: "two", type: "page", url: "https://twitter.com/compose/post?foo=1" },
      { id: "three", type: "page", url: "https://x.com/home" },
    ] };
    return { ok: true, text: async () => "Target is closing" };
  } });
  assert.equal(await h.runtime.closeStaleComposeTabs(config.cdpUrl), 2);
  assert.equal(paths.length, 3);
});

test("disabled auto start reports recovery instructions without spawning", async () => {
  const h = harness();
  await assert.rejects(h.runtime.ensureCdpChromeAvailable({ ...config, autoStartChrome: false }), /AUTO_START_CHROME=false/);
  assert.equal(h.starts(), 0);
});

test("permission failure discovered after launch stops retrying promptly", async () => {
  let probes = 0;
  const h = harness({ fetchImpl: async () => { throw unavailable(++probes === 1 ? "ECONNREFUSED" : "EACCES"); } });
  await assert.rejects(h.runtime.launchCdpChrome(config, "https://x.com/login"), /execution permissions/);
  assert.equal(probes, 2);
  assert.equal(h.pipeUnrefs(), 1);
});

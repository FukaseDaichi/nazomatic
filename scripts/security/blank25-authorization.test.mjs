import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(
  new URL("../../src/server/blank25/authorization.ts", import.meta.url),
  "utf8",
);
const authorizationModule = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);
const { authorizeBlank25Editor } = authorizationModule;
const nextServer = createRequire(import.meta.url)("next/server");

const withEditorCredentials = (t) => {
  const previousUser = process.env.BLANK25_EDITOR_USER;
  const previousPassword = process.env.BLANK25_EDITOR_PASSWORD;
  t.after(() => {
    if (previousUser === undefined) delete process.env.BLANK25_EDITOR_USER;
    else process.env.BLANK25_EDITOR_USER = previousUser;
    if (previousPassword === undefined) delete process.env.BLANK25_EDITOR_PASSWORD;
    else process.env.BLANK25_EDITOR_PASSWORD = previousPassword;
  });
  process.env.BLANK25_EDITOR_USER = "editor";
  process.env.BLANK25_EDITOR_PASSWORD = "test-password";
};

test("Editor API independently enforces Basic authentication and CSRF checks", async (t) => {
  withEditorCredentials(t);
  const authorization = `Basic ${Buffer.from("editor:test-password").toString("base64")}`;
  const request = (headers = {}, method = "POST") => new Request(
    "https://example.com/api/internal/blank25/editor/publish",
    { method, headers },
  );
  const status = (headers, method) => authorizeBlank25Editor(request(headers, method))?.status;

  assert.equal(status({}), 401);
  assert.equal(status({ "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" }), 401);
  assert.equal(status({ authorization: "Basic !!!" }), 401);
  assert.equal(status({ authorization: `Basic ${Buffer.from("editor:wrong-password").toString("base64")}` }), 401);
  assert.equal(status({ authorization }, "GET"), undefined);
  assert.equal(status({ authorization }), undefined, "non-browser clients may omit Origin");
  assert.equal(status({ authorization, origin: "https://example.com" }), undefined);
  assert.equal(status({ authorization, origin: "https://attacker.example" }), 403);
  assert.equal(status({ authorization, origin: "null" }), 403);
  assert.equal(status({ authorization, origin: "" }), 403);
  assert.equal(status({ authorization, "sec-fetch-site": "cross-site" }), 403);
  assert.equal(status({ authorization, origin: "https://example.com", "sec-fetch-site": "cross-site" }), 403);
  const denied = authorizeBlank25Editor(request());
  assert.equal(denied.headers.get("cache-control"), "no-store");
  assert.match(denied.headers.get("www-authenticate"), /^Basic /);

  delete process.env.BLANK25_EDITOR_PASSWORD;
  assert.equal(status({ authorization }), 503);
});

test("Editor handlers reject middleware bypass requests before storage access", async () => {
  for (const [route, method] of [["manifest", "GET"], ["publish", "POST"]]) {
    const routeSource = await readFile(new URL(
      `../../src/app/api/internal/blank25/editor/${route}/route.ts`,
      import.meta.url,
    ), "utf8");
    const compiled = ts.transpileModule(routeSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
      exports,
      require: (name) => name === "@/server/blank25/authorization"
        ? { authorizeBlank25Editor }
        : new Proxy({}, { get() { throw new Error("Storage or response construction reached before authentication"); } }),
    });
    const response = await exports[method](new Request(
      `https://example.com/api/internal/blank25/editor/${route}`,
      { method, headers: { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" } },
    ));
    assert.ok([401, 503].includes(response.status));
  }
});

test("Proxy reuses the shared constant-time Basic authentication", async (t) => {
  const proxySource = await readFile(new URL("../../src/proxy.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(proxySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "next/server") return nextServer;
      if (name === "@/server/blank25/authorization") return authorizationModule;
      throw new Error(`Unexpected proxy import: ${name}`);
    },
  });
  const { proxy, config } = exports;

  assert.deepEqual([...config.matcher], ["/blank25/editor/:path*", "/api/internal/blank25/editor/:path*"]);

  withEditorCredentials(t);
  const authorization = `Basic ${Buffer.from("editor:test-password").toString("base64")}`;
  const run = (path, headers = {}, method = "GET") => proxy(new nextServer.NextRequest(
    `https://example.com${path}`,
    { method, headers },
  ));
  const passes = (response) => response.headers.get("x-middleware-next") === "1";

  for (const path of ["/blank25/editor", "/api/internal/blank25/editor/manifest"]) {
    const denied = run(path);
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get("cache-control"), "no-store");
    assert.equal(denied.headers.get("www-authenticate"), 'Basic realm="BLANK25 Editor", charset="UTF-8"');
    assert.equal(run(path, { authorization: "Basic !!!" }).status, 401);
    assert.equal(run(path, { authorization: `Basic ${Buffer.from("editor:test-passwore").toString("base64")}` }).status, 401);
    assert.equal(run(path, { authorization: `Basic ${Buffer.from("editor:test-password!").toString("base64")}` }).status, 401);
    assert.ok(passes(run(path, { authorization })));
  }

  const publish = "/api/internal/blank25/editor/publish";
  assert.ok(passes(run(publish, { authorization }, "POST")));
  assert.ok(passes(run(publish, { authorization, origin: "https://example.com" }, "POST")));
  assert.equal(run(publish, { authorization, origin: "https://attacker.example" }, "POST").status, 403);
  assert.equal(run(publish, { authorization, "sec-fetch-site": "cross-site" }, "POST").status, 403);
  assert.ok(
    passes(run("/blank25/editor", { authorization, origin: "https://attacker.example" }, "POST")),
    "Origin checks stay limited to the Editor API",
  );

  delete process.env.BLANK25_EDITOR_PASSWORD;
  const unconfigured = run("/blank25/editor", { authorization });
  assert.equal(unconfigured.status, 503);
  assert.equal(unconfigured.headers.get("cache-control"), "no-store");
});

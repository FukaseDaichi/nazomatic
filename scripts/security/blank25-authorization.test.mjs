import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(
  new URL("../../src/server/blank25/authorization.ts", import.meta.url),
  "utf8",
);
const { authorizeBlank25Editor } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);

test("Editor API independently enforces Basic authentication and CSRF checks", async (t) => {
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

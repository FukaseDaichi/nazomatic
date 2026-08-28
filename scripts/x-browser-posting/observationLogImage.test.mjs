import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  filterSavedPaths,
  parseSavedImagePaths,
  validateGeneratedImage,
} from "./observationLogImage.mjs";

test("parseSavedImagePaths extracts SAVED lines only", () => {
  const stdout = [
    "thinking...",
    "SAVED: /tmp/a.png",
    "note SAVED: inline should not match",
    "SAVED:   /tmp/b with space.png  ",
  ].join("\n");
  assert.deepEqual(parseSavedImagePaths(stdout), [
    "/tmp/a.png",
    "/tmp/b with space.png",
  ]);
});

test("validateGeneratedImage accepts a PNG above the size floor", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-img-"));
  const file = path.join(dir, "ok.png");
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(20_000, 1),
  ]);
  fs.writeFileSync(file, png);
  assert.equal(validateGeneratedImage(file), true);
});

test("filterSavedPaths keeps only fresh files under workDir", () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-work-"));
  const inside = path.join(workDir, "in.png");
  fs.writeFileSync(inside, "x");
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-out-"));
  const outside = path.join(outsideDir, "out.png");
  fs.writeFileSync(outside, "x");
  const startedAtMs = fs.statSync(inside).mtimeMs - 1;
  assert.deepEqual(
    filterSavedPaths([inside, outside, path.join(workDir, "missing.png")], {
      workDir,
      startedAtMs,
    }),
    [inside]
  );
  assert.deepEqual(
    filterSavedPaths([inside], {
      workDir,
      startedAtMs: fs.statSync(inside).mtimeMs + 10_000,
    }),
    []
  );
});

test("validateGeneratedImage rejects tiny or non-image files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-img-"));
  const tiny = path.join(dir, "tiny.png");
  fs.writeFileSync(tiny, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const text = path.join(dir, "text.png");
  fs.writeFileSync(text, Buffer.alloc(20_000, 0x41));
  assert.equal(validateGeneratedImage(tiny), false);
  assert.equal(validateGeneratedImage(text), false);
  assert.equal(validateGeneratedImage(path.join(dir, "missing.png")), false);
});

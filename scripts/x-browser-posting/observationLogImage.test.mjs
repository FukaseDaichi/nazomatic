import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildObservationImageInstruction,
  filterSavedPaths,
  generateObservationLogImage,
  parseSavedImagePaths,
  validateGeneratedImage,
} from "./observationLogImage.mjs";
import { observationCardLabels } from "./observationLogCard.mjs";

test("observation card preserves zero, combined query counts and cross-year dates", () => {
  for (const count of [0, 123, 600]) {
    assert.deepEqual(observationCardLabels({
      startDate: "2025-12-29", endDate: "2026-01-04", count,
    }), { range: "2025.12.29 — 2026.01.04", count: String(count) });
  }
});

test("observation card rejects malformed data instead of drawing misleading labels", () => {
  const valid = { startDate: "2026-08-29", endDate: "2026-09-04", count: 12 };
  for (const value of [null, {},
    { ...valid, count: -1 }, { ...valid, count: 1.5 },
    { ...valid, count: "12" }, { ...valid, count: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, startDate: "2026-02-30" },
    { ...valid, startDate: "<script>alert(1)</script>" },
    { ...valid, endDate: "2026-09-05" },
  ]) assert.throws(() => observationCardLabels(value));
});

test("image instruction supplies an actual image reference and forbids attaching it", () => {
  const reference = "/tmp/weekly images/character-reference.png";
  const instruction = buildObservationImageInstruction("scene", reference);
  assert.ok(instruction.includes(JSON.stringify(reference)));
  assert.match(instruction, /view_image/);
  assert.match(instruction, /referenced_image_paths/);
  assert.match(instruction, /Do not return, overwrite or attach the reference itself/);
});

test("invalid card data degrades before invoking image generation", async () => {
  const warnings = [];
  const result = await generateObservationLogImage({
    prompt: "unused", workDir: "/nonexistent/unused", pastWindow: null,
    log: { warn: (message) => warnings.push(message) },
  });
  assert.equal(result, null);
  assert.match(warnings[0], /Invalid observation card date/);
});

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

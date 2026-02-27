#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REPORT_ROOT = path.join(".codex", "shift-search", "reports");
const MANIFEST_PATH = path.join(
  REPORT_ROOT,
  "shift-search-report-manifest.json",
);

const GENERATED_ROOT = path.join("src", "generated", "shift-search");
const INTERNAL_OUTPUT_DIR = path.join(GENERATED_ROOT, "internal");
const VIEW_MANIFEST_PATH = path.join(GENERATED_ROOT, "view-manifest.json");
const DEFAULT_EXTERNAL_ROW_THRESHOLD = 10000;

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDirectory(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return null;
  }

  const inner = trimmed.slice(1, -1);
  const columns = inner
    .split(/(?<!\\)\|/g)
    .map((value) => value.trim().replace(/\\\|/g, "|"));

  return columns;
}

function parseReportRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (!inTable) {
      if (line.trim() === "| inputWord | shift | shiftedWord | matchType |") {
        inTable = true;
      }
      continue;
    }

    if (!line.trim()) {
      continue;
    }
    if (line.trim() === "|---|---:|---|---|") {
      continue;
    }
    if (!line.trim().startsWith("|")) {
      break;
    }

    const columns = splitMarkdownRow(line);
    if (!columns || columns.length < 4) {
      continue;
    }

    const shift = Number(columns[1]);
    if (!Number.isFinite(shift)) {
      continue;
    }

    rows.push({
      inputWord: columns[0],
      shift,
      shiftedWord: columns[2],
      matchType: columns[3],
    });
  }

  return rows;
}

function resolveReport(report, externalRowThreshold) {
  const reportKey = report.reportKey ?? `${report.language}-${report.length}`;
  const deliveryType =
    report.deliveryType ??
    (report.totalHitRows > externalRowThreshold ? "external" : "internal");

  return {
    ...report,
    reportKey,
    deliveryType,
    externalUrl:
      typeof report.externalUrl === "string" && report.externalUrl.trim()
        ? report.externalUrl.trim()
        : null,
  };
}

function buildInternalReportData(report, rows) {
  return {
    reportKey: report.reportKey,
    language: report.language,
    length: report.length,
    dictionary: report.dictionary,
    targetWordCount: report.targetWordCount,
    executedWordCount: report.executedWordCount,
    totalHitRows: report.totalHitRows,
    startedAt: report.startedAt,
    generatedAt: report.generatedAt,
    rowCount: rows.length,
    rows,
  };
}

function toViewReport(report, internalDataFile) {
  return {
    reportKey: report.reportKey,
    language: report.language,
    length: report.length,
    dictionary: report.dictionary,
    targetWordCount: report.targetWordCount,
    executedWordCount: report.executedWordCount,
    totalHitRows: report.totalHitRows,
    generatedAt: report.generatedAt,
    sizeBytes: report.sizeBytes,
    deliveryType: report.deliveryType,
    externalUrl: report.externalUrl,
    internalDataFile,
  };
}

function main() {
  const now = new Date().toISOString();
  const manifest = readManifest();
  const externalRowThreshold =
    Number.isInteger(manifest.externalRowThreshold) &&
    manifest.externalRowThreshold > 0
      ? manifest.externalRowThreshold
      : DEFAULT_EXTERNAL_ROW_THRESHOLD;

  ensureDirectory(GENERATED_ROOT);
  cleanDirectory(INTERNAL_OUTPUT_DIR);

  const reports = (manifest.reports ?? [])
    .map((report) => resolveReport(report, externalRowThreshold))
    .sort((a, b) => {
      if (a.language !== b.language) {
        return a.language.localeCompare(b.language);
      }
      return a.length - b.length;
    });

  const viewReports = [];
  let internalCount = 0;
  let externalCount = 0;
  let unresolvedExternalCount = 0;

  for (const report of reports) {
    if (report.deliveryType === "internal") {
      const markdown = fs.readFileSync(report.path, "utf8");
      const rows = parseReportRows(markdown);
      const data = buildInternalReportData(report, rows);
      const fileName = `${report.language}-${report.length}.json`;
      const outputPath = path.join(INTERNAL_OUTPUT_DIR, fileName);

      fs.writeFileSync(
        `${outputPath}`,
        `${JSON.stringify(data, null, 2)}\n`,
        "utf8",
      );
      viewReports.push(toViewReport(report, `internal/${fileName}`));
      internalCount += 1;
      continue;
    }

    if (!report.externalUrl) {
      unresolvedExternalCount += 1;
    }
    externalCount += 1;
    viewReports.push(toViewReport(report, null));
  }

  const viewManifest = {
    generatedAt: now,
    sourceManifestGeneratedAt: manifest.generatedAt ?? null,
    externalRowThreshold,
    reportCount: viewReports.length,
    groups: manifest.groups ?? {},
    delivery: {
      internalCount,
      externalCount,
      unresolvedExternalCount,
    },
    reports: viewReports,
  };

  fs.writeFileSync(
    VIEW_MANIFEST_PATH,
    `${JSON.stringify(viewManifest, null, 2)}\n`,
    "utf8",
  );

  // eslint-disable-next-line no-console
  console.log(
    `[done] generated view assets (internal=${internalCount}, external=${externalCount}, unresolvedExternal=${unresolvedExternalCount})`,
  );
}

main();

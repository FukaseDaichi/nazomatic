#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REPORT_ROOT = path.join("codex", "reports");
const REPORT_FILENAME_REGEX = /^shift-search-(jp|en)-len-(\d+)\.md$/;
const INDEX_PATH = path.join(REPORT_ROOT, "shift-search-report-index.md");
const MANIFEST_PATH = path.join(REPORT_ROOT, "shift-search-report-manifest.json");

function parseRequiredMatch(content, pattern, label) {
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Missing "${label}" in report header.`);
  }
  return match[1].trim();
}

function parseRequiredNumber(content, key) {
  const raw = parseRequiredMatch(content, new RegExp(`^- ${key}: (\\d+)$`, "m"), key);
  return Number(raw);
}

function parseReport(filePath, language, length) {
  const content = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);

  const dictionary = parseRequiredMatch(content, /^- dictionary: (.+)$/m, "dictionary");
  const targetWordCount = parseRequiredNumber(content, "targetWordCount");
  const executedWordCount = parseRequiredNumber(content, "executedWordCount");
  const totalHitRows = parseRequiredNumber(content, "totalHitRows");
  const startedAt = parseRequiredMatch(content, /^- startedAt: (.+)$/m, "startedAt");
  const generatedAt = parseRequiredMatch(content, /^- generatedAt: (.+)$/m, "generatedAt");

  return {
    language,
    length,
    dictionary,
    targetWordCount,
    executedWordCount,
    totalHitRows,
    startedAt,
    generatedAt,
    path: filePath.replace(/\\/g, "/"),
    sizeBytes: stat.size,
  };
}

function listLanguageReports(language) {
  const dirPath = path.join(REPORT_ROOT, language);
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const reports = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = entry.name.match(REPORT_FILENAME_REGEX);
    if (!match || match[1] !== language) {
      continue;
    }

    const length = Number(match[2]);
    const filePath = path.join(dirPath, entry.name);
    reports.push(parseReport(filePath, language, length));
  }

  return reports.sort((a, b) => a.length - b.length);
}

function buildGroup(reports) {
  return {
    reportCount: reports.length,
    totalTargetWordCount: reports.reduce((sum, report) => sum + report.targetWordCount, 0),
    totalExecutedWordCount: reports.reduce((sum, report) => sum + report.executedWordCount, 0),
    totalHitRows: reports.reduce((sum, report) => sum + report.totalHitRows, 0),
  };
}

function buildIndexTableRows(reports) {
  return reports.map(
    (report) =>
      `| ${report.length} | ${report.targetWordCount} | ${report.executedWordCount} | ${report.totalHitRows} | [${path.basename(report.path)}](${report.path}) |`
  );
}

function writeManifest({ generatedAt, jpReports, enReports }) {
  const reports = [...enReports, ...jpReports];
  const manifest = {
    generatedAt,
    reportCount: reports.length,
    groups: {
      jp: buildGroup(jpReports),
      en: buildGroup(enReports),
    },
    reports,
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function writeIndex({ generatedAt, jpReports, enReports }) {
  const jpTotalHitRows = jpReports.reduce((sum, report) => sum + report.totalHitRows, 0);
  const enTotalHitRows = enReports.reduce((sum, report) => sum + report.totalHitRows, 0);
  const reportCount = jpReports.length + enReports.length;

  const lines = [
    "# shift-search report index",
    "",
    `- generatedAt: ${generatedAt}`,
    `- reportCount: ${reportCount}`,
    `- jpTotalHitRows: ${jpTotalHitRows}`,
    `- enTotalHitRows: ${enTotalHitRows}`,
    "",
    "## JP Reports",
    "",
    "| Length | Target | Executed | HitRows | File |",
    "|---:|---:|---:|---:|---|",
    ...buildIndexTableRows(jpReports),
    "",
    "## EN Reports",
    "",
    "| Length | Target | Executed | HitRows | File |",
    "|---:|---:|---:|---:|---|",
    ...buildIndexTableRows(enReports),
    "",
  ];

  fs.writeFileSync(INDEX_PATH, lines.join("\n"), "utf8");
}

function main() {
  const generatedAt = new Date().toISOString();
  const jpReports = listLanguageReports("jp");
  const enReports = listLanguageReports("en");

  writeManifest({ generatedAt, jpReports, enReports });
  writeIndex({ generatedAt, jpReports, enReports });

  // eslint-disable-next-line no-console
  console.log(
    `[done] generated index and manifest (jp=${jpReports.length}, en=${enReports.length}, total=${jpReports.length + enReports.length})`
  );
}

main();

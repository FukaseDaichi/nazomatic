import "server-only";

import fs from "node:fs";
import path from "node:path";
import viewManifestJson from "@/generated/shift-search/view-manifest.json";

export type ShiftSearchReportLanguage = "jp" | "en";
export type ShiftSearchReportDeliveryType = "internal" | "external";

export type ShiftSearchViewReport = {
  reportKey: string;
  language: ShiftSearchReportLanguage;
  length: number;
  dictionary: string;
  targetWordCount: number;
  executedWordCount: number;
  totalHitRows: number;
  generatedAt: string;
  sizeBytes: number;
  deliveryType: ShiftSearchReportDeliveryType;
  externalUrl: string | null;
  internalDataFile: string | null;
};

export type ShiftSearchViewManifest = {
  generatedAt: string;
  sourceManifestGeneratedAt: string | null;
  externalRowThreshold: number;
  reportCount: number;
  groups: Record<string, unknown>;
  delivery: {
    internalCount: number;
    externalCount: number;
    unresolvedExternalCount: number;
  };
  reports: ShiftSearchViewReport[];
};

export type ShiftSearchReportRow = {
  inputWord: string;
  shift: number;
  shiftedWord: string;
  matchType: string;
  matchedWords?: string[];
};

export type ShiftSearchInternalReport = {
  reportKey: string;
  language: ShiftSearchReportLanguage;
  length: number;
  dictionary: string;
  targetWordCount: number;
  executedWordCount: number;
  totalHitRows: number;
  startedAt: string;
  generatedAt: string;
  rowCount: number;
  rows: ShiftSearchReportRow[];
};

const VIEW_MANIFEST = viewManifestJson as ShiftSearchViewManifest;
const INTERNAL_DATA_DIR = path.join(
  process.cwd(),
  "src",
  "generated",
  "shift-search",
  "internal",
);

function compareReport(left: ShiftSearchViewReport, right: ShiftSearchViewReport) {
  if (left.language !== right.language) {
    if (left.language === "jp") {
      return -1;
    }
    return 1;
  }
  return left.length - right.length;
}

export function getShiftSearchViewManifest(): ShiftSearchViewManifest {
  return VIEW_MANIFEST;
}

export function getShiftSearchViewReports(): ShiftSearchViewReport[] {
  return [...VIEW_MANIFEST.reports].sort(compareReport);
}

export function getShiftSearchViewReport(
  language: ShiftSearchReportLanguage,
  length: number,
): ShiftSearchViewReport | undefined {
  return VIEW_MANIFEST.reports.find(
    (report) => report.language === language && report.length === length,
  );
}

export function getInternalStaticParams(): Array<{
  lang: ShiftSearchReportLanguage;
  length: string;
}> {
  return getShiftSearchViewReports()
    .filter((report) => report.deliveryType === "internal")
    .map((report) => ({
      lang: report.language,
      length: String(report.length),
    }));
}

export function readInternalShiftSearchReport(
  language: ShiftSearchReportLanguage,
  length: number,
): ShiftSearchInternalReport | null {
  const filePath = path.join(INTERNAL_DATA_DIR, `${language}-${length}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as ShiftSearchInternalReport;
}

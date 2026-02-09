import type { Blank25Manifest, Blank25Problem } from "@/components/blank25/types";

type ManifestResult =
  | { ok: true; manifest: Blank25Manifest }
  | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const parseProblem = (value: unknown): Blank25Problem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const linkName = value.linkName;
  const imageFile = value.imageFile;
  const answers = value.answers;

  if (typeof id !== "string") return null;
  if (typeof linkName !== "string") return null;
  if (typeof imageFile !== "string") return null;
  if (!isStringArray(answers)) return null;

  return { id, linkName, imageFile, answers };
};

const parseManifest = (value: unknown): Blank25Manifest | null => {
  if (!isRecord(value)) {
    return null;
  }

  const version = value.version;
  const problems = value.problems;

  if (typeof version !== "number" || !Number.isFinite(version)) {
    return null;
  }

  if (!Array.isArray(problems)) {
    return null;
  }

  const parsedProblems = problems
    .map((problem) => parseProblem(problem))
    .filter((problem): problem is Blank25Problem => problem !== null);

  if (parsedProblems.length !== problems.length) {
    return null;
  }

  return { version, problems: parsedProblems };
};

let cachedPromise: Promise<ManifestResult> | null = null;

export const fetchBlank25Manifest = async (): Promise<ManifestResult> => {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      try {
        const response = await fetch("/data/blank25/problems.json", {
          cache: "no-store",
        });
        if (!response.ok) {
          return {
            ok: false,
            error: `problems.json の取得に失敗しました（HTTP ${response.status}）`,
          };
        }

        const json = (await response.json()) as unknown;
        const manifest = parseManifest(json);
        if (!manifest) {
          return { ok: false, error: "problems.json の形式が不正です" };
        }

        const ids = new Set<string>();
        for (const problem of manifest.problems) {
          if (ids.has(problem.id)) {
            return { ok: false, error: `問題IDが重複しています: ${problem.id}` };
          }
          ids.add(problem.id);
        }

        return { ok: true, manifest };
      } catch {
        return { ok: false, error: "problems.json の読み込み中にエラーが発生しました" };
      }
    })();
  }

  return cachedPromise;
};


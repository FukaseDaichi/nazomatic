import type {
  Blank25Category,
  Blank25Manifest,
  Blank25Problem,
} from "@/components/blank25/types";

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

const parseCategory = (value: unknown): Blank25Category | null => {
  if (!isRecord(value)) return null;

  const id = value.id;
  const name = value.name;
  const description = value.description;
  const problems = value.problems;

  const color = value.color;

  if (typeof id !== "string") return null;
  if (typeof name !== "string") return null;
  if (typeof description !== "string") return null;
  if (typeof color !== "string") return null;
  if (!Array.isArray(problems)) return null;

  const parsedProblems = problems
    .map((p) => parseProblem(p))
    .filter((p): p is Blank25Problem => p !== null);

  if (parsedProblems.length !== problems.length) return null;

  return { id, name, description, color, problems: parsedProblems };
};

const parseManifest = (value: unknown): Blank25Manifest | null => {
  if (!isRecord(value)) {
    return null;
  }

  const version = value.version;
  const categories = value.categories;

  if (typeof version !== "number" || !Number.isFinite(version)) {
    return null;
  }

  if (!Array.isArray(categories)) {
    return null;
  }

  const parsedCategories = categories
    .map((c) => parseCategory(c))
    .filter((c): c is Blank25Category => c !== null);

  if (parsedCategories.length !== categories.length) {
    return null;
  }

  return { version, categories: parsedCategories };
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
        for (const category of manifest.categories) {
          for (const problem of category.problems) {
            if (ids.has(problem.id)) {
              return { ok: false, error: `問題IDが重複しています: ${problem.id}` };
            }
            ids.add(problem.id);
          }
        }

        return { ok: true, manifest };
      } catch {
        return { ok: false, error: "problems.json の読み込み中にエラーが発生しました" };
      }
    })();
  }

  return cachedPromise;
};

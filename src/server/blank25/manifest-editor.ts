import type {
  Blank25Category,
  Blank25Manifest,
  Blank25Problem,
} from "@/components/blank25/types";

const DEFAULT_MANIFEST_VERSION = 2;

type ProblemLocation = {
  categoryIndex: number;
  problemIndex: number;
  problem: Blank25Problem;
};

export class Blank25ManifestEditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Blank25ManifestEditorError";
  }
}

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
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const name = value.name;
  const description = value.description;
  const color = value.color;
  const problems = value.problems;

  if (typeof id !== "string") return null;
  if (typeof name !== "string") return null;
  if (typeof description !== "string") return null;
  if (typeof color !== "string") return null;
  if (!Array.isArray(problems)) return null;

  const parsedProblems = problems
    .map((problem) => parseProblem(problem))
    .filter((problem): problem is Blank25Problem => problem !== null);
  if (parsedProblems.length !== problems.length) {
    return null;
  }

  return {
    id,
    name,
    description,
    color,
    problems: parsedProblems,
  };
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
    .map((category) => parseCategory(category))
    .filter((category): category is Blank25Category => category !== null);
  if (parsedCategories.length !== categories.length) {
    return null;
  }

  return {
    version,
    categories: parsedCategories,
  };
};

const ensureUniqueProblemIds = (manifest: Blank25Manifest): void => {
  const ids = new Set<string>();
  for (const category of manifest.categories) {
    for (const problem of category.problems) {
      if (ids.has(problem.id)) {
        throw new Blank25ManifestEditorError(
          `Duplicate problem id detected: ${problem.id}`,
        );
      }
      ids.add(problem.id);
    }
  }
};

const cloneManifest = (manifest: Blank25Manifest): Blank25Manifest => ({
  version: manifest.version,
  categories: manifest.categories.map((category) => ({
    ...category,
    problems: category.problems.map((problem) => ({
      ...problem,
      answers: [...problem.answers],
    })),
  })),
});

const findProblemLocation = (
  manifest: Blank25Manifest,
  problemId: string,
): ProblemLocation | null => {
  for (let categoryIndex = 0; categoryIndex < manifest.categories.length; categoryIndex += 1) {
    const category = manifest.categories[categoryIndex];
    for (
      let problemIndex = 0;
      problemIndex < category.problems.length;
      problemIndex += 1
    ) {
      const problem = category.problems[problemIndex];
      if (problem.id === problemId) {
        return { categoryIndex, problemIndex, problem };
      }
    }
  }

  return null;
};

const findCategoryIndex = (
  manifest: Blank25Manifest,
  categoryId: string,
): number => manifest.categories.findIndex((category) => category.id === categoryId);

export const parseBlank25ManifestText = (manifestText: string): Blank25Manifest => {
  let raw: unknown;
  try {
    raw = JSON.parse(manifestText) as unknown;
  } catch {
    throw new Blank25ManifestEditorError("Manifest JSON is invalid.");
  }

  const parsed = parseManifest(raw);
  if (!parsed) {
    throw new Blank25ManifestEditorError("Manifest structure is invalid.");
  }

  ensureUniqueProblemIds(parsed);
  return parsed;
};

export const serializeBlank25Manifest = (manifest: Blank25Manifest): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;

export const listManifestProblems = (
  manifest: Blank25Manifest,
): Array<{ categoryId: string; problem: Blank25Problem }> =>
  manifest.categories.flatMap((category) =>
    category.problems.map((problem) => ({
      categoryId: category.id,
      problem,
    })),
  );

export const sanitizeBlank25Answers = (answers: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of answers) {
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    // 完全一致（trim後）でのみ重複排除。
    // ひらがな/カタカナなど表記ゆれの正規化はゲーム実行時に行う。
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

export const buildNextProblemId = (manifest: Blank25Manifest): string => {
  const pattern = /^blank25-(\d+)$/;
  let maxNumber = 0;

  for (const { problem } of listManifestProblems(manifest)) {
    const match = pattern.exec(problem.id);
    if (!match) {
      continue;
    }
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > maxNumber) {
      maxNumber = parsed;
    }
  }

  return `blank25-${String(maxNumber + 1).padStart(3, "0")}`;
};

export type CreateProblemInput = {
  categoryId: string;
  linkName: string;
  answers: string[];
  imageFileBuilder?: (problemId: string) => string;
};

export const createProblemInManifest = ({
  manifest,
  input,
}: {
  manifest: Blank25Manifest;
  input: CreateProblemInput;
}): { manifest: Blank25Manifest; problem: Blank25Problem } => {
  const targetCategoryIndex = findCategoryIndex(manifest, input.categoryId);
  if (targetCategoryIndex < 0) {
    throw new Blank25ManifestEditorError(
      `Category not found: ${input.categoryId}`,
    );
  }

  const linkName = input.linkName.trim();
  if (!linkName) {
    throw new Blank25ManifestEditorError("linkName is required.");
  }

  const sanitizedAnswers = sanitizeBlank25Answers(input.answers);
  if (sanitizedAnswers.length === 0) {
    throw new Blank25ManifestEditorError("At least one answer is required.");
  }

  const nextManifest = cloneManifest(manifest);
  const nextProblemId = buildNextProblemId(nextManifest);
  const imageFile = input.imageFileBuilder
    ? input.imageFileBuilder(nextProblemId)
    : `${nextProblemId}.webp`;

  const problem: Blank25Problem = {
    id: nextProblemId,
    linkName,
    imageFile,
    answers: sanitizedAnswers,
  };

  nextManifest.categories[targetCategoryIndex].problems.push(problem);
  ensureUniqueProblemIds(nextManifest);

  return {
    manifest: nextManifest,
    problem,
  };
};

export type UpdateProblemInput = {
  problemId: string;
  categoryId: string;
  linkName: string;
  answers: string[];
  imageFile?: string;
};

export const updateProblemInManifest = ({
  manifest,
  input,
}: {
  manifest: Blank25Manifest;
  input: UpdateProblemInput;
}): {
  manifest: Blank25Manifest;
  problem: Blank25Problem;
  previousImageFile: string;
} => {
  const currentLocation = findProblemLocation(manifest, input.problemId);
  if (!currentLocation) {
    throw new Blank25ManifestEditorError(
      `Problem not found: ${input.problemId}`,
    );
  }

  const targetCategoryIndex = findCategoryIndex(manifest, input.categoryId);
  if (targetCategoryIndex < 0) {
    throw new Blank25ManifestEditorError(
      `Category not found: ${input.categoryId}`,
    );
  }

  const linkName = input.linkName.trim();
  if (!linkName) {
    throw new Blank25ManifestEditorError("linkName is required.");
  }

  const sanitizedAnswers = sanitizeBlank25Answers(input.answers);
  if (sanitizedAnswers.length === 0) {
    throw new Blank25ManifestEditorError("At least one answer is required.");
  }

  const previousImageFile = currentLocation.problem.imageFile;
  const updatedProblem: Blank25Problem = {
    id: currentLocation.problem.id,
    linkName,
    imageFile: input.imageFile ?? currentLocation.problem.imageFile,
    answers: sanitizedAnswers,
  };

  const nextManifest = cloneManifest(manifest);
  const sourceCategory = nextManifest.categories[currentLocation.categoryIndex];
  sourceCategory.problems.splice(currentLocation.problemIndex, 1);

  if (currentLocation.categoryIndex === targetCategoryIndex) {
    sourceCategory.problems.splice(currentLocation.problemIndex, 0, updatedProblem);
  } else {
    nextManifest.categories[targetCategoryIndex].problems.push(updatedProblem);
  }

  ensureUniqueProblemIds(nextManifest);

  return {
    manifest: nextManifest,
    problem: updatedProblem,
    previousImageFile,
  };
};

export type DeleteProblemInput = {
  problemId: string;
};

export const deleteProblemFromManifest = ({
  manifest,
  input,
}: {
  manifest: Blank25Manifest;
  input: DeleteProblemInput;
}): {
  manifest: Blank25Manifest;
  problem: Blank25Problem;
} => {
  const location = findProblemLocation(manifest, input.problemId);
  if (!location) {
    throw new Blank25ManifestEditorError(
      `Problem not found: ${input.problemId}`,
    );
  }

  const nextManifest = cloneManifest(manifest);
  nextManifest.categories[location.categoryIndex].problems.splice(
    location.problemIndex,
    1,
  );
  ensureUniqueProblemIds(nextManifest);

  return {
    manifest: nextManifest,
    problem: location.problem,
  };
};

export const createEmptyBlank25Manifest = (): Blank25Manifest => ({
  version: DEFAULT_MANIFEST_VERSION,
  categories: [],
});

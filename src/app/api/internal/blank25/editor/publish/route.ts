import { NextResponse } from "next/server";

import {
  commitFilesToBlank25Branch,
  encodeUtf8AsBase64,
  fetchBlank25ManifestFile,
  GitHubApiError,
  loadBlank25GitHubConfig,
} from "@/server/blank25/github";
import {
  Blank25ManifestEditorError,
  createProblemInManifest,
  deleteProblemFromManifest,
  parseBlank25ManifestText,
  serializeBlank25Manifest,
  updateProblemInManifest,
} from "@/server/blank25/manifest-editor";

export const runtime = "nodejs";

type PublishImagePayload = {
  base64: string;
  contentType: string;
};

type PublishRequestBody = {
  mode: "create" | "update" | "delete";
  problemId?: string;
  categoryId: string;
  linkName: string;
  answers: string[];
  image?: PublishImagePayload;
  baseManifestSha?: string;
};

type PublishSuccessResponse = {
  ok: true;
  mode: "create" | "update" | "delete";
  problemId: string;
  imageFile: string;
  commitSha: string;
  previousImageFile?: string;
};

type PublishErrorResponse = {
  ok: false;
  error: string;
};

const IMAGE_EXTENSION_MAP: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

const readJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw new Blank25ManifestEditorError("Invalid JSON body.");
  }
};

const toStringValue = (
  value: unknown,
  fieldName: string,
  required = true,
): string | undefined => {
  if (value === undefined || value === null) {
    if (!required) {
      return undefined;
    }
    throw new Blank25ManifestEditorError(`${fieldName} is required.`);
  }
  if (typeof value !== "string") {
    throw new Blank25ManifestEditorError(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed && required) {
    throw new Blank25ManifestEditorError(`${fieldName} must not be empty.`);
  }
  return trimmed || undefined;
};

const toAnswers = (value: unknown): string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Blank25ManifestEditorError("answers must be a string array.");
  }
  return value;
};

const parseImagePayload = (value: unknown): PublishImagePayload | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object") {
    throw new Blank25ManifestEditorError("image must be an object.");
  }

  const record = value as Record<string, unknown>;
  const base64 = toStringValue(record.base64, "image.base64");
  const contentType = toStringValue(record.contentType, "image.contentType");
  if (!base64 || !contentType) {
    throw new Blank25ManifestEditorError("image payload is invalid.");
  }
  if (!IMAGE_EXTENSION_MAP[contentType]) {
    throw new Blank25ManifestEditorError(
      `Unsupported image content type: ${contentType}`,
    );
  }

  return {
    base64,
    contentType,
  };
};

const parseBody = (raw: unknown): PublishRequestBody => {
  if (!raw || typeof raw !== "object") {
    throw new Blank25ManifestEditorError("Request body must be an object.");
  }

  const record = raw as Record<string, unknown>;
  const mode = toStringValue(record.mode, "mode");
  if (mode !== "create" && mode !== "update" && mode !== "delete") {
    throw new Blank25ManifestEditorError("mode must be create, update or delete.");
  }

  const problemId = toStringValue(record.problemId, "problemId", false);
  const baseManifestSha = toStringValue(
    record.baseManifestSha,
    "baseManifestSha",
    false,
  );

  if (mode === "delete") {
    if (!problemId) {
      throw new Blank25ManifestEditorError("problemId is required in delete mode.");
    }

    return {
      mode,
      problemId,
      categoryId: "",
      linkName: "",
      answers: [],
      baseManifestSha,
    };
  }

  const categoryId = toStringValue(record.categoryId, "categoryId");
  const linkName = toStringValue(record.linkName, "linkName");
  const answers = toAnswers(record.answers);
  const image = parseImagePayload(record.image);

  if (mode === "create" && !image) {
    throw new Blank25ManifestEditorError("image is required in create mode.");
  }

  if (mode === "update" && !problemId) {
    throw new Blank25ManifestEditorError("problemId is required in update mode.");
  }

  return {
    mode,
    problemId,
    categoryId: categoryId ?? "",
    linkName: linkName ?? "",
    answers,
    image,
    baseManifestSha,
  };
};

const normalizeBase64 = (input: string): string =>
  input
    .trim()
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s+/g, "");

const isFastForwardError = (error: GitHubApiError): boolean =>
  error.status === 422 &&
  /fast[- ]forward|not a fast-forward|reference update failed/i.test(
    error.details,
  );

export async function POST(request: Request) {
  try {
    const rawBody = await readJsonBody(request);
    const body = parseBody(rawBody);
    const config = loadBlank25GitHubConfig();

    const { manifestText, manifestSha } = await fetchBlank25ManifestFile(config);
    if (body.baseManifestSha && body.baseManifestSha !== manifestSha) {
      return NextResponse.json<PublishErrorResponse>(
        {
          ok: false,
          error: "Manifest was updated by someone else. Please reload and retry.",
        },
        { status: 409 },
      );
    }

    const manifest = parseBlank25ManifestText(manifestText);

    let nextManifest = manifest;
    let nextProblemId = "";
    let nextImageFile = "";
    let previousImageFile: string | undefined;
    const filesToCommit: Array<{ path: string; base64Content: string }> = [];

    if (body.mode === "create") {
      if (!body.image) {
        throw new Blank25ManifestEditorError("image is required in create mode.");
      }
      const extension = IMAGE_EXTENSION_MAP[body.image.contentType];

      const createResult = createProblemInManifest({
        manifest,
        input: {
          categoryId: body.categoryId,
          linkName: body.linkName,
          answers: body.answers,
          imageFileBuilder: (problemId) => `${problemId}.${extension}`,
        },
      });

      nextManifest = createResult.manifest;
      nextProblemId = createResult.problem.id;
      nextImageFile = createResult.problem.imageFile;

      filesToCommit.push({
        path: `public/img/blank25/${nextImageFile}`,
        base64Content: normalizeBase64(body.image.base64),
      });
    } else if (body.mode === "update") {
      const updateProblemId = body.problemId ?? "";
      const updateImageFile = body.image
        ? `${updateProblemId}.${IMAGE_EXTENSION_MAP[body.image.contentType]}`
        : undefined;

      const updateResult = updateProblemInManifest({
        manifest,
        input: {
          problemId: updateProblemId,
          categoryId: body.categoryId,
          linkName: body.linkName,
          answers: body.answers,
          imageFile: updateImageFile,
        },
      });

      nextManifest = updateResult.manifest;
      nextProblemId = updateResult.problem.id;
      nextImageFile = updateResult.problem.imageFile;
      previousImageFile = updateResult.previousImageFile;

      if (body.image) {
        filesToCommit.push({
          path: `public/img/blank25/${nextImageFile}`,
          base64Content: normalizeBase64(body.image.base64),
        });
      }
    } else {
      const deleteResult = deleteProblemFromManifest({
        manifest,
        input: {
          problemId: body.problemId ?? "",
        },
      });

      nextManifest = deleteResult.manifest;
      nextProblemId = deleteResult.problem.id;
      nextImageFile = deleteResult.problem.imageFile;
    }

    const serializedManifest = serializeBlank25Manifest(nextManifest);
    filesToCommit.push({
      path: "public/data/blank25/problems.json",
      base64Content: encodeUtf8AsBase64(serializedManifest),
    });

    const commitMessage =
      body.mode === "create"
        ? `blank25: add ${nextProblemId}`
        : body.mode === "update"
          ? `blank25: update ${nextProblemId}`
          : `blank25: delete ${nextProblemId}`;

    const { commitSha } = await commitFilesToBlank25Branch({
      config,
      message: commitMessage,
      files: filesToCommit,
    });

    return NextResponse.json<PublishSuccessResponse>({
      ok: true,
      mode: body.mode,
      problemId: nextProblemId,
      imageFile: nextImageFile,
      commitSha,
      previousImageFile,
    });
  } catch (error) {
    if (error instanceof Blank25ManifestEditorError) {
      return NextResponse.json<PublishErrorResponse>(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }

    if (error instanceof GitHubApiError) {
      if (isFastForwardError(error)) {
        return NextResponse.json<PublishErrorResponse>(
          {
            ok: false,
            error: "Conflict detected while publishing. Please reload and retry.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json<PublishErrorResponse>(
        { ok: false, error: `GitHub API error (${error.status}).` },
        { status: 502 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json<PublishErrorResponse>(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json<PublishErrorResponse>(
      { ok: false, error: "Unexpected server error." },
      { status: 500 },
    );
  }
}

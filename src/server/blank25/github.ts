const GITHUB_API_BASE = "https://api.github.com";
const MANIFEST_PATH = "public/data/blank25/problems.json";

export type Blank25GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

type GitHubContentFile = {
  sha: string;
  content: string;
  encoding: string;
};

type GitHubRefResponse = {
  object: {
    sha: string;
  };
};

type GitHubCommitResponse = {
  sha: string;
  tree: {
    sha: string;
  };
};

type GitHubBlobResponse = {
  sha: string;
};

type GitHubTreeResponse = {
  sha: string;
};

type GitHubCreatedCommit = {
  sha: string;
};

type CommitFileInput = {
  path: string;
  base64Content: string;
};

export class GitHubApiError extends Error {
  readonly status: number;
  readonly details: string;

  constructor(message: string, status: number, details: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.details = details;
  }
}

const joinPath = (config: Blank25GitHubConfig, path: string): string =>
  `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
    config.repo,
  )}${path}`;

const githubRequest = async <T>(
  config: Blank25GitHubConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(joinPath(config, path), {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "User-Agent": "nazomatic-blank25-editor",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new GitHubApiError(
      `GitHub API request failed: ${init.method ?? "GET"} ${path}`,
      response.status,
      details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

const decodeBase64Content = (content: string): string =>
  Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");

export const encodeUtf8AsBase64 = (text: string): string =>
  Buffer.from(text, "utf8").toString("base64");

export const loadBlank25GitHubConfig = (): Blank25GitHubConfig => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.BLANK25_EDITOR_GITHUB_OWNER;
  const repo = process.env.BLANK25_EDITOR_GITHUB_REPO;
  const branch = process.env.BLANK25_EDITOR_GITHUB_BRANCH ?? "main";

  if (!token) {
    throw new Error("GITHUB_TOKEN is not set.");
  }
  if (!owner) {
    throw new Error("BLANK25_EDITOR_GITHUB_OWNER is not set.");
  }
  if (!repo) {
    throw new Error("BLANK25_EDITOR_GITHUB_REPO is not set.");
  }

  return { token, owner, repo, branch };
};

export const fetchBlank25ManifestFile = async (
  config: Blank25GitHubConfig,
): Promise<{ manifestText: string; manifestSha: string }> => {
  const result = await githubRequest<GitHubContentFile>(
    config,
    `/contents/${MANIFEST_PATH}?ref=${encodeURIComponent(config.branch)}`,
  );

  if (result.encoding !== "base64") {
    throw new Error(`Unsupported manifest encoding: ${result.encoding}`);
  }

  return {
    manifestText: decodeBase64Content(result.content),
    manifestSha: result.sha,
  };
};

const fetchBranchHeadCommit = async (
  config: Blank25GitHubConfig,
): Promise<string> => {
  const ref = await githubRequest<GitHubRefResponse>(
    config,
    `/git/ref/heads/${encodeURIComponent(config.branch)}`,
  );
  return ref.object.sha;
};

const fetchCommit = async (
  config: Blank25GitHubConfig,
  commitSha: string,
): Promise<GitHubCommitResponse> =>
  githubRequest<GitHubCommitResponse>(config, `/git/commits/${commitSha}`);

const createBlob = async (
  config: Blank25GitHubConfig,
  base64Content: string,
): Promise<string> => {
  const result = await githubRequest<GitHubBlobResponse>(config, "/git/blobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: base64Content,
      encoding: "base64",
    }),
  });

  return result.sha;
};

const createTree = async ({
  config,
  baseTreeSha,
  entries,
}: {
  config: Blank25GitHubConfig;
  baseTreeSha: string;
  entries: Array<{ path: string; sha: string }>;
}): Promise<string> => {
  const result = await githubRequest<GitHubTreeResponse>(config, "/git/trees", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: entries.map((entry) => ({
        path: entry.path,
        mode: "100644",
        type: "blob",
        sha: entry.sha,
      })),
    }),
  });

  return result.sha;
};

const createCommit = async ({
  config,
  message,
  treeSha,
  parentSha,
}: {
  config: Blank25GitHubConfig;
  message: string;
  treeSha: string;
  parentSha: string;
}): Promise<string> => {
  const result = await githubRequest<GitHubCreatedCommit>(config, "/git/commits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });

  return result.sha;
};

const updateBranchRef = async ({
  config,
  commitSha,
}: {
  config: Blank25GitHubConfig;
  commitSha: string;
}): Promise<void> => {
  await githubRequest(
    config,
    `/git/refs/heads/${encodeURIComponent(config.branch)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sha: commitSha,
        force: false,
      }),
    },
  );
};

export const commitFilesToBlank25Branch = async ({
  config,
  message,
  files,
}: {
  config: Blank25GitHubConfig;
  message: string;
  files: CommitFileInput[];
}): Promise<{ commitSha: string }> => {
  if (files.length === 0) {
    throw new Error("No files to commit.");
  }

  const headCommitSha = await fetchBranchHeadCommit(config);
  const headCommit = await fetchCommit(config, headCommitSha);

  const treeEntries = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      sha: await createBlob(config, file.base64Content),
    })),
  );

  const nextTreeSha = await createTree({
    config,
    baseTreeSha: headCommit.tree.sha,
    entries: treeEntries,
  });

  const newCommitSha = await createCommit({
    config,
    message,
    treeSha: nextTreeSha,
    parentSha: headCommitSha,
  });

  await updateBranchRef({ config, commitSha: newCommitSha });

  return { commitSha: newCommitSha };
};

const GITHUB_API_BASE = "https://api.github.com";
const STORAGE_MANIFEST_PATH = "problems.json";
const STORAGE_IMAGE_DIR = "img";

export type Blank25GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
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

export const encodeUtf8AsBase64 = (text: string): string =>
  Buffer.from(text, "utf8").toString("base64");

/**
 * nazomatic-storage リポジトリへの接続設定を読み込む。
 * 既存の BLANK25_EDITOR_GITHUB_* 環境変数をそのまま使用する。
 * BLANK25_EDITOR_GITHUB_REPO は nazomatic-storage を指すように設定すること。
 */
export const loadBlank25StorageConfig = (): Blank25GitHubConfig => {
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

/**
 * storage リポジトリの raw URL ベースを返す。
 * 例: https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main
 */
export const buildStorageRawBase = (config: Blank25GitHubConfig): string =>
  `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/${encodeURIComponent(config.branch)}`;

/**
 * 画像ファイル名から storage リポジトリ内のパスを返す。
 * 例: "blank25-001.webp" → "img/blank25-001.webp"
 */
export const buildStorageImagePath = (imageFile: string): string =>
  `${STORAGE_IMAGE_DIR}/${imageFile}`;

/**
 * raw.githubusercontent.com から problems.json を取得する。
 * タイムスタンプをクエリパラメータとして付与し CDN キャッシュを迂回する。
 */
export const fetchManifestFromRaw = async (
  config: Blank25GitHubConfig,
): Promise<string> => {
  const timestamp = Date.now();
  const url = `${buildStorageRawBase(config)}/${STORAGE_MANIFEST_PATH}?v=${timestamp}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new GitHubApiError(
      `Failed to fetch manifest from raw URL: ${url}`,
      response.status,
      await response.text(),
    );
  }

  return response.text();
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

/**
 * ブランチの ref を force: true で更新する。
 * 競合を無視して常に上書きするため baseManifestSha チェックは不要。
 */
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
        force: true,
      }),
    },
  );
};

/**
 * 複数ファイルを Git Trees API で単一コミットとして push する。
 * force: true で push するため 409 は発生しない。
 */
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

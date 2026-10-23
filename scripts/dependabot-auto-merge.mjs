import { pathToFileURL } from 'node:url';

export function eligiblePull(pull, repository) {
  return pull.state === 'open' && !pull.draft && pull.user?.login === 'dependabot[bot]'
    && pull.user?.id === 49699333 && pull.user?.type === 'Bot'
    && pull.base?.ref === 'main' && pull.base.repo?.full_name === repository
    && pull.head?.repo?.full_name === repository
    && /^dependabot\/(npm_and_yarn|github_actions)\//.test(pull.head?.ref ?? '');
}

export function readyToMerge(pull, runs, checks, statuses) {
  // A successful unrelated workflow or the push run must never replace PR verification.
  const verification = runs.filter(run => run.event === 'pull_request'
    && run.head_sha === pull.head.sha && run.path === '.github/workflows/security-checks.yml')
    .sort((a, b) => b.id - a.id)[0];
  const latestStatuses = new Map();
  for (const status of statuses) {
    const previous = latestStatuses.get(status.context);
    if (!previous || status.id > previous.id) latestStatuses.set(status.context, status);
  }
  return verification?.status === 'completed' && verification.conclusion === 'success'
    && checks.length > 0
    && checks.every(check => check.head_sha === pull.head.sha
      && check.status === 'completed' && check.conclusion === 'success')
    && latestStatuses.get('Vercel')?.state === 'success'
    && [...latestStatuses.values()].every(status => status.state === 'success');
}

export async function autoMerge({ api, repository, dryRun = false, log = console.log }) {
  const prefix = `/repos/${repository}`;
  const pulls = await api.pages(`${prefix}/pulls?state=open&base=main&per_page=100`);
  for (const candidate of pulls) {
    if (!eligiblePull(candidate, repository)) continue;
    const pull = await api.get(`${prefix}/pulls/${candidate.number}`);
    if (!eligiblePull(pull, repository)) continue;
    const sha = pull.head.sha;
    const comparison = await api.get(`${prefix}/compare/${pull.base.sha}...${sha}`);
    if (comparison.behind_by !== 0) {
      log(`#${pull.number}: waiting for a rebase onto current main`);
      continue;
    }
    const [runs, checks, statuses] = await Promise.all([
      api.pages(`${prefix}/actions/workflows/security-checks.yml/runs?head_sha=${sha}&event=pull_request&per_page=100`, 'workflow_runs'),
      api.pages(`${prefix}/commits/${sha}/check-runs?filter=latest&per_page=100`, 'check_runs'),
      api.pages(`${prefix}/commits/${sha}/statuses?per_page=100`),
    ]);
    if (!readyToMerge(pull, runs, checks, statuses)) {
      log(`#${pull.number}: waiting for all checks to succeed`);
      continue;
    }
    // Re-read immediately before merging; GitHub also rejects a changed head via sha.
    const latest = await api.get(`${prefix}/pulls/${pull.number}`);
    if (!eligiblePull(latest, repository) || latest.head.sha !== sha
      || latest.base.sha !== pull.base.sha || latest.mergeable !== true
      || latest.mergeable_state !== 'clean') {
      log(`#${pull.number}: branch changed or merge is blocked`);
      continue;
    }
    if (dryRun) {
      log(`#${pull.number}: eligible (dry run)`);
      continue;
    }
    const result = await api.put(`${prefix}/pulls/${pull.number}/merge`, { sha, merge_method: 'merge' });
    if (!result.merged) throw new Error(`#${pull.number}: GitHub rejected merge`);
    log(`#${pull.number}: merged ${sha}`);
  }
}

function githubApi(token) {
  const origin = 'https://api.github.com';
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
    return response;
  }
  return {
    get: async path => (await request(path)).json(),
    put: async (path, body) => (await request(path, 'PUT', body)).json(),
    pages: async (path, key) => {
      const items = [];
      while (path) {
        const response = await request(path);
        const data = await response.json();
        items.push(...(key ? data[key] : data));
        const next = response.headers.get('link')?.match(/<([^>]+)>; rel="next"/);
        if (next && new URL(next[1]).origin !== origin) throw new Error('Unexpected pagination origin');
        path = next ? next[1].slice(origin.length) : null;
      }
      return items;
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('GitHub configuration missing');
  await autoMerge({ api: githubApi(token), repository, dryRun: process.argv.includes('--dry-run') });
}

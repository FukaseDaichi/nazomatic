import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REVIEW_LABEL, eligiblePull, githubApi, latestVerification } from './dependabot-auto-merge.mjs';

export const MAX_ATTEMPTS = 2;
export const MAX_CHANGED_LINES = 150;
export const ATTEMPT_MARKER = '<!-- dependabot-auto-fix:attempt -->';
const ACTIONS_BOT = 'github-actions[bot]';

export function isMajorUpdate(title) {
  const match = /\bfrom v?(\d+)(?:\.(\d+))?\S* to v?(\d+)(?:\.(\d+))?/i.exec(title ?? '');
  // Grouped or unrecognised updates are treated as major so a human approves the fix.
  if (!match) return true;
  const [, fromMajor, fromMinor = '0', toMajor, toMinor = '0'] = match;
  if (fromMajor !== toMajor) return true;
  return fromMajor === '0' && fromMinor !== toMinor;
}

export function attemptsMade(comments) {
  return comments.filter(comment => comment.user?.login === ACTIONS_BOT
    && comment.body?.includes(ATTEMPT_MARKER)).length;
}

export function touchedByOthers(commits) {
  return commits.some(commit => commit.author?.login !== 'dependabot[bot]');
}

function failed(verification) {
  return verification?.status === 'completed' && verification.conclusion === 'failure';
}

async function openEligiblePulls(api, repository) {
  const prefix = `/repos/${repository}`;
  const pulls = [];
  for (const candidate of await api.pages(`${prefix}/pulls?state=open&base=main&per_page=100`)) {
    if (!eligiblePull(candidate, repository)) continue;
    const pull = await api.get(`${prefix}/pulls/${candidate.number}`);
    if (eligiblePull(pull, repository)) pulls.push(pull);
  }
  return pulls;
}

async function inspect(api, repository, pull) {
  const prefix = `/repos/${repository}`;
  const sha = pull.head.sha;
  const [comparison, runs, comments] = await Promise.all([
    api.get(`${prefix}/compare/${encodeURIComponent(pull.base.ref)}...${sha}`),
    api.pages(`${prefix}/actions/workflows/security-checks.yml/runs?head_sha=${sha}&per_page=100`, 'workflow_runs'),
    api.pages(`${prefix}/issues/${pull.number}/comments?per_page=100`),
  ]);
  return { behind: comparison.behind_by > 0, verification: latestVerification(pull, runs),
    attempts: attemptsMade(comments) };
}

// Picks one failing Dependabot PR for Claude to fix; the rest wait for later runs.
export async function selectTarget({ api, repository, log = console.log }) {
  for (const pull of await openEligiblePulls(api, repository)) {
    const { behind, verification, attempts } = await inspect(api, repository, pull);
    if (behind || !failed(verification)) continue;
    if (attempts >= MAX_ATTEMPTS) {
      log(`#${pull.number}: auto-fix attempts exhausted`);
      continue;
    }
    return { number: pull.number, sha: pull.head.sha, ref: pull.head.ref,
      major: isMajorUpdate(pull.title), runId: verification.id, attempt: attempts + 1 };
  }
  return null;
}

export async function holdForReview(api, repository, number, reason) {
  const prefix = `/repos/${repository}/issues/${number}`;
  await api.post(`${prefix}/labels`, { labels: [REVIEW_LABEL] });
  if (reason) {
    await api.post(`${prefix}/comments`, {
      body: `${reason}人の確認待ちにしました。対応後に \`${REVIEW_LABEL}\` ラベルを外すと自動処理に戻ります。`,
    });
  }
}

// Keeps PRs carrying fix commits mergeable, because Dependabot stops rebasing them.
export async function maintain({ api, repository, log = console.log }) {
  const prefix = `/repos/${repository}`;
  const errors = [];
  for (const pull of await openEligiblePulls(api, repository)) {
    try {
      const { behind, verification, attempts } = await inspect(api, repository, pull);
      if (failed(verification) && attempts >= MAX_ATTEMPTS) {
        await holdForReview(api, repository, pull.number,
          `自動修正を${MAX_ATTEMPTS}回試しても CI が通らないため、`);
        log(`#${pull.number}: handed over to a human`);
        continue;
      }
      const commits = await api.pages(`${prefix}/pulls/${pull.number}/commits?per_page=100`);
      if (!touchedByOthers(commits)) continue;
      if (behind) {
        try {
          await api.put(`${prefix}/pulls/${pull.number}/update-branch`, { expected_head_sha: pull.head.sha });
        } catch (error) {
          // Conflicts with main need a human; other PRs keep being maintained.
          await holdForReview(api, repository, pull.number, `\`${pull.base.ref}\` を自動で取り込めなかったため、`);
          log(`#${pull.number}: update-branch failed (${error.message}); handed over to a human`);
          continue;
        }
        log(`#${pull.number}: merged ${pull.base.ref} into the PR branch`);
      } else if (!verification) {
        await api.post(`${prefix}/actions/workflows/security-checks.yml/dispatches`, { ref: pull.head.ref });
        log(`#${pull.number}: dispatched Security checks`);
      }
    } catch (error) {
      errors.push(`#${pull.number}: ${error.message}`);
    }
  }
  if (errors.length > 0) throw new Error(`Maintenance failed:\n${errors.join('\n')}`);
}

export function checkPatch(nameStatus, numstat) {
  const errors = [];
  const entries = nameStatus.split('\n').filter(Boolean).map(line => line.split('\t'));
  if (entries.length === 0) errors.push('patch is empty');
  for (const [status, path] of entries) {
    if (status !== 'M') errors.push(`${path}: only modifications are allowed (${status})`);
    if (!path.startsWith('src/') || path.startsWith('src/generated/')) errors.push(`${path}: outside src/`);
  }
  let changed = 0;
  for (const [added, deleted, path] of numstat.split('\n').filter(Boolean).map(line => line.split('\t'))) {
    if (added === '-' || deleted === '-') errors.push(`${path}: binary changes are not allowed`);
    changed += Number(added) + Number(deleted);
  }
  if (changed > MAX_CHANGED_LINES) errors.push(`${changed} changed lines exceed ${MAX_CHANGED_LINES}`);
  return errors;
}

export function reportBody({ attempt, pushed, major, jobs, runUrl }) {
  const result = !pushed
    ? `修正できませんでした（${jobs}）。`
    : major
      ? `修正を push しました。メジャー更新のため自動マージせず、人の確認待ちにしています。差分を確認して \`${REVIEW_LABEL}\` ラベルを外すと自動マージの対象に戻ります。`
      : '修正を push しました。CI と Vercel が成功すると自動マージされます。';
  return `${ATTEMPT_MARKER}\n自動修正 試行 ${attempt}/${MAX_ATTEMPTS}: ${result}\n\n実行ログ: ${runUrl}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'check-patch') {
    const git = (...args) => execFileSync('git',
      ['-C', dir, '-c', 'core.quotePath=false', 'diff', '--cached', '--no-renames', ...args], { encoding: 'utf8' });
    const errors = checkPatch(git('--name-status'), git('--numstat'));
    if (errors.length > 0) throw new Error(`Patch rejected:\n${errors.join('\n')}`);
  } else {
    const repository = process.env.GITHUB_REPOSITORY;
    const token = process.env.GH_TOKEN;
    if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('GitHub configuration missing');
    const api = githubApi(token);
    if (mode === 'maintain') {
      await maintain({ api, repository });
    } else if (mode === 'select') {
      if (process.env.HAS_CLAUDE_TOKEN !== 'true') {
        console.log('CLAUDE_CODE_OAUTH_TOKEN is not configured; skipping auto-fix');
      } else {
        const target = await selectTarget({ api, repository });
        console.log(target ? `#${target.number}: selected for auto-fix` : 'No PR needs auto-fix');
        if (target && process.env.GITHUB_OUTPUT) {
          appendFileSync(process.env.GITHUB_OUTPUT, `number=${target.number}\nsha=${target.sha}\nref=${target.ref}\n`
            + `major=${target.major}\nrun_id=${target.runId}\nattempt=${target.attempt}\n`);
        }
      }
    } else if (mode === 'hold') {
      // Labels major updates before their fix is pushed, so a later failure cannot skip the review.
      await holdForReview(api, repository, Number(process.env.NUMBER));
    } else if (mode === 'report') {
      const { NUMBER, ATTEMPT, PUSHED, MAJOR, JOBS, RUN_URL } = process.env;
      await api.post(`/repos/${repository}/issues/${Number(NUMBER)}/comments`, { body: reportBody({
        attempt: ATTEMPT, pushed: PUSHED === 'true', major: MAJOR === 'true', jobs: JOBS, runUrl: RUN_URL }) });
    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }
  }
}

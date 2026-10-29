import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTEMPT_MARKER, MAX_ATTEMPTS, attemptsMade, checkPatch, isMajorUpdate, maintain, reportBody,
  selectTarget, touchedByOthers } from '../dependabot-auto-fix.mjs';

const repository = 'FukaseDaichi/nazomatic';
const bot = { login: 'github-actions[bot]' };

test('major detection treats 0.x minors and unknown titles as major', () => {
  assert.equal(isMajorUpdate('Bump framer-motion from 11.18.2 to 14.6.0'), true);
  assert.equal(isMajorUpdate('Bump @radix-ui/react-label from 2.1.15 to 2.1.17'), false);
  assert.equal(isMajorUpdate('Bump three from 0.170.0 to 0.186.1'), true);
  assert.equal(isMajorUpdate('Bump three from 0.170.0 to 0.170.2'), false);
  assert.equal(isMajorUpdate('Bump actions/checkout from 6 to 7'), true);
  assert.equal(isMajorUpdate('Bump the npm group with 3 updates'), true);
});

test('only marker comments from the Actions bot count as attempts', () => {
  assert.equal(attemptsMade([
    { user: bot, body: `${ATTEMPT_MARKER}\nfirst` },
    { user: { login: 'someone' }, body: ATTEMPT_MARKER },
    { user: bot, body: 'unrelated' },
  ]), 1);
});

test('commits from anyone but Dependabot mark the PR as touched', () => {
  assert.equal(touchedByOthers([{ author: { login: 'dependabot[bot]' } }]), false);
  assert.equal(touchedByOthers([{ author: { login: 'dependabot[bot]' } }, { author: bot }]), true);
  assert.equal(touchedByOthers([{ author: null }]), true);
});

test('patches may only modify a limited number of lines under src/', () => {
  assert.deepEqual(checkPatch('M\tsrc/a.tsx\n', '3\t3\tsrc/a.tsx\n'), []);
  assert.equal(checkPatch('', '').length, 1);
  for (const [nameStatus, numstat] of [
    ['A\tsrc/new.tsx\n', '1\t0\tsrc/new.tsx\n'],
    ['D\tsrc/a.tsx\n', '0\t1\tsrc/a.tsx\n'],
    ['M\tpackage.json\n', '1\t1\tpackage.json\n'],
    ['M\t.github/workflows/x.yml\n', '1\t1\t.github/workflows/x.yml\n'],
    ['M\tsrc/generated/shift-search/a.json\n', '1\t1\tsrc/generated/shift-search/a.json\n'],
    ['M\tsrc/a.png\n', '-\t-\tsrc/a.png\n'],
    ['M\tsrc/a.tsx\n', '100\t51\tsrc/a.tsx\n'],
  ]) assert.notDeepEqual(checkPatch(nameStatus, numstat), [], nameStatus);
});

test('report comments carry the attempt marker and explain the next step', () => {
  const body = reportBody({ attempt: 1, pushed: true, major: true, jobs: '', runUrl: 'url' });
  assert.ok(body.startsWith(ATTEMPT_MARKER));
  assert.match(body, /人の確認待ち/);
  assert.match(reportBody({ attempt: 2, pushed: false, major: false, jobs: 'fix: failure', runUrl: 'url' }),
    /修正できませんでした（fix: failure）/);
});

function fixture() {
  const pull = { number: 105, state: 'open', draft: false, title: 'Bump framer-motion from 11.18.2 to 14.6.0',
    user: { login: 'dependabot[bot]', id: 49699333, type: 'Bot' }, labels: [],
    base: { ref: 'main', sha: 'base', repo: { full_name: repository } },
    head: { sha: 'head', ref: 'dependabot/npm_and_yarn/framer-motion-14.6.0', repo: { full_name: repository } } };
  return {
    pull, behind: 0, comments: [], commits: [{ author: { login: 'dependabot[bot]' } }],
    runs: [{ id: 9, event: 'pull_request', head_sha: 'head', head_branch: pull.head.ref,
      path: '.github/workflows/security-checks.yml', status: 'completed', conclusion: 'failure' }],
  };
}

function fakeApi(f) {
  const calls = [];
  return {
    calls,
    pages: async (path, key) => key === 'workflow_runs' ? f.runs : path.includes('/comments') ? f.comments
      : path.includes('/commits') ? f.commits : [f.pull],
    get: async path => path.includes('/compare/') ? { behind_by: f.behind } : structuredClone(f.pull),
    put: async (path, body) => { calls.push(['PUT', path, body]); return null; },
    post: async (path, body) => { calls.push(['POST', path, body]); return null; },
  };
}

test('selects a failing, up-to-date PR with attempts left', async () => {
  const f = fixture();
  assert.deepEqual(await selectTarget({ api: fakeApi(f), repository, log: () => {} }), {
    number: 105, sha: 'head', ref: f.pull.head.ref, major: true, runId: 9, attempt: 1 });
  for (const change of [
    g => { g.behind = 1; },
    g => { g.runs[0].conclusion = 'success'; },
    g => { g.runs[0].status = 'in_progress'; },
    g => { g.runs = []; },
    g => { g.comments = Array.from({ length: MAX_ATTEMPTS }, () => ({ user: bot, body: ATTEMPT_MARKER })); },
    g => { g.pull.labels = [{ name: 'dependabot-needs-review' }]; },
  ]) {
    const g = fixture();
    change(g);
    assert.equal(await selectTarget({ api: fakeApi(g), repository, log: () => {} }), null);
  }
});

test('maintain hands exhausted PRs to a human and keeps touched PRs mergeable', async () => {
  const exhausted = fixture();
  exhausted.comments = Array.from({ length: MAX_ATTEMPTS }, () => ({ user: bot, body: ATTEMPT_MARKER }));
  let api = fakeApi(exhausted);
  await maintain({ api, repository, log: () => {} });
  assert.deepEqual(api.calls.map(([method, path]) => [method, path]), [
    ['POST', `/repos/${repository}/issues/105/labels`], ['POST', `/repos/${repository}/issues/105/comments`]]);

  const untouched = fixture();
  untouched.behind = 1;
  api = fakeApi(untouched);
  await maintain({ api, repository, log: () => {} });
  assert.deepEqual(api.calls, []);

  const behind = fixture();
  behind.behind = 1;
  behind.commits.push({ author: bot });
  api = fakeApi(behind);
  await maintain({ api, repository, log: () => {} });
  assert.deepEqual(api.calls, [['PUT', `/repos/${repository}/pulls/105/update-branch`, { expected_head_sha: 'head' }]]);

  const conflicted = fixture();
  conflicted.behind = 1;
  conflicted.commits.push({ author: bot });
  const second = { ...structuredClone(conflicted.pull), number: 106 };
  api = fakeApi(conflicted);
  api.pages = async (path, key) => key === 'workflow_runs' ? conflicted.runs
    : path.includes('/comments') ? [] : path.includes('/commits') ? conflicted.commits : [conflicted.pull, second];
  api.get = async path => path.includes('/compare/') ? { behind_by: 1 }
    : structuredClone(path.endsWith('/106') ? second : conflicted.pull);
  api.put = async (path, body) => {
    api.calls.push(['PUT', path, body]);
    if (path.includes('/105/')) throw new Error('HTTP 422');
    return null;
  };
  await maintain({ api, repository, log: () => {} });
  assert.deepEqual(api.calls.map(([method, path]) => [method, path]), [
    ['PUT', `/repos/${repository}/pulls/105/update-branch`],
    ['POST', `/repos/${repository}/issues/105/labels`], ['POST', `/repos/${repository}/issues/105/comments`],
    ['PUT', `/repos/${repository}/pulls/106/update-branch`]]);

  const unverified = fixture();
  unverified.runs = [];
  unverified.commits.push({ author: bot });
  api = fakeApi(unverified);
  await maintain({ api, repository, log: () => {} });
  assert.deepEqual(api.calls, [['POST', `/repos/${repository}/actions/workflows/security-checks.yml/dispatches`,
    { ref: unverified.pull.head.ref }]]);
});

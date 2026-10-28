import test from 'node:test';
import assert from 'node:assert/strict';
import { autoMerge, eligiblePull, readyToMerge } from '../dependabot-auto-merge.mjs';

const repository = 'FukaseDaichi/nazomatic';
function fixture() {
  return {
    pull: { number: 101, state: 'open', draft: false,
      user: { login: 'dependabot[bot]', id: 49699333, type: 'Bot' },
      base: { ref: 'main', sha: 'base', repo: { full_name: repository } },
      head: { sha: 'head', ref: 'dependabot/npm_and_yarn/next-16', repo: { full_name: repository } },
      mergeable: true, mergeable_state: 'clean' },
    runs: [{ id: 1, event: 'pull_request', head_sha: 'head',
      path: '.github/workflows/security-checks.yml', status: 'completed', conclusion: 'success' }],
    checks: [{ head_sha: 'head', status: 'completed', conclusion: 'success' }],
    statuses: [{ id: 2, context: 'Vercel', state: 'success' }, { id: 1, context: 'Vercel', state: 'pending' }],
  };
}

test('only genuine same-repository Dependabot PRs to main are eligible, including majors', () => {
  const { pull } = fixture();
  assert.equal(eligiblePull(pull, repository), true);
  for (const change of [
    { draft: true }, { state: 'closed' }, { user: { login: 'dependabot[bot]', id: 1, type: 'Bot' } },
    { user: { login: 'someone', id: 49699333, type: 'User' } },
    { head: { ...pull.head, repo: { full_name: 'someone/fork' } } },
    { base: { ...pull.base, ref: 'future' } },
    { head: { ...pull.head, ref: 'feature/update' } },
    { labels: [{ name: 'dependabot-needs-review' }] },
  ]) assert.equal(eligiblePull({ ...pull, ...change }, repository), false);
});

test('requires PR verification and every latest check/status success at the current head', () => {
  const f = fixture();
  const ready = () => readyToMerge(f.pull, f.runs, f.checks, f.statuses);
  assert.equal(ready(), true);
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral', null]) {
    f.checks[0].conclusion = conclusion;
    assert.equal(ready(), false);
  }
  f.checks[0].conclusion = 'success';
  f.checks[0].status = 'in_progress';
  assert.equal(ready(), false);
  f.checks[0].status = 'completed';
  f.checks[0].head_sha = 'old';
  assert.equal(ready(), false);
  f.checks[0].head_sha = 'head';
  for (const field of [{ event: 'push' }, { head_sha: 'old' }, { path: '.github/workflows/other.yml' }]) {
    assert.equal(readyToMerge(f.pull, [{ ...f.runs[0], ...field }], f.checks, f.statuses), false);
  }
  const dispatched = { ...f.runs[0], event: 'workflow_dispatch', head_branch: f.pull.head.ref };
  assert.equal(readyToMerge(f.pull, [dispatched], f.checks, f.statuses), true);
  assert.equal(readyToMerge(f.pull, [{ ...dispatched, head_branch: 'main' }], f.checks, f.statuses), false);
  assert.equal(readyToMerge(f.pull, [f.runs[0], { ...dispatched, id: 2, conclusion: 'failure' }],
    f.checks, f.statuses), false);
  assert.equal(readyToMerge(f.pull, [], f.checks, f.statuses), false);
  assert.equal(readyToMerge(f.pull, f.runs, [], f.statuses), false);
  assert.equal(readyToMerge(f.pull, f.runs, f.checks, [{ id: 3, context: 'Vercel Preview Comments', state: 'success' }]), false);
  f.statuses.push({ id: 3, context: 'Vercel', state: 'pending' });
  assert.equal(ready(), false);
  f.statuses[2].state = 'success';
  f.runs.push({ ...f.runs[0], id: 2, status: 'in_progress', conclusion: null });
  assert.equal(ready(), false);
});

async function runScenario({ mutateLatest = () => {}, behind = 0, dryRun = false, checks } = {}) {
  const f = fixture();
  const merges = [];
  let reads = 0;
  const api = {
    pages: async (path, key) => key === 'workflow_runs' ? f.runs
      : key === 'check_runs' ? (checks ?? f.checks) : path.includes('/statuses') ? f.statuses : [f.pull],
    get: async path => {
      if (path.includes('/compare/')) return { behind_by: behind };
      const p = structuredClone(f.pull);
      if (++reads > 1) mutateLatest(p);
      return p;
    },
    put: async (path, body) => { merges.push({ path, body }); return { merged: true }; },
  };
  await autoMerge({ api, repository, dryRun, log: () => {} });
  return merges;
}

test('merge is bound to the verified head and never runs for dry runs or changed/blocked PRs', async () => {
  assert.deepEqual(await runScenario(), [{
    path: `/repos/${repository}/pulls/101/merge`, body: { sha: 'head', merge_method: 'merge' },
  }]);
  assert.deepEqual(await runScenario({ dryRun: true }), []);
  assert.deepEqual(await runScenario({ behind: 1 }), []);
  assert.deepEqual(await runScenario({ checks: [] }), []);
  for (const mutateLatest of [p => { p.head.sha = 'new'; }, p => { p.base.sha = 'new'; },
    p => { p.state = 'closed'; }, p => { p.mergeable = null; },
    p => { p.mergeable_state = 'blocked'; }]) {
    assert.deepEqual(await runScenario({ mutateLatest }), []);
  }
});

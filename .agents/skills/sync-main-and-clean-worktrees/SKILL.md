---
name: sync-main-and-clean-worktrees
description: NAZOMATIC repository-specific post-merge cleanup skill. Use after an automation or feature pull request has been merged into `main` and Codex needs to fetch `origin/main`, safely fast-forward and push the long-lived `future` branch, then remove only clean local worktrees whose commits are already contained in `origin/main`.
---

# Sync Main And Clean Worktrees

Synchronize the local and remote `future` branch with merged `main`, then clean up completed temporary worktrees without discarding work.

## Workflow

1. Confirm that the repository is NAZOMATIC and inspect `git status`, `git worktree list --porcelain`, and the relevant branch refs.
2. Run the bundled script in dry-run mode first:

   ```bash
   .agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh
   ```

3. Report blockers before mutation. The script must stop rather than merge when local `future` or `origin/future` is not an ancestor of `origin/main`.
4. If the user requested the synchronization and cleanup, run:

   ```bash
   .agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --execute
   ```

5. Report the resulting `future` commit, push result, removed worktrees, and skipped worktrees.

## Safety Rules

- Never use `--force`, force-push, `git reset`, or manual conflict resolution in this workflow.
- Require the `future` worktree to be clean before synchronization.
- Update `future` only by fast-forwarding it to `origin/main`.
- Protect the repository's primary worktree and the `future` worktree from removal.
- Remove a secondary worktree only when it is unlocked, clean, and its HEAD is an ancestor of `origin/main`.
- Do not delete local or remote branches. Worktree removal and branch deletion are separate operations.
- Leave dirty, ignored-file-bearing, locked, unmerged, or otherwise uncertain worktrees untouched and report why they were skipped.
- Allow `git worktree prune` to remove only stale administrative metadata for worktree paths that are already missing; it must not delete an existing directory.
- Treat a failed fetch, push, or ancestry check as a blocker. Do not improvise a destructive fallback.

## Script Options

- Default: fetch remote-tracking refs and print the proposed synchronization and cleanup without changing branches or removing worktrees. Fetching still updates local `origin/*` refs.
- `--execute`: perform the fast-forward, push, safe worktree removals, and administrative worktree pruning.
- `--no-fetch`: use current remote-tracking refs. Reserve this for isolated tests or when the user explicitly requests offline inspection.
- `--repo PATH`: operate on a specific repository path.
- `--base NAME` and `--target NAME`: override `main` and `future` only when the user explicitly requests a different branch pair.

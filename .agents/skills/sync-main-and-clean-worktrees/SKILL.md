---
name: sync-main-and-clean-worktrees
description: Synchronize a long-lived target branch with a merged remote base, check out the target when invoked from another branch, remove only safe merged worktrees, and delete merged local and remote branches. Use after an automation or feature pull request has been merged, or when local worktrees and branches need post-merge cleanup.
---

# Sync Main And Clean Worktrees

Synchronize a long-lived target branch with merged `origin/<base>`, then clean up completed local worktrees and local/remote branches without discarding unmerged work.

## Workflow

1. Confirm that the repository is NAZOMATIC and inspect `git status`, `git worktree list --porcelain`, and the relevant local and remote refs. The command may be invoked from any worktree. The requested worktree must be clean if the target branch is not already checked out.
2. Run the bundled script in dry-run mode first:

   ```bash
   .agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh
   ```

   The default mode fetches all `origin` branch refs and prints every checkout, synchronization, worktree-removal, stale-metadata-prune, and local/remote-branch-deletion candidate. Fetching can update local remote-tracking refs; dry-run does not check out branches, push, remove worktrees, prune metadata, or delete branches.
3. Report blockers before mutation. The script must stop when the local target or `origin/<target>` is not an ancestor of `origin/<base>`, when the target worktree cannot be made safely usable, or when fetch/ancestry checks fail. Never merge conflicts or guess at a destructive fallback.
4. If the user requested synchronization and cleanup, run:

   ```bash
   .agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --execute
   ```

   If the target branch is already checked out, use its existing worktree. Otherwise, execute mode checks out the target in the worktree selected by `--repo` (the current worktree by default) after verifying that it is clean and contains no ignored files.
5. Report the final target checkout and commit, push result, removed worktrees, pruned stale metadata, deleted local and remote branches, and skipped worktrees or branches with reasons.

## Safety Rules

- Never use force-push, `git branch -D`, `git worktree remove --force`, `git reset`, or manual conflict resolution. Remote deletion must use the normal `git push origin --delete <branch>` form after the dry-run review.
- Require the target worktree to be clean and free of ignored files before synchronization. When the target is not checked out, require the `--repo` worktree to meet the same condition before switching it.
- Update the target only with `git merge --ff-only origin/<base>`, then push the target branch normally.
- Protect the repository's primary worktree and the target worktree from removal. Protect the base, target, and default long-lived `main` / `future` branch names from local branch deletion. A secondary worktree for the base branch may be removed when it independently satisfies the safe-removal checks.
- Remove a secondary worktree only when it is unlocked, exists, clean, free of ignored files, and its HEAD is an ancestor of `origin/<base>`. Do not remove dirty, ignored-file-bearing, locked, missing-and-uncertain, or unmerged worktrees.
- Permit `git worktree prune` only for stale administrative metadata whose worktree path is already missing. It must not delete an existing directory.
- Delete local branches only when they are not the base, target, default long-lived `main` / `future`, or `--keep-branch` protected branches; no worktree still uses them after planned safe removals; and their tips are ancestors of `origin/<base>`. Use `git branch -d` only. A merged local branch may be deleted even if its remote branch still exists.
- Delete remote branches only when they are not the base, target, default long-lived `main` / `future`, or `--keep-branch` protected branches and their remote tips are ancestors of `origin/<base>`. If a matching local branch exists, require that local branch to be merged and either already released by the planned cleanup or not checked out. This protects dirty, locked, unmerged, and otherwise uncertain local work from remote deletion.
- `git fetch --prune` may remove stale remote-tracking metadata, but it must not be used as a substitute for an intentional remote branch deletion. Never delete a remote branch that was not shown as a dry-run candidate.
- Treat a failed fetch, push, fast-forward, ancestry check, worktree removal, prune, local branch deletion, or remote branch deletion as a blocker. Do not improvise a destructive fallback.
- Keep the default dry-run step in the workflow so branch and worktree deletions are visible before `--execute`.

## Script Options

- `--execute`: check out the target when needed, fast-forward and push it, remove safe worktrees, prune stale worktree metadata, and delete eligible merged local and remote branches.
- `--dry-run`: explicitly select the default preview mode.
- `--no-fetch`: use current remote-tracking refs. Reserve this for isolated tests or when the user explicitly requests offline inspection.
- `--repo PATH`: select the worktree to use when the target branch is not already checked out. It also selects the repository; default is the current directory.
- `--base NAME`: remote base branch to merge from; default `main`.
- `--target NAME`: local and remote target branch to synchronize and leave checked out; default `future`.
- `--keep-branch NAME`: protect an additional merged local and remote branch from deletion. May be repeated.

The `--base` and `--target` options support other branch pairs as long as both local target and `origin/<target>` exist, and the ancestry checks pass. The base branch itself need not be checked out.

Examples:

```bash
# Preview main -> future and merged local/remote-branch cleanup
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh

# Apply the preview
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --execute

# Run from another clean worktree and leave future checked out there
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --repo /path/to/worktree --execute

# Synchronize a different branch pair while preserving a merged local branch
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh \
  --base release --target staging --keep-branch release-notes --execute
```

---
name: sync-main-and-clean-worktrees
description: Synchronize an arbitrary target branch with a merged remote base, remove obsolete merged worktrees including their ignored or dirty files, and delete merged local and remote branches. Use after an automation or feature pull request has been merged, or when local worktrees and branches need post-merge cleanup.
---

# Sync Main And Clean Worktrees

Synchronize `origin/<base>` into `target`, safely fast-forward the existing local `base` branch, then clean up completed local worktrees and local/remote branches. This is intentionally a cleanup tool: an eligible obsolete worktree is removed with `git worktree remove --force`, so ignored files, build outputs, dependencies, and uncommitted files in that worktree are deleted as part of cleanup.

## Workflow

1. Confirm that the repository is NAZOMATIC and inspect `git status`, `git worktree list --porcelain`, and the relevant local and remote refs. The command may be invoked from any branch/worktree. If the target is not already checked out, the selected worktree must not contain tracked or non-ignored untracked changes before it is switched; ignored files do not block the switch.
2. Run the bundled script in dry-run mode first:

   ```bash
   .agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh
   ```

   The default mode fetches all `origin` branch refs and prints every checkout, target/local-base synchronization, worktree-removal, stale-metadata-prune, and local/remote-branch-deletion candidate. Fetching can update local remote-tracking refs; dry-run does not check out branches, update local branches, push, remove worktrees, prune metadata, or delete branches.
3. Report blockers before mutation. The script must stop when the local target or `origin/<target>` is not an ancestor of `origin/<base>`, when the target worktree has tracked/untracked changes that would be carried into the sync, or when fetch/ancestry checks fail. It must not stop merely because an obsolete secondary worktree contains ignored, dirty, or generated files: those files are the deletion target.
4. If the user requested synchronization and cleanup, run:

   ```bash
   .agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --execute
   ```

   If the target branch is already checked out, use its existing worktree. Otherwise, execute mode checks out the target in the worktree selected by `--repo` (the current worktree by default) after verifying that it has no tracked or non-ignored untracked changes. Ignored files may remain in that worktree. If the local base branch exists and is an ancestor of `origin/<base>`, fast-forward it too: use `merge --ff-only` in its clean, unlocked worktree when checked out, or an atomic compare-and-swap ref update when it is not checked out. Skip a missing, divergent, dirty, locked, or stale-worktree local base branch without overwriting it.
5. Report the final target checkout and commit, local base synchronization or skip reason, push result, removed worktrees, pruned stale metadata, deleted local and remote branches, and skipped worktrees or branches with reasons.

## Safety Rules

- Never use force-push, `git branch -D`, `git reset`, or manual conflict resolution. Remote deletion must use the normal `git push origin --delete <branch>` form after the dry-run review.
- Require the target worktree to have no tracked or non-ignored untracked changes before synchronization. Ignored files are allowed and must not block the workflow.
- Update the target only with `git merge --ff-only origin/<base>`, then push the target branch normally.
- Update an existing local base branch only when it is an ancestor of `origin/<base>`. If checked out, require its worktree to be present, unlocked, and clean, then use `git merge --ff-only`. If not checked out, update its ref atomically with its previously inspected commit as the expected old value. Never create a missing local base branch or overwrite a divergent one. If any local-base precondition changes or its fast-forward fails, report the skip and continue cleanup instead of stopping the whole run.
- Protect the repository's primary worktree and the target worktree from removal. Protect the base, target, and default long-lived `main` / `future` branch names from local branch deletion. A secondary worktree for the base branch may be removed when it independently satisfies the safe-removal checks.
- Remove a secondary worktree when it is unlocked, exists, and its HEAD is an ancestor of `origin/<base>`. Use `git worktree remove --force` in execute mode so the entire obsolete worktree directory, including ignored and dirty files, is removed. Keep the primary and target worktrees. Skip locked or unmerged worktrees because their ownership/status is not established by the merged-base check.
- Permit `git worktree prune` only for stale administrative metadata whose worktree path is already missing. It must not delete an existing directory.
- Delete local branches only when they are not the base, target, default long-lived `main` / `future`, or `--keep-branch` protected branches; no worktree still uses them after planned safe removals; and their tips are ancestors of `origin/<base>`. Use `git branch -d` only. A merged local branch may be deleted even if its remote branch still exists.
- Delete remote branches only when they are not the base, target, default long-lived `main` / `future`, or `--keep-branch` protected branches and their remote tips are ancestors of `origin/<base>`. If a matching local branch exists, require that local branch to be merged and either already released by the planned cleanup or not checked out. Unmerged and locked worktrees remain protected; dirty or ignored files in a merged worktree do not prevent cleanup.
- `git fetch --prune` may remove stale remote-tracking metadata, but it must not be used as a substitute for an intentional remote branch deletion. Never delete a remote branch that was not shown as a dry-run candidate.
- Treat a failed fetch, target push or fast-forward, target ancestry check, forced worktree removal, prune, local branch deletion, or remote branch deletion as a blocker. A local-base-only fast-forward or atomic ref update failure is non-blocking: report it, leave that branch unchanged, and continue cleanup. Do not improvise a destructive fallback.
- Keep the default dry-run step in the workflow so branch and worktree deletions are visible before `--execute`.

## Script Options

- `--execute`: check out the target when needed, fast-forward and push it, safely fast-forward the existing local base branch, force-remove eligible merged worktrees including their files, prune stale metadata, and delete eligible merged local and remote branches.
- `--dry-run`: explicitly select the default preview mode.
- `--no-fetch`: use current remote-tracking refs. Reserve this for isolated tests or when the user explicitly requests offline inspection.
- `--repo PATH`: select the worktree to use when the target branch is not already checked out. It also selects the repository; default is the current directory.
- `--base NAME`: remote base branch to merge from; default `main`.
- `--target NAME`: local and remote target branch to synchronize and leave checked out; default `future`. Any valid local/remote branch may be used.
- `--keep-branch NAME`: protect an additional merged local and remote branch from deletion. May be repeated.

The `--base` and `--target` options support other branch pairs as long as both local target and `origin/<target>` exist, and the ancestry checks pass. The base branch itself need not be checked out.

Examples:

```bash
# Preview main -> future and merged worktree/local/remote-branch cleanup
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh

# Apply the preview
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --execute

# Run from another clean worktree and leave future checked out there
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh --repo /path/to/worktree --execute

# Synchronize a different branch pair while preserving a merged local branch
.agents/skills/sync-main-and-clean-worktrees/scripts/sync-and-clean.sh \
  --base release --target staging --keep-branch release-notes --execute
```

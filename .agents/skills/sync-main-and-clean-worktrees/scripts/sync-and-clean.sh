#!/usr/bin/env bash

set -euo pipefail

mode="dry-run"
fetch_remote=1
repo="."
base_branch="main"
target_branch="future"

usage() {
  printf '%s\n' \
    "Usage: sync-and-clean.sh [--execute] [--no-fetch] [--repo PATH] [--base NAME] [--target NAME]" \
    "" \
    "Default mode is a dry run. Remote-tracking refs are fetched unless --no-fetch is set."
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --execute)
      mode="execute"
      shift
      ;;
    --dry-run)
      mode="dry-run"
      shift
      ;;
    --no-fetch)
      fetch_remote=0
      shift
      ;;
    --repo)
      [ "$#" -ge 2 ] || { echo "--repo requires a path" >&2; exit 2; }
      repo="$2"
      shift 2
      ;;
    --base)
      [ "$#" -ge 2 ] || { echo "--base requires a branch name" >&2; exit 2; }
      base_branch="$2"
      shift 2
      ;;
    --target)
      [ "$#" -ge 2 ] || { echo "--target requires a branch name" >&2; exit 2; }
      target_branch="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || {
  echo "Not a Git repository: $repo" >&2
  exit 1
}

git check-ref-format --branch "$base_branch" >/dev/null
git check-ref-format --branch "$target_branch" >/dev/null

if [ "$base_branch" = "$target_branch" ]; then
  echo "Base and target branches must differ." >&2
  exit 1
fi

repo_root=$(git -C "$repo" rev-parse --show-toplevel)
primary_worktree=$(git -C "$repo_root" worktree list --porcelain | awk '
  /^worktree / { print substr($0, 10); exit }
')

if ! git -C "$repo_root" remote get-url origin >/dev/null 2>&1; then
  echo "Remote 'origin' is required." >&2
  exit 1
fi

if [ "$fetch_remote" -eq 1 ]; then
  echo "Fetching origin/$base_branch and origin/$target_branch..."
  git -C "$repo_root" fetch --prune origin \
    "+refs/heads/$base_branch:refs/remotes/origin/$base_branch" \
    "+refs/heads/$target_branch:refs/remotes/origin/$target_branch"
else
  echo "Skipping fetch; using current remote-tracking refs."
fi

for ref in "refs/remotes/origin/$base_branch" "refs/remotes/origin/$target_branch" "refs/heads/$target_branch"; do
  if ! git -C "$repo_root" show-ref --verify --quiet "$ref"; then
    echo "Required ref is missing: $ref" >&2
    exit 1
  fi
done

target_ref="refs/heads/$target_branch"
target_worktree=$(git -C "$repo_root" worktree list --porcelain | awk -v wanted="$target_ref" '
  /^worktree / { path = substr($0, 10) }
  $1 == "branch" && $2 == wanted { print path }
')

if [ -z "$target_worktree" ]; then
  echo "Branch '$target_branch' must be checked out in a worktree." >&2
  exit 1
fi

if [ -n "$(git -C "$target_worktree" status --porcelain --untracked-files=all)" ]; then
  echo "Target worktree is not clean: $target_worktree" >&2
  exit 1
fi

if ! git -C "$repo_root" merge-base --is-ancestor "$target_branch" "origin/$base_branch"; then
  echo "Local $target_branch is not an ancestor of origin/$base_branch; refusing a non-fast-forward update." >&2
  exit 1
fi

if ! git -C "$repo_root" merge-base --is-ancestor "origin/$target_branch" "origin/$base_branch"; then
  echo "origin/$target_branch is not an ancestor of origin/$base_branch; refusing a non-fast-forward push." >&2
  exit 1
fi

current_commit=$(git -C "$repo_root" rev-parse "$target_branch")
base_commit=$(git -C "$repo_root" rev-parse "origin/$base_branch")
commit_count=$(git -C "$repo_root" rev-list --count "$target_branch..origin/$base_branch")

echo "Mode: $mode"
echo "Target worktree: $target_worktree"
echo "Sync: $target_branch $current_commit -> $base_commit ($commit_count commit(s))"

if [ "$mode" = "execute" ]; then
  git -C "$target_worktree" merge --ff-only "origin/$base_branch"
  git -C "$target_worktree" push origin "$target_branch:$target_branch"
else
  echo "Dry run: branch update and push were not performed."
fi

worktree_state=$(mktemp)
trap 'rm -f "$worktree_state"' EXIT
git -C "$repo_root" worktree list --porcelain >"$worktree_state"

candidate_path=""
candidate_head=""
candidate_locked=0

inspect_worktree() {
  [ -n "$candidate_path" ] || return 0

  if [ "$candidate_path" = "$primary_worktree" ] || [ "$candidate_path" = "$target_worktree" ]; then
    echo "KEEP: $candidate_path (protected worktree)"
    return 0
  fi

  if [ "$candidate_locked" -eq 1 ]; then
    echo "SKIP: $candidate_path (locked)"
    return 0
  fi

  if [ ! -d "$candidate_path" ]; then
    echo "SKIP: $candidate_path (path is missing; prune handles stale metadata in execute mode)"
    return 0
  fi

  if [ -n "$(git -C "$candidate_path" status --porcelain --untracked-files=all 2>/dev/null || printf '%s' '__status_error__')" ]; then
    echo "SKIP: $candidate_path (dirty or unreadable)"
    return 0
  fi

  if [ -n "$(git -C "$candidate_path" ls-files --others --ignored --exclude-standard 2>/dev/null || printf '%s' '__ignored_scan_error__')" ]; then
    echo "SKIP: $candidate_path (contains ignored files)"
    return 0
  fi

  if [ -z "$candidate_head" ] || ! git -C "$repo_root" merge-base --is-ancestor "$candidate_head" "origin/$base_branch"; then
    echo "SKIP: $candidate_path (HEAD is not contained in origin/$base_branch)"
    return 0
  fi

  if [ "$mode" = "execute" ]; then
    git -C "$repo_root" worktree remove "$candidate_path"
    echo "REMOVED: $candidate_path"
  else
    echo "REMOVE: $candidate_path (dry-run candidate)"
  fi
}

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    worktree\ *)
      inspect_worktree
      candidate_path=${line#worktree }
      candidate_head=""
      candidate_locked=0
      ;;
    HEAD\ *)
      candidate_head=${line#HEAD }
      ;;
    locked*)
      candidate_locked=1
      ;;
    '')
      inspect_worktree
      candidate_path=""
      candidate_head=""
      candidate_locked=0
      ;;
  esac
done <"$worktree_state"
inspect_worktree

if [ "$mode" = "execute" ]; then
  git -C "$repo_root" worktree prune
  echo "Completed. $target_branch is at $(git -C "$repo_root" rev-parse "$target_branch")."
else
  echo "Dry run complete. Re-run with --execute to apply the safe candidates above."
fi

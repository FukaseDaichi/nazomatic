#!/usr/bin/env bash

set -euo pipefail

mode="dry-run"
fetch_remote=1
repo="."
base_branch="main"
target_branch="future"
keep_branches=()

usage() {
  printf '%s\n' \
    "Usage: sync-and-clean.sh [--execute] [--no-fetch] [--repo PATH] [--base NAME] [--target NAME] [--keep-branch NAME]" \
    "" \
    "Default mode is a dry run. Remote-tracking refs are fetched unless --no-fetch is set." \
    "In execute mode, the target branch and a safe local base branch are fast-forwarded, then obsolete merged worktrees and local/remote branches are removed." \
    "Eligible secondary worktrees are removed with git worktree remove --force, including ignored and dirty files." \
    "--keep-branch may be repeated for merged local or remote branches that must remain."
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
    --keep-branch)
      [ "$#" -ge 2 ] || { echo "--keep-branch requires a branch name" >&2; exit 2; }
      keep_branches+=( "$2" )
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
for branch_name in "${keep_branches[@]}"; do
  git check-ref-format --branch "$branch_name" >/dev/null
done

if [ "$base_branch" = "$target_branch" ]; then
  echo "Base and target branches must differ." >&2
  exit 1
fi

requested_worktree=$(git -C "$repo" rev-parse --show-toplevel)
primary_worktree=$(git -C "$requested_worktree" worktree list --porcelain | awk '
  /^worktree / { print substr($0, 10); exit }
')
repo_root="$primary_worktree"

if ! git -C "$repo_root" remote get-url origin >/dev/null 2>&1; then
  echo "Remote 'origin' is required." >&2
  exit 1
fi

find_worktree_for_branch() {
  local branch_name="$1"
  git -C "$repo_root" worktree list --porcelain | awk -v wanted="refs/heads/$branch_name" '
    /^worktree / { path = substr($0, 10); next }
    $1 == "branch" && $2 == wanted { print path; exit }
  '
}

worktree_is_locked() {
  local worktree_path="$1"
  [ "$(git -C "$repo_root" worktree list --porcelain | awk -v wanted="$worktree_path" '
    /^worktree / { path = substr($0, 10); next }
    /^locked/ && path == wanted { print "yes"; exit }
  ')" = "yes" ]
}

worktree_status_or_error() {
  local worktree_path="$1"
  local status_output
  if ! status_output=$(git -C "$worktree_path" status --porcelain --untracked-files=all 2>/dev/null); then
    printf '%s' '__status_error__'
    return 0
  fi
  printf '%s' "$status_output"
}

worktree_is_clean() {
  [ -z "$(worktree_status_or_error "$1")" ]
}

is_protected_branch() {
  local branch_name="$1"
  local protected_branch

  if [ "$branch_name" = "$base_branch" ] || [ "$branch_name" = "$target_branch" ] || [ "$branch_name" = "main" ] || [ "$branch_name" = "future" ]; then
    return 0
  fi
  for protected_branch in "${keep_branches[@]}"; do
    [ "$branch_name" = "$protected_branch" ] && return 0
  done
  return 1
}

planned_branch_releases=()

add_planned_branch_release() {
  local branch_name="$1"
  local planned_branch

  [ -n "$branch_name" ] || return 0
  for planned_branch in "${planned_branch_releases[@]}"; do
    [ "$planned_branch" = "$branch_name" ] && return 0
  done
  planned_branch_releases+=( "$branch_name" )
}

is_planned_branch_release() {
  local branch_name="$1"
  local planned_branch

  for planned_branch in "${planned_branch_releases[@]}"; do
    [ "$planned_branch" = "$branch_name" ] && return 0
  done
  return 1
}

if [ "$fetch_remote" -eq 1 ]; then
  echo "Fetching all origin branches..."
  git -C "$repo_root" fetch --prune origin \
    "+refs/heads/*:refs/remotes/origin/*"
else
  echo "Skipping fetch; using current remote-tracking refs."
fi

for ref in "refs/remotes/origin/$base_branch" "refs/remotes/origin/$target_branch" "refs/heads/$target_branch"; do
  if ! git -C "$repo_root" show-ref --verify --quiet "$ref"; then
    echo "Required ref is missing: $ref" >&2
    exit 1
  fi
done

target_worktree=$(find_worktree_for_branch "$target_branch")
target_needs_checkout=0
target_checkout_from_branch=""

if [ -z "$target_worktree" ]; then
  target_worktree="$requested_worktree"
  target_needs_checkout=1

  if [ ! -d "$target_worktree" ]; then
    echo "The requested worktree does not exist: $target_worktree" >&2
    exit 1
  fi
  if worktree_is_locked "$target_worktree"; then
    echo "The requested worktree is locked: $target_worktree" >&2
    exit 1
  fi
  if ! worktree_is_clean "$target_worktree"; then
    echo "The requested worktree must be clean before checking out $target_branch: $target_worktree" >&2
    exit 1
  fi

  target_checkout_from_branch=$(git -C "$target_worktree" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
  add_planned_branch_release "$target_checkout_from_branch"
  echo "Target branch '$target_branch' is not checked out; it will use $target_worktree."
else
  if [ ! -d "$target_worktree" ]; then
    echo "Target branch '$target_branch' points to a missing worktree: $target_worktree" >&2
    exit 1
  fi
  if ! worktree_is_clean "$target_worktree"; then
    echo "Target worktree is not clean: $target_worktree" >&2
    exit 1
  fi
fi

target_ref="refs/heads/$target_branch"
base_ref="refs/remotes/origin/$base_branch"
local_base_ref="refs/heads/$base_branch"

if ! git -C "$repo_root" merge-base --is-ancestor "$target_ref" "$base_ref"; then
  echo "Local $target_branch is not an ancestor of origin/$base_branch; refusing a non-fast-forward update." >&2
  exit 1
fi

if ! git -C "$repo_root" merge-base --is-ancestor "refs/remotes/origin/$target_branch" "$base_ref"; then
  echo "origin/$target_branch is not an ancestor of origin/$base_branch; refusing a non-fast-forward push." >&2
  exit 1
fi

current_commit=$(git -C "$repo_root" rev-parse "$target_ref")
base_commit=$(git -C "$repo_root" rev-parse "$base_ref")
commit_count=$(git -C "$repo_root" rev-list --count "$target_ref..$base_ref")

local_base_sync_mode="missing"
local_base_worktree=""
local_base_commit=""
local_base_commit_count=0

if git -C "$repo_root" show-ref --verify --quiet "$local_base_ref"; then
  local_base_commit=$(git -C "$repo_root" rev-parse "$local_base_ref")
  if [ "$local_base_commit" = "$base_commit" ]; then
    local_base_sync_mode="current"
  elif ! git -C "$repo_root" merge-base --is-ancestor "$local_base_ref" "$base_ref"; then
    local_base_sync_mode="diverged"
  else
    local_base_commit_count=$(git -C "$repo_root" rev-list --count "$local_base_ref..$base_ref")
    local_base_worktree=$(find_worktree_for_branch "$base_branch")
    if [ -n "$local_base_worktree" ]; then
      if [ "$target_needs_checkout" -eq 1 ] && [ "$local_base_worktree" = "$target_worktree" ] && [ "$target_checkout_from_branch" = "$base_branch" ]; then
        local_base_sync_mode="update_ref"
      elif [ ! -d "$local_base_worktree" ]; then
        local_base_sync_mode="missing_worktree"
      elif worktree_is_locked "$local_base_worktree"; then
        local_base_sync_mode="locked_worktree"
      elif ! worktree_is_clean "$local_base_worktree"; then
        local_base_sync_mode="dirty_worktree"
      else
        local_base_sync_mode="merge_worktree"
      fi
    else
      local_base_sync_mode="update_ref"
    fi
  fi
fi

echo "Mode: $mode"
echo "Target worktree: $target_worktree"
if [ "$target_needs_checkout" -eq 1 ]; then
  if [ -n "$target_checkout_from_branch" ]; then
    echo "Checkout: $target_checkout_from_branch -> $target_branch in $target_worktree"
  else
    echo "Checkout: detached HEAD -> $target_branch in $target_worktree"
  fi
fi
echo "Sync: $target_branch $current_commit -> $base_commit ($commit_count commit(s))"
case "$local_base_sync_mode" in
  missing)
    echo "SKIP LOCAL BASE: $base_branch (local branch does not exist)"
    ;;
  current)
    echo "Local base: $base_branch is already at $base_commit (0 commit(s))"
    ;;
  diverged)
    echo "SKIP LOCAL BASE: $base_branch (not an ancestor of origin/$base_branch)"
    ;;
  missing_worktree)
    echo "SKIP LOCAL BASE: $base_branch (checked-out worktree path is missing: $local_base_worktree)"
    ;;
  locked_worktree)
    echo "SKIP LOCAL BASE: $base_branch (checked-out worktree is locked: $local_base_worktree)"
    ;;
  dirty_worktree)
    echo "SKIP LOCAL BASE: $base_branch (checked-out worktree is not clean: $local_base_worktree)"
    ;;
  merge_worktree)
    echo "Local base: $base_branch $local_base_commit -> $base_commit ($local_base_commit_count commit(s), clean worktree: $local_base_worktree)"
    ;;
  update_ref)
    echo "Local base: $base_branch $local_base_commit -> $base_commit ($local_base_commit_count commit(s), branch will not be checked out)"
    ;;
esac

if [ "$mode" = "execute" ]; then
  if [ "$target_needs_checkout" -eq 1 ]; then
    git -C "$target_worktree" switch --no-guess "$target_branch"
  fi
  git -C "$target_worktree" merge --ff-only "$base_ref"
  git -C "$target_worktree" push origin "refs/heads/$target_branch:refs/heads/$target_branch"

  case "$local_base_sync_mode" in
    merge_worktree)
      if worktree_is_locked "$local_base_worktree" || ! worktree_is_clean "$local_base_worktree"; then
        echo "SKIP LOCAL BASE: $base_branch (worktree changed after inspection: $local_base_worktree)"
      elif git -C "$local_base_worktree" merge --ff-only "$base_ref"; then
        echo "FAST-FORWARDED LOCAL BASE: $base_branch in $local_base_worktree"
      else
        echo "SKIP LOCAL BASE: $base_branch (fast-forward failed in $local_base_worktree)" >&2
      fi
      ;;
    update_ref)
      local_base_worktree=$(find_worktree_for_branch "$base_branch")
      if [ -n "$local_base_worktree" ]; then
        echo "SKIP LOCAL BASE: $base_branch (became checked out after inspection: $local_base_worktree)"
      elif git -C "$repo_root" update-ref "$local_base_ref" "$base_commit" "$local_base_commit"; then
        echo "FAST-FORWARDED LOCAL BASE: $base_branch (not checked out)"
      else
        echo "SKIP LOCAL BASE: $base_branch (atomic ref update failed)" >&2
      fi
      ;;
  esac
else
  echo "Dry run: checkout, branch updates, push, worktree removal, and local/remote branch deletion were not performed."
fi

worktree_state=$(mktemp)
trap 'rm -f "$worktree_state"' EXIT
git -C "$repo_root" worktree list --porcelain >"$worktree_state"

candidate_path=""
candidate_head=""
candidate_branch=""
candidate_locked=0
stale_worktree_metadata=0

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
    stale_worktree_metadata=1
    if [ -n "$candidate_branch" ]; then
      add_planned_branch_release "$candidate_branch"
    fi
    if [ "$mode" = "execute" ]; then
      echo "PRUNE: $candidate_path (path is missing; stale metadata only)"
    else
      echo "PRUNE: $candidate_path (path is missing; execute mode will prune stale metadata)"
    fi
    return 0
  fi

  if [ -z "$candidate_head" ] || ! git -C "$repo_root" merge-base --is-ancestor "$candidate_head" "$base_ref"; then
    echo "SKIP: $candidate_path (HEAD is not contained in origin/$base_branch)"
    return 0
  fi

  add_planned_branch_release "$candidate_branch"
  if [ "$mode" = "execute" ]; then
    git -C "$repo_root" worktree remove --force "$candidate_path"
    echo "FORCE REMOVED WORKTREE: $candidate_path"
  else
    echo "FORCE REMOVE WORKTREE: $candidate_path (dry-run candidate; ignored/dirty files included)"
  fi
}

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    worktree\ *)
      inspect_worktree
      candidate_path=${line#worktree }
      candidate_head=""
      candidate_branch=""
      candidate_locked=0
      ;;
    HEAD\ *)
      candidate_head=${line#HEAD }
      ;;
    branch\ refs/heads/*)
      candidate_branch=${line#branch refs/heads/}
      ;;
    locked*)
      candidate_locked=1
      ;;
    '')
      inspect_worktree
      candidate_path=""
      candidate_head=""
      candidate_branch=""
      candidate_locked=0
      ;;
  esac
done <"$worktree_state"
inspect_worktree

if [ "$mode" = "execute" ]; then
  git -C "$repo_root" worktree prune
  echo "Pruned stale worktree metadata."
elif [ "$stale_worktree_metadata" -eq 1 ]; then
  echo "Dry run: stale worktree metadata would be pruned in execute mode."
fi

branch_worktree=""
while IFS= read -r branch_name; do
  [ -n "$branch_name" ] || continue

  if is_protected_branch "$branch_name"; then
    echo "KEEP BRANCH: $branch_name (protected)"
    continue
  fi

  branch_worktree=$(find_worktree_for_branch "$branch_name")
  if [ -n "$branch_worktree" ] && ! is_planned_branch_release "$branch_name"; then
    echo "SKIP BRANCH: $branch_name (checked out in $branch_worktree)"
    continue
  fi

  if ! git -C "$repo_root" merge-base --is-ancestor "refs/heads/$branch_name" "$base_ref"; then
    echo "SKIP BRANCH: $branch_name (not contained in origin/$base_branch)"
    continue
  fi

  if [ "$mode" = "execute" ]; then
    git -C "$target_worktree" branch --delete -- "$branch_name"
    echo "DELETED BRANCH: $branch_name"
  else
    echo "DELETE BRANCH: $branch_name (dry-run candidate)"
  fi
done < <(git -C "$repo_root" for-each-ref --format='%(refname:short)' refs/heads)

remote_branch_ref=""
remote_branch=""
remote_branch_commit=""
local_branch_worktree=""
while IFS= read -r remote_branch_ref; do
  remote_branch=${remote_branch_ref#refs/remotes/origin/}
  [ "$remote_branch" != "HEAD" ] || continue

  if is_protected_branch "$remote_branch"; then
    echo "KEEP REMOTE BRANCH: origin/$remote_branch (protected)"
    continue
  fi

  remote_branch_commit=$(git -C "$repo_root" rev-parse "$remote_branch_ref")
  if ! git -C "$repo_root" merge-base --is-ancestor "$remote_branch_commit" "$base_ref"; then
    echo "SKIP REMOTE BRANCH: origin/$remote_branch (not contained in origin/$base_branch)"
    continue
  fi

  if git -C "$repo_root" show-ref --verify --quiet "refs/heads/$remote_branch"; then
    if ! git -C "$repo_root" merge-base --is-ancestor "refs/heads/$remote_branch" "$base_ref"; then
      echo "SKIP REMOTE BRANCH: origin/$remote_branch (local branch is not contained in origin/$base_branch)"
      continue
    fi

    local_branch_worktree=$(find_worktree_for_branch "$remote_branch")
    if [ -n "$local_branch_worktree" ] && ! is_planned_branch_release "$remote_branch"; then
      echo "SKIP REMOTE BRANCH: origin/$remote_branch (local branch remains checked out in $local_branch_worktree)"
      continue
    fi
  fi

  if [ "$mode" = "execute" ]; then
    git -C "$repo_root" push origin --delete "$remote_branch"
    echo "DELETED REMOTE BRANCH: origin/$remote_branch"
  else
    echo "DELETE REMOTE BRANCH: origin/$remote_branch (dry-run candidate)"
  fi
done < <(git -C "$repo_root" for-each-ref --format='%(refname)' refs/remotes/origin)

if [ "$mode" = "execute" ]; then
  git -C "$repo_root" fetch --prune origin \
    "+refs/heads/*:refs/remotes/origin/*"
  echo "Pruned remote-tracking refs."
  echo "Completed. $target_branch is checked out at $(git -C "$target_worktree" rev-parse --short "$target_ref") in $target_worktree."
else
  echo "Dry run complete. Re-run with --execute to apply the checkout, synchronization, and local/remote cleanup candidates above."
fi

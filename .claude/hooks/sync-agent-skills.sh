#!/usr/bin/env bash
# PostToolUse(Write|Edit): スキル正本 .agents/skills/ を編集したら参照スタブを再生成する。
set -u

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */.agents/skills/*) ;;
  *) exit 0 ;;
esac

root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0

if ! output=$(cd "$root" && npm run --silent skills:sync 2>&1); then
  printf 'npm run skills:sync が失敗しました。正本を修正してください。\n%s\n' "$output" >&2
  exit 2
fi

jq -n '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: "スキル正本の編集を受けて npm run skills:sync を実行し、.claude/skills/ のスタブを再生成しました。.agents/skills/ と .claude/skills/ の差分を一緒にコミットしてください。"}}'

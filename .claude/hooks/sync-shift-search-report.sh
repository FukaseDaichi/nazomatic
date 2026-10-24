#!/usr/bin/env bash
# PostToolUse(Write|Edit): Shift Search レポート成果物を編集したら manifest / index と表示用 assets を再生成する。
set -u

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */artifacts/shift-search/reports/*) ;;
  *) exit 0 ;;
esac

root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0

if ! output=$(cd "$root" && npm run --silent shift:report:meta 2>&1 && npm run --silent shift:report:view-assets 2>&1); then
  printf 'Shift Search レポートの再生成が失敗しました。\n%s\n' "$output" >&2
  exit 2
fi

jq -n '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: "Shift Search レポートの編集を受けて npm run shift:report:meta と npm run shift:report:view-assets を実行しました。artifacts/shift-search/reports/* と src/generated/shift-search/* の差分を確認してください。"}}'

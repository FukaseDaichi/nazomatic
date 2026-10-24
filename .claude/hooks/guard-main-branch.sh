#!/usr/bin/env bash
# PreToolUse(Bash): main への直接コミット・プッシュを止める。
# 作業は future に積み、future -> main は PR で取り込む（AGENTS.md 標準ワークフロー）。
set -u

input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
cwd=${cwd:-$PWD}

# ヒアドキュメント本文は判定対象から外す
code=$(awk '
  delim != "" { if ($0 == delim) delim = ""; next }
  {
    print
    if (match($0, /<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*/)) {
      delim = substr($0, RSTART, RLENGTH)
      gsub(/^<<-?[[:space:]]*["'"'"']?/, "", delim)
    }
  }
' <<<"$cmd")
# 空白を含まない引用（"main" やパス）は引用符だけ外して残し、空白を含む引用（コミットメッセージやプロンプト）は消す
code=$(sed -E "s/\"([^\"[:space:]]*)\"/\1/g; s/'([^'[:space:]]*)'/\1/g; s/'[^']*'//g; s/\"([^\"\\\\]|\\\\.)*\"//g" <<<"$code")

block() {
  echo "$1 作業は future に積み、future -> main は PR で取り込んでください。" >&2
  exit 2
}

# コマンドを ; & | で区切り、cd による移動を追いながら git commit / push を判定する
dir=$cwd
while IFS= read -r seg; do
  read -ra words <<<"$seg"
  [ ${#words[@]} -eq 0 ] && continue

  if [ "${words[0]}" = "cd" ] && [ -n "${words[1]:-}" ]; then
    case "${words[1]}" in
      /*) dir=${words[1]} ;;
      *) dir="$dir/${words[1]}" ;;
    esac
    continue
  fi

  [ "${words[0]}" = "git" ] || continue

  target=$dir
  i=1
  while [ $i -lt ${#words[@]} ]; do
    case "${words[$i]}" in
      -C)
        case "${words[$((i + 1))]:-}" in
          /*) target=${words[$((i + 1))]} ;;
          *) target="$target/${words[$((i + 1))]:-}" ;;
        esac
        i=$((i + 2)) ;;
      -c) i=$((i + 2)) ;;
      -*) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  sub=${words[$i]:-}
  [ "$sub" = "commit" ] || [ "$sub" = "push" ] || continue

  # 移動先を解決できないときは hook の cwd で判定する
  branch=$(git -C "$target" branch --show-current 2>/dev/null || git -C "$cwd" branch --show-current 2>/dev/null || true)
  [ "$branch" = "main" ] && block "main ブランチ上での git $sub はブロックしました。"

  if [ "$sub" = "push" ]; then
    for arg in "${words[@]:$((i + 1))}"; do
      # main / +main / src:main / src:refs/heads/main
      if [[ "$arg" =~ ^(\+?|.*:)(refs/heads/)?main$ ]]; then
        block "main への git push はブロックしました。"
      fi
    done
  fi
done < <(sed -E 's/[(`]/ /g; s/&&|\|\||[;&|]/\n/g' <<<"$code")

exit 0

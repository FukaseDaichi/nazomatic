# Project Learnings

<!--
記法ルール:
- 1項目1洞察。複数の学びを1行に詰めない
- 各項目の先頭に日付を必ず入れる（例: - 2026-08-24: ...）
- 上4セクションは「生の観察」の置き場。Consolidated Principles には
  統合パスで抽出した原則だけを置く。両者を混ぜない
-->

## Patterns That Work
（効いたやり方・型）

- 2026-08-24: 共有 Agent Skill は `npm run skills:check` で frontmatter・ディレクトリ名・Claude Code 用参照スタブの一致を一括検証でき、PyYAML がない環境でも検証できる。
- 2026-08-24: `~/.claude/projects/<slug>/*.jsonl` からユーザーの実発話だけを抜くには、`type=="last-prompt"` と `type=="queue-operation"`(operation=="enqueue") を併用して重複排除する。`type=="user"` だけだと task-notification やスキル本文が大量に混ざり、`last-prompt` だけだと取りこぼす。
- 2026-08-24: アシスタント発話に「かな（U+3040–U+30FF）が1文字も含まれない」件数を数えると、日本語プロジェクトでの英語応答率を定量化できる。体感の指摘より説得力があり、ルール追加の根拠にできる。

## Mistakes to Avoid
（失敗と再発防止策）

- 2026-08-24: auto mode では `cat > file <<'EOF'` によるファイル全体の書き換えが classifier にブロックされる。既存ファイルの構造変更は最初から Edit ツールの部分置換で組み立てる方が速い。

## Domain Knowledge
（業務・仕様に関する事実）

- 2026-08-24: スキルは3スコープに分かれる。共有＝`.agents/skills/`（`skills-lock.json` と `skills:check` で管理）、ユーザー＝`~/.claude/skills/`（lock ファイルなし、アンインストールはディレクトリ削除のみ）、プラグイン＝`~/.claude/plugins/cache/`。どこにあるかで撤去手順が変わるので先に特定する。

## Open Questions
（未解決・要調査）

- 2026-08-24: AGENTS.md に追加した Response Language 節だけで日本語応答が維持されるか未検証。守られないようなら Stop フックでの機械的な担保に切り替える（`.claude/settings.json` に Shift Search 同期チェックの PostToolUse フック実績あり）。

## Consolidated Principles
（統合パス専用。ここに直接追記しない）

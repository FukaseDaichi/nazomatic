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
- 2026-08-27: cleanup dry-run は fetch 後に `origin/future` が進んでも、`future` と `origin/main` の ancestry blocker が残る場合は execute を行わず、remote-tracking ref の更新だけで終了する。
- 2026-08-28: npm脆弱性の棚卸しは `npm audit --omit=dev --json` で severity と `fixAvailable` を機械的に一覧化し、`npm ls <pkg>` で実際の依存ツリー（直接依存かどうか、どのメジャー版に紐づくか）を辿ってから対応方針（そのまま更新／メジャー移行が必要／孫依存で単独修正不可）を切り分けると早い。

## Mistakes to Avoid
（失敗と再発防止策）

- 2026-08-24: auto mode では `cat > file <<'EOF'` によるファイル全体の書き換えが classifier にブロックされる。既存ファイルの構造変更は最初から Edit ツールの部分置換で組み立てる方が速い。

## Domain Knowledge
（業務・仕様に関する事実）

- 2026-08-24: スキルは3スコープに分かれる。共有＝`.agents/skills/`（`skills-lock.json` と `skills:check` で管理）、ユーザー＝`~/.claude/skills/`（lock ファイルなし、アンインストールはディレクトリ削除のみ）、プラグイン＝`~/.claude/plugins/cache/`。どこにあるかで撤去手順が変わるので先に特定する。
- 2026-08-28: `firebase-admin` 13.6.0→14.3.0 のメジャー更新で fast-xml-parser/websocket-driver/protobufjs の critical 3件を含む脆弱性を一括解消できた（src/server/firebase/admin.ts のAPI利用はcert/getApp/getApps/initializeApp/getFirestoreのみで破壊的変更の影響なし）。ただし配下の `@google-cloud/storage@7.22.0` は独自にgaxios@6.7.1/uuid@9.0.1系を抱えており、firebase-admin側が追従するまで moderate 脆弱性が残る（overridesでの強制上書きはstorage動作互換のリスクがあるため見送り）。
- 2026-08-28: picomatch の high脆弱性（ReDoS）は `tailwindcss@3.4.19`（→chokidar→micromatch）と `eslint-config-next@14.2.35`（→tinyglobby）の孫依存で、両者とも現行メジャー内では最新版のため単独では直せない。Next.js 14→15/16のメジャー移行と合わせてでないと解消しない。

## Open Questions
（未解決・要調査）

- 2026-08-24: AGENTS.md に追加した Response Language 節だけで日本語応答が維持されるか未検証。守られないようなら Stop フックでの機械的な担保に切り替える（`.claude/settings.json` に Shift Search 同期チェックの PostToolUse フック実績あり）。

## Consolidated Principles
（統合パス専用。ここに直接追記しない）

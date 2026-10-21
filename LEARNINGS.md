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

- 2026-08-24: `~/.claude/projects/<slug>/*.jsonl` からユーザーの実発話だけを抜くには、`type=="last-prompt"` と `type=="queue-operation"`(operation=="enqueue") を併用して重複排除する。`type=="user"` だけだと task-notification やスキル本文が大量に混ざり、`last-prompt` だけだと取りこぼす。
- 2026-08-28: npm脆弱性の棚卸しは `npm audit --omit=dev --json` で severity と `fixAvailable` を機械的に一覧化し、`npm ls <pkg>` で実際の依存ツリーを辿ってから対応方針（そのまま更新／メジャー移行が必要／孫依存で単独修正不可）を切り分けると早い。

## Mistakes to Avoid

（失敗と再発防止策）

- 2026-10-21: Next.jsのメジャー更新はbuild成功だけで互換と判断しない。App Routerの同梱ReactとReact用カスタムrendererの内部API依存が異なる場合があるため、依存peer整合とCanvas等の実ブラウザ描画も確認する。

- 2026-09-19: 生の観察から恒久文書へ制約を転記するときは、「不可」を「前提にしない」へ弱めたり、唯一の代替策などの付随条件を落としたりしない。元項目の各節を転記先と機械的に照合すると、要件の意味を保ったまま卒業できる。
- 2026-08-28: macOS（BSD date）は `date +%s%3N` の `%3N` を解釈せず `1787…N` のような不正値を返す。epoch ミリ秒が要るときは `node -e 'console.log(Date.now())'` を使う（automation.toml の created_at 等に不正値が入ると読み込みが壊れる）。
- 2026-10-20: cleanup 前に `future` を push しても、`origin/main` がその commit を含まない間は ancestry guard が働くため、手動 merge で回避せず cleanup を停止して報告する。

## Domain Knowledge

（業務・仕様に関する事実）

- 2026-10-20: Vercel の Node.js 版はリポジトリに指定がないと Project Settings に従う。`package.json` の `engines.node`（例: `24.x`）を書けばダッシュボードを変えずに上書きできるので、Node 廃止エラーはコード側で直して PR に含める。
- 2026-10-19: X投稿の `fetch failed` は接続先をログだけで判別できない。観測ログ・週末サマリでは prepare API、成長計測では起動時のローカルCDP接続も発生源になるため、CLIの実行順と照合する。修正前の Chrome 起動は stderr と子プロセスの error を破棄していたため、過去の CDP timeout だけではプロファイル競合と起動失敗を確定できない。

- 2026-08-28: Codex画像生成をスクリプトから使う契約は `codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C <dir> -- "Use the imagegen skill..."`。現行 Codex CLI は `--full-auto` を受け付けない。`SAVED: <絶対パス>` 行は instruction 側で明示要求し、パース後に workDir 配下 realpath・生成時刻・PNG/JPEGマジックバイトを検証してから使う。

## Open Questions

（未解決・要調査）

- なし。

## Consolidated Principles

（統合パス専用。ここに直接追記しない）

- 自動化の `memory.md` を更新するときは、ログや台帳を正本として `Current State` / `Active Issues` / `Recent Runs` / `References` に再要約し、保存プロンプトで保持件数と容量上限を定めよ。
- 新しい X ブラウザ投稿 CLI に永続 state を持たせるときは、account ownership を内容検証より先に確認し、pending の遷移を曜日・schedule 判定より先に処理し、破損時は fail-closed、保存は atomic write とせよ。
- 外部由来のテキストを公開物へ流すときは、入力種別に応じた境界を設けよ。無監修辞書は全候補で一意性を判定してから answer / display に denylist を適用し、X の第三者投稿は会話境界で候補を切り、公開側には正規化 URL と handle だけを出す。
- 状態や差分の異常を調べるときは、時系列の履歴から発生日を絞り、該当期間の `git log` / `git show` で原因や取り込み先を確認せよ。

<!--
転記済み（2026-09-19 の統合パス）:
- 指示ファイル編集前の再読・docs照合 → AGENTS.md「作業スタイル」
- 結論の機械的検証 → AGENTS.md「作業スタイル」
- 外部スキルの参照・API適合確認 → AGENTS.md「共有 Agent Skill」
- design-sync README の生成境界と auxSha → .design-sync/NOTES.md
- X運用のオーナー制約 → docs/system-design/subsystems/x-posting.md「運用上の前提」
-->

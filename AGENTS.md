# NAZOMATIC エージェント指示書

このファイルは短く運用的に保つ。プロジェクトの詳細な仕様は `docs/` 配下の日本語ドキュメントに置き、ここには置かない。

## LEARNINGS.md ループ

各セッションの開始時に、リポジトリ直下の LEARNINGS.md を読め。
読んだ内容を1〜3行で要約して提示し、読み込みが行われたことを可視化せよ。
実質的なリポジトリ作業を完了して最終回答を返す前に、`update-learnings` スキルを1回だけ実行せよ。雑談、単純な質問、変更や再利用可能な学びがない作業では実行不要とする。

## 応答言語

- ユーザーへの返信（計画・進捗・要約・完了報告）は常に日本語で行う。
- Codex やサブエージェントの出力は英語で返るが、そのまま転記せず日本語で言い直す。コード・パス・識別子・コマンド名はそのまま残す。

## 判断のデフォルト

- 確認より実行を優先し、推奨案とともに実施する。結果を左右する判断だけをユーザーに提示し、それぞれに推奨を添える。
- 作業は自分で完了させる。ツールで実行できるCLIコマンドや手作業をユーザーに投げ返さない（`.mcp.json`・`.claude/`・`.agents/skills/`・各種設定ファイルの編集を含む）。
- スキルとMCPサーバーは、ユーザーの指示がない限りプロジェクトスコープ（`.mcp.json`、`.agents/skills/`）にインストールする。
- パフォーマンス・SEO監査は、ローカルURLの指定がない限り本番 `https://nazomatic.vercel.app` を対象にする。

## 参照必須ドキュメント

- AI実装ルール（特にUI・フォーム作業）の正本: `docs/ai-coding-rules.md`
- アーキテクチャ・ルーティング・API・データ境界・SEO・認証境界: `docs/system-design/README.md`
- セットアップ・コマンド・環境変数・検証・生成物: `docs/development-guide.md`
- サブシステム文書の索引: `docs/README.md`

## プロジェクト概要

- NAZOMATIC は謎解き・イベント運営支援ツール向けの Next.js App Router アプリ。
- スタック: Next.js 14 / React 18 / TypeScript / Tailwind CSS / shadcn/ui / Radix UI。
- 主要ソース: `src/`。
- 仕様書: `docs/`。
- Shift Search の生成ビューアセット: `src/generated/shift-search/`。
- Shift Search レポート成果物: `artifacts/shift-search/reports/`。

## コマンド

```bash
npm run dev
npm run build
npm run lint
npm run skills:sync
npm run skills:check
npm run test:x-browser-posting
npm run shift:report:meta
npm run shift:report:view-assets
```

- 自動テストは `scripts/x-browser-posting/*.test.mjs`（Node標準 `node:test`）のみ。`src/` 配下にテストはない。
- 特に指定がない限り `npm run lint` と `npm run test:x-browser-posting`、加えて対象を絞った手動確認を行う。
- Shift Search のレポート成果物を変更したら `shift:report:*` 両方を実行し、`src/generated/shift-search/*` と同期させる。

## 標準ワークフロー

- ブランチ運用: 作業は `future` に積み、`future` → `main` へPRを出す。`main` へ直接コミットしない。
- レビュー: まとまった変更の後は Codex レビュー（Claude Codeでは `codex:rescue`）を diff に対して実行し、指摘を修正して日本語で報告する。
- 並行作業: タスクが独立して分割できる場合はサブエージェントに振り分ける。
- マージ後の後片付け（ブランチ・worktree）: `sync-main-and-clean-worktrees` スキルを使う。

## 共有 Agent Skill

- `CLAUDE.md` はこのファイルを読み込むため、以下は Codex と Claude Code の両方に適用される。スキルの作成・導入・更新・改名・削除の前に必ず読むこと。
- 正本は `.agents/skills/<name>/` のみ。ディレクトリ名と frontmatter の `name` を一致させる。Codexはこのパスを直接参照する。
- Claude Code へは `.claude/skills/<name>/SKILL.md` の参照スタブでのみ公開する。frontmatterは正本と一致させ、本文は正本を読ませる指示のみとする。手順を複製しない。
- symlink・junction・ディレクトリ丸ごとコピー・`.claude/commands/`・Claude専用プロンプトでの公開は禁止する。
- 正本 `SKILL.md` 内のスクリプト・参照ファイルへのパスは必ずリポジトリルート相対で書く（例: `.agents/skills/<name>/scripts/foo.sh`）。スタブ経由ではスキルディレクトリ相対パスが解決できない。
- `.claude/skills/` 配下は絶対に手編集しない。正本を直して再生成する。
- スキル変更後は必ず `npm run skills:sync` → `npm run skills:check` を実行し、正本とスタブの差分を一緒にコミットする（`npm run lint` も `skills:check` を先に実行する）。
- 呼び出しは Codexで `$<name>`、Claude Codeで `/<name>`。手順・理由・検証コマンド・復旧手順の詳細は `docs/development-guide.md` を参照。

| スキル                               | 用途                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `seo`                                | メタタグ・構造化データ・サイトマップなど検索可視性        |
| `sync-docs-from-code`                | `docs/**` とルート `README.md` を実装に合わせて整合       |
| `sync-main-and-clean-worktrees`      | マージ後の後片付け（ブランチ同期・worktree/ブランチ削除） |
| `nazomatic-mobile-first-ux-overhaul` | ページ・コンポーネントの再設計、モバイルファーストUX改修  |
| `update-learnings`                   | セッション終了時、LEARNINGS.md への追記                   |
| `consolidate-learnings`              | 週1回、または生の観察が80〜100件に達したときの棚卸し      |

## ドキュメントのライフサイクル

- 挙動を変更したら同じ変更の中で `docs/` 配下の該当文書を更新し、文書マップが変わるなら `docs/README.md` も更新する。
- 実装計画・仕様書は一時的なもの。`docs/ideas/` に置き、実装完了と同じPRで削除し、恒久的な内容は `docs/system-design/` へ折り込む。
- `docs/system-design/quality/known-concerns.md` の項目を解消したら、同じ変更でその項目を削除する。解消済み項目の放置は不備とみなす。

## 作業スタイル

- 新しい抽象を作るより、既存のコンポーネント・ユーティリティ・ルート・スタイルパターンを優先する。
- 差分は依頼範囲に収める。
- 明確な必要性なく新しい依存関係・保存先・カラーシステムを増やさない。

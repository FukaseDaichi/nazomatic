---
name: sync-docs-from-code
description: NAZOMATIC repository-specific documentation synchronization skill. Use when Codex needs to review, audit, or update `docs/**` and the root `README.md` against the current codebase, when documentation feels stale, or when a user asks to sync docs from implementation. Treat `src/` and config as the source of truth, edit only docs/README/report files, leave `src/` and `AGENTS.md` unchanged, and overwrite the Japanese audit report with fixes, judgment calls, and noticed system issues.
---

# Sync Docs From Code (NAZOMATIC)

## Overview

Use the implementation as the single source of truth. In one pass, reconcile NAZOMATIC documentation with the code, fix stale `docs/**` and root `README.md` content, and write one Japanese audit report for judgment calls and system issues noticed during the sync.

This skill is project-local and specific to the NAZOMATIC repository.

## Scope

- Edit only `docs/**`, root `README.md`, and the report file `docs/maintenance/doc-audit-report.md`.
- Read `src/`, config files, scripts, generated assets, and artifacts as sources of truth. Never write to `src/`.
- Never edit `AGENTS.md`; report proposed changes under "AGENTS.md 推奨修正".
- Do not run `npm run` commands automatically. If a command should be run, record it as a recommendation in the report.
- Do not perform an independent code audit. Record only system problems noticed while reconciling docs.
- Do not preserve temporary skill-design docs as durable project documentation once the project-local skill exists.

## Sources Of Truth

Read the relevant implementation for each doc, and always check these canonical inputs when the docs cover them:

- `src/lib/json/features.json`: ordered source of truth for top-page cards, header icon nav, sitemap URLs, and JSON-LD article indexing.
- `src/middleware.ts`: BLANK25 editor authentication boundary.
- `package.json`: documented scripts and command names.
- `src/app`: App Router routes and `/api/*` route handlers.
- Environment variables referenced by the implementation.
- `src/generated/shift-search/` and `artifacts/shift-search/reports/`: Shift Search generated-asset relationships.

## Known Canonical Rules

If docs disagree with these rules, fix the docs. If code appears to violate them, leave code unchanged and report the issue under "システム問題点".

- Text-like inputs must be at least 16px on mobile; do not rely on the `text-sm` default in `src/components/ui/input.tsx` or `src/components/ui/textarea.tsx`.
- `src/lib/json/features.json` is the ordered source of truth for top cards, header nav, sitemap, and JSON-LD.
- BLANK25 editor routes use HTTP Basic auth in `src/middleware.ts`; Realtime/X internal APIs use `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>`.
- The visual system is dark theme first: `bg-gradient-to-b from-gray-900 to-gray-800 text-white` with `purple-400` as the accent.
- After Shift Search report artifact changes, `shift:report:meta` and `shift:report:view-assets` must be run and `src/generated/shift-search/*` kept in sync.

## Workflow

1. Read the sources of truth above for the areas covered by the docs.
2. Walk `docs/**` and root `README.md`, excluding `docs/maintenance/doc-audit-report.md` from the comparison pass because it is the output artifact.
3. Fix documentation to match code:
   - Correct stale specs, APIs, routes, commands, environment variables, data boundaries, generated assets, SEO, and authentication notes.
   - Sync `docs/README.md`: add new docs, remove deleted docs, fix broken links, and correct mismatched descriptions.
   - Keep docs in Japanese. Keep root `AGENTS.md` in English and unchanged.
   - Use Diataxis as a sorting lens: keep Reference facts and Explanation rationale from blurring together; do not invent Tutorials.
4. Accumulate report items while working.
5. Overwrite `docs/maintenance/doc-audit-report.md` with the current run. Create `docs/maintenance/` if it does not exist.
6. Summarize changed docs and point the user to the report for judgment calls, system issues, and AGENTS.md recommendations.

## Report Format

Write `docs/maintenance/doc-audit-report.md` in Japanese and replace the whole file every run.

```markdown
# ドキュメント同期レポート（YYYY-MM-DD）

## 1. 自動修正したもの
コードに合わせて直した docs/README の箇所一覧。`ファイル:該当` と「修正前→修正後」の要点。

## 2. 判断に迷った点
コードと docs のどちらを正とすべきか曖昧で、人間の判断が要る項目。
各項目に「迷った理由」と「暫定でどう扱ったか」を書く。

## 3. システム問題点
同期作業中に気づいた矛盾・死んだ記述・設計上の違和感・非交渉ルール違反の疑い。

## 4. AGENTS.md 推奨修正
自動修正せず指摘のみ。原則（200行以内 / コマンド先頭 / 非自明な慣習を優先）に照らした過不足。
```

## Done When

- `docs/**` and root `README.md` match the code, or ambiguity is recorded in the report.
- `docs/maintenance/doc-audit-report.md` is overwritten with this run's content.
- `src/` and `AGENTS.md` are unchanged.

# NAZOMATIC Agent Instructions

Keep this file short and operational. Put durable project details in Japanese docs under `docs/`, not here.

## LEARNINGS.md ループ

各セッションの開始時に、リポジトリ直下の LEARNINGS.md を読め。
読んだ内容を1〜3行で要約して提示し、読み込みが行われたことを可視化せよ。
実質的なリポジトリ作業を完了して最終回答を返す前に、 `update-learnings` スキルを1回だけ実行せよ。 雑談、単純な質問、変更や再利用可能な学びがない作業では実行不要とする。

## Response Language

- Always reply to the user in Japanese: plans, progress narration, summaries, and completion reports.
- Codex and subagents return English. Never relay that output verbatim — restate it in Japanese. Keep code, file paths, identifiers, and command names as they are.

## Decision Defaults

- Default to acting with a recommendation, not to asking. Surface only the decisions that actually change the outcome, and state your recommendation for each.
- Do not write a spec or a design document unless the user asks for one. "Refactor X" and "Fix X" mean implement it.
- Do the work yourself. Never hand back a CLI command or a manual step the available tools can perform — editing `.mcp.json`, `.claude/`, `.agents/skills/`, or any settings file included.
- Install skills and MCP servers at project scope (`.mcp.json`, `.agents/skills/`) unless the user says otherwise.
- Performance and SEO audits target production `https://nazomatic.vercel.app` unless a local URL is given.

## Required References

- Follow `docs/ai-coding-rules.md` as the source of truth for AI implementation rules, especially UI and form work.
- Use `docs/system-design/README.md` for architecture, routes, APIs, data boundaries, SEO, and authentication boundaries.
- Use `docs/development-guide.md` for setup, commands, environment variables, verification, and generated assets.
- Use `docs/README.md` to find subsystem documents.
- Keep `AGENTS.md` in English. Keep files under `docs/` in Japanese.

## Project Snapshot

- NAZOMATIC is a Next.js App Router app for Japanese puzzle-solving and event-support tools.
- Stack: Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui, Radix UI.
- Main source: `src/`.
- Human-facing specifications: `docs/`.
- Generated Shift Search view assets: `src/generated/shift-search/`.
- Shift Search report artifacts: `artifacts/shift-search/reports/`.

## Commands

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

- Automated tests exist only for the X posting / growth scripts under `scripts/x-browser-posting/*.test.mjs`, run via Node's built-in `node:test`. Nothing under `src/` has test coverage.
- Use `npm run lint` plus `npm run test:x-browser-posting`, and focused manual verification, unless a task provides another check.
- After changing Shift Search report artifacts, run both `shift:report:*` commands and keep `src/generated/shift-search/*` in sync.

## Standard Workflows

- Branching: work lands on `future`, then a pull request from `future` to `main`. Never commit directly to `main`.
- Review: after a substantial change, run a Codex review over the diff (`codex:rescue` in Claude Code), fix what it finds, and report the findings in Japanese.
- Parallel work: when a task list has independent items, split them across subagents.
- Post-merge cleanup of branches and worktrees: use the `sync-main-and-clean-worktrees` skill.

## Shared Agent Skills

- `CLAUDE.md` imports this file, so these rules apply to Codex and Claude Code. Read this section before creating, installing, updating, renaming, or deleting any skill.
- Keep each shared skill's only editable source in `.agents/skills/<name>/`; the directory and frontmatter `name` must match. Codex discovers this path directly.
- Expose a skill to Claude Code only through a generated reference stub at `.claude/skills/<name>/SKILL.md`: a real regular file whose frontmatter `name` and `description` match the canonical skill, and whose body only tells the agent to read `.agents/skills/<name>/SKILL.md`. Never duplicate the procedure into the stub.
- Never publish a skill by symlink, junction, a full copy of the skill directory, `.claude/commands/`, or a Claude-only custom prompt. `core.symlinks=false` expands a symlink into a path-only regular file with no readable `SKILL.md`, and a full copy only creates drift.
- Inside a canonical `SKILL.md`, write every reference to a script or supporting file repository-root relative (`.agents/skills/<name>/scripts/foo.sh`). A stub-invoked skill resolves its base directory to `.claude/skills/<name>/`, so skill-directory-relative paths cannot resolve.
- Never hand-edit anything under `.claude/skills/`. Fix the canonical skill and regenerate.
- After any skill change, run `npm run skills:sync` and `npm run skills:check`, then commit the canonical change and the regenerated stub together. `npm run lint` runs `skills:check` first.
- Invoke a shared skill as `$<name>` in Codex and `/<name>` in Claude Code. See `docs/development-guide.md` for the full procedure, verification commands, and recovery steps.

| Skill                                | Use for                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `seo`                                | Meta tags, structured data, sitemap, and other search-visibility work.        |
| `sync-docs-from-code`                | Reconcile `docs/**` and the root `README.md` with the current implementation. |
| `sync-main-and-clean-worktrees`      | Post-merge cleanup: sync a branch, remove merged worktrees and branches.      |
| `nazomatic-mobile-first-ux-overhaul` | Page and component redesign, mobile-first UX rework.                          |
| `update-learnings`                   | End of a session: append new insights to `LEARNINGS.md`.                      |
| `consolidate-learnings`              | Weekly, or at 80–100 raw observations: compact `LEARNINGS.md`.                |

## Document Lifecycle

- When changing behavior, update the relevant Japanese doc under `docs/` in the same change, and refresh `docs/README.md` if the document map changes.
- Implementation plans and specs are temporary. Put them in `docs/ideas/`, then delete them in the same pull request that completes the implementation, folding anything durable into `docs/system-design/`.
- When you resolve an item listed in `docs/system-design/quality/known-concerns.md`, delete that entry in the same change. Leaving a fixed item in the list is a defect.

## Non-Negotiable Rules

- Preserve the existing NAZOMATIC visual system unless the user explicitly asks otherwise:
  - base: `bg-gradient-to-b from-gray-900 to-gray-800 text-white`
  - accent: `purple-400`
  - dark theme first
- Text-like inputs must be at least `16px` on mobile. Do not rely on the default `text-sm` in `src/components/ui/input.tsx` or `src/components/ui/textarea.tsx`.
- Treat `src/lib/json/features.json` as ordered source-of-truth for the top page cards, header icon nav, sitemap URLs, and JSON-LD article indexing.
- Keep external data fetching behind `/api/*`; do not call external services directly from client components.
- Preserve internal API authentication behavior:
  - BLANK25 editor routes use HTTP Basic auth in `src/middleware.ts`.
  - Realtime/X internal APIs use `Authorization: Bearer <REALTIME_INTERNAL_API_TOKEN>` plus HMAC request signing. Always call `enforceInternalAuthorization()` from `src/server/internal-api/authorization.ts`; never re-implement it per route.

## Working Style

- Prefer existing components, utilities, routes, and styling patterns over new abstractions.
- Keep diffs scoped to the request.
- Do not introduce new dependencies, storage locations, or color systems without a clear need.

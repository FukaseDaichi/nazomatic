# NAZOMATIC Agent Instructions

Keep this file short and operational. Put durable project details in Japanese docs under `docs/`, not here.

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

## Shared Agent Skills

- `CLAUDE.md` imports this file, so these rules apply to Codex and Claude Code.
- Keep each shared skill's only editable source in `.agents/skills/<name>/`; the directory and frontmatter `name` must match.
- Treat `.claude/skills/` as a committed generated mirror. Never edit it directly or replace entries with symlinks, junctions, or path-only files.
- After creating, installing, updating, renaming, or deleting a skill, run `npm run skills:sync` and `npm run skills:check`, then commit both the source and mirror changes.
- Invoke a shared skill as `$<name>` in Codex and `/<name>` in Claude Code. See `docs/development-guide.md` for setup and recovery details.

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
- When changing behavior, update the relevant Japanese doc under `docs/` and refresh `docs/README.md` if the document map changes.

## Working Style

- Prefer existing components, utilities, routes, and styling patterns over new abstractions.
- Keep diffs scoped to the request.
- Do not introduce new dependencies, storage locations, or color systems without a clear need.

## LEARNINGS.md ループ

各セッションの開始時に、リポジトリ直下の LEARNINGS.md を読め。
読んだ内容を1〜3行で要約して提示し、読み込みが行われたことを可視化せよ。
セッション終了時には `update-learnings` スキルの実行を促せ。

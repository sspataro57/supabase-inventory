# supabase_inventory — Institutional Knowledge

Single source of truth for landmines, conventions, and known issues across `supabase_inventory` (Next.js web app, Capacitor Android shell, Supabase Postgres backend). All agents in `.claude/agents/` reference this file rather than duplicating its contents in their system prompts.

**When you update this file:** the agents will pick up changes on their next session. No need to edit individual agent prompts unless the change is structural (e.g. a new category of issue).

> This file starts mostly empty. Fill in real landmines as they bite. Don't pre-populate with speculation — only verified, repeat-offender issues belong here.

---

## Known landmines (verified bites)

_None recorded yet. Add real ones here when they bite a second time. Format: location (file:line or package), symptom, recipe._

<!-- Example shape:
### RLS recursion on `inventory_movements`
**Location:** `supabase/migrations/2026xxxxxxxx_movements_rls.sql`
The policy references its own table inside the USING clause. Symptom: 500 with `infinite recursion in policy`. Any new movement policy must not self-reference.
-->

---

## Architectural conventions

### Stack
- **Frontend:** Next.js 15 App Router (React 19), Tailwind CSS v4
- **Backend:** Supabase — Postgres + Auth + Storage + RLS
- **AI / Chat:** OpenAI or Anthropic (switchable via `LLM_PROVIDER` env), pgvector for semantic search
- **PDF:** `@react-pdf/renderer`
- **Mobile:** Capacitor (Android), ZXing barcode scanner (web), ML Kit on Android
- **Monorepo:** pnpm workspaces + Turborepo (`pnpm-workspace.yaml`)
- **Hosting:** Vercel (web) + Supabase hosted (DB)

### Repo layout
```
apps/web/         Next.js 15 app (the primary surface)
apps/mobile/      Capacitor Android shell wrapping the web build
packages/shared/  Zod schemas + generated DB types (`src/db.ts`)
packages/db/      Bootstrap scripts (e.g. `bootstrap-admin`)
supabase/         migrations/, seed.sql, edge functions/
.github/workflows/ migrate.yml — auto-runs `supabase db push` per branch
```

### Next.js conventions
- **App Router only.** Server components by default; client components opt-in with `"use client"`.
- Route groups in parens: `(admin)`, `(app)`, `(auth)`.
- API handlers in `apps/web/app/api/`.
- Server actions live alongside the route or in `apps/web/lib/`.
- Per `apps/web/AGENTS.md`: this is Next.js 16 and has breaking changes vs. older versions — check `node_modules/next/dist/docs/` before relying on training-data knowledge.

### Supabase / Postgres
- **All schema changes go through `supabase/migrations/` SQL files.** Never edit the DB directly in production.
- After every schema change, regenerate types: `pnpm db:types` (writes `packages/shared/src/db.ts`).
- RLS is on for every user-facing table. New tables must ship with policies in the same migration.
- The `service_role` key is server-only — never exposed to the browser. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the client key.
- Local dev DB port: see `supabase/config.toml` (`[db].port`).

### Validation
- **Zod** for all input boundaries (API routes, server actions, form parsers).
- Shared schemas in `packages/shared/`.

### Forms
- `react-hook-form` + `@hookform/resolvers/zod`.

### Auth
- Supabase Auth via `@supabase/ssr`. Server components use `createServerClient`, client components use `createBrowserClient`.
- Argon2 (`argon2` package) used for MCP token hashing — not user passwords (Supabase Auth owns those).

### Chat / AI provider abstraction
- Env var: `LLM_PROVIDER` = `openai` | `anthropic` (default `openai`).
- The 9 inventory tools are exposed as both an internal chat surface and as MCP tools (for Claude Code / Claude Desktop via tokens stored hashed with Argon2).
- Reads are tool-call driven against the DB — never raw SQL injected from the prompt.

### Reports
- 9 parameterised reports (inventory, movements, low stock, expiring lots, dead stock, audit trail, etc.). CSV and PDF export. PDF via `@react-pdf/renderer`.

### Movements ledger
- Append-only. Negative-stock guard at write time. FEFO lot selection (earliest expiration first). Unit conversion handled by the shared unit registry.

---

## Test infrastructure

### Current state
- `pnpm test` is wired through Turborepo but no test runner is configured yet in any workspace.
- **There are no automated tests today.** The `test-author` agent will scaffold Vitest/Playwright the first time it's invoked. Decide which to install (Vitest for unit, Playwright for e2e) when that happens.

### Recommended layout (when added)
- Unit tests: `apps/web/__tests__/` or colocated `*.test.ts(x)` next to the file under test. Vitest.
- E2E / UI: `apps/web/e2e/` with Playwright. Reproductions for bug tickets go under `apps/web/e2e/repros/{TICKET}.spec.ts`; converted regressions under `apps/web/e2e/regression/{TICKET}.spec.ts`.
- DB-level repros: ad-hoc SQL files in `/tmp/repro-{TICKET}.sql` against the local Supabase Postgres.

---

## Process conventions

### Branch naming
`ticket-<id>-<short-kebab-slug>` — matches the existing pattern (e.g. `ticket-69-correction-2`). `<id>` is the OpenProject work_package id.

### Commit message format
```
Short imperative summary (OpenProject #<id>)

Optional body explaining the why if non-trivial.
```

**Never** add `Co-Authored-By: Claude` trailers.

### PR target branch
Default base: `main`. The README documents an optional `staging → main` flow; use `--base staging` when explicitly working through staging.

### OpenProject workflow
- Self-hosted instance: `https://openproject.sspataro.com`.
- Auth: HTTP Basic, username literally `apikey`, password = `$OPENPROJECT_TOKEN` (exported in `~/.bashrc`).
- Inventory project id: `35`.
- Type id 4 = Feature, type id 7 = Bug. Default status id 1 = New.
- The `openproject-intake` agent captures tickets verbatim into `docs/tickets/`.
- See `~/.claude/projects/-home-salvo-WebstormProjects-supabase-inventory/memory/reference_openproject_api.md` for full API reference (endpoints, filters, relation-create gotchas).

### Authorization rules
- Never commit, push, or open PRs without explicit user authorization.
- Never create OpenProject tickets, comments, or transitions without explicit user authorization.
- Local-only files never staged: `apps/web/.env.local`, anything under `.env*` other than `.env.example`.

### Deploy gates
- Migrations under `supabase/migrations/` are auto-applied by `.github/workflows/migrate.yml` on push to the deploy branch.
- Vercel auto-deploys per branch.
- Never push directly to the deploy branch — go through PR.

### CI cost discipline
- `pnpm lint` and `pnpm build` locally before pushing.
- Don't WIP-push just to use remote CI.

---

## How agents should use this file

Each agent's system prompt instructs it to read this file at session start. The relevant sections per agent role:

- `openproject-intake`: process conventions (OpenProject section)
- `spec-writer`: conventions + landmines — populate SPEC's "files likely to touch" and "institutional bites that apply"
- `bug-reproducer`: test infrastructure section — pick a reproduction surface that exists
- `bug-diagnoser`: landmines — check these as cheapest hypotheses BEFORE wider tracing
- `test-author`: test infrastructure — scaffold the runner if missing, then write failing tests
- `code-reviewer`: all sections — review every applicable item
- `pr-writer`: process conventions — branch name, commit format, PR target

---

## Update protocol

When you discover a new landmine, fix a known one, or change a convention:
1. Update this file.
2. Mention "I updated INSTITUTIONAL_KNOWLEDGE.md" in your next session so the agent re-reads.
3. Don't update individual agent prompts unless the change is structural.

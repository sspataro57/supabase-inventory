# Inventory Management System

Single-tenant inventory management system — catalog, movements, lot tracking, barcode scanning, AI chat assistant, and reports.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, Tailwind CSS v4 |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| AI / Chat | OpenAI or Anthropic (switchable), pgvector semantic search |
| PDF | @react-pdf/renderer |
| Mobile | Capacitor (Android), ZXing barcode scanner (web) |
| Monorepo | pnpm + Turborepo |
| Hosting | Vercel (web) + Supabase hosted (DB) |

## Repo layout

```
supabase_inventory/
├── apps/
│   ├── web/                  # Next.js 15 app
│   └── mobile/               # Capacitor Android shell
├── packages/
│   ├── shared/               # Zod schemas, generated DB types
│   └── db/                   # Bootstrap scripts
├── supabase/
│   ├── migrations/           # All schema migrations (source of truth)
│   ├── seed.sql              # Units + preferences seed
│   └── functions/            # Edge functions (low-stock notify, CSV import)
└── .github/workflows/        # CI: auto-run migrations on push
```

## Features

- **Catalog** — products with SKU, barcodes, measure type (mass / volume / count), lot tracking, reorder points
- **Movements** — append-only ledger with unit conversion, FEFO lot selection, negative-stock guard
- **Barcode scanning** — ZXing camera scanner in browser, ML Kit on Android (Capacitor)
- **Reports** — 9 parameterised reports (inventory, movements, low stock, expiring lots, dead stock, audit trail) with CSV and PDF export
- **Chat assistant** — natural-language read-only queries powered by OpenAI or Anthropic, with 9 inventory tools
- **MCP tokens** — expose the same tools to Claude Code / Claude Desktop via Model Context Protocol
- **Dark mode** — per-user theme preference, zero-flash SSR
- **Import / Export** — bulk CSV import with per-row error reporting
- **Audit log** — every admin action recorded with before/after diff

## Local development

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- Supabase CLI (`brew install supabase/tap/supabase` or [docs](https://supabase.com/docs/guides/cli))
- Docker (for local Supabase)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start local Supabase (runs Postgres + Auth + Storage in Docker)
supabase start

# 3. Apply migrations and seed
supabase db reset        # runs all migrations + seed.sql

# 4. Copy env and fill in values printed by `supabase start`
cp apps/web/.env.example apps/web/.env.local

# 5. Bootstrap your admin account
pnpm --filter db bootstrap-admin you@example.com

# 6. Start the web app
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI provider) |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Anthropic provider) |
| `LLM_PROVIDER` | `openai` or `anthropic` (default: `openai`) |
| `RESEND_API_KEY` | Resend API key for low-stock email notifications |

## Deployment

Two environments: **staging** (`staging` branch) and **production** (`main` branch).

### One-time setup

1. Create two Supabase hosted projects — `inventory-staging` and `inventory-production`.
2. Push migrations and seed to each:
   ```bash
   supabase link --project-ref <PROJECT_REF>
   supabase db push
   # then run seed via Supabase SQL editor or:
   supabase db execute --file supabase/seed.sql --project-ref <PROJECT_REF>
   ```
3. Create a Vercel project, set **Root Directory** to `apps/web`, connect to this repo.
4. Set environment variables in Vercel per environment (Production → prod Supabase, Preview branch `staging` → staging Supabase).
5. Add GitHub secrets for the migration workflow:

| Secret | Description |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | From supabase.com → Account → Access Tokens |
| `SUPABASE_STAGING_PROJECT_REF` | Staging project ref (short ID in dashboard URL) |
| `SUPABASE_PROD_PROJECT_REF` | Production project ref |

### Workflow

```
feature branch → PR to staging → merge
  → GitHub Actions: supabase db push → staging
  → Vercel: auto-deploy staging preview

staging → PR to main → merge
  → GitHub Actions: supabase db push → production
  → Vercel: auto-deploy production
```

The migration workflow only runs when files under `supabase/migrations/` change.

## Generating the PDF manual

```bash
cd apps/web
node_modules/.bin/tsx scripts/generate-manual.tsx
# writes public/manual.pdf
```

The manual is served on-demand via `/api/manual` (authenticated) and is also available as a static file at `/manual.pdf` after generation.

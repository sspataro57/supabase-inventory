# Ticket #90 — SPEC

## Source
`docs/tickets/90.md` — "Reports: documentar el reporte 'Audit Trail'". Derived from #69. Client doesn't understand what the report is for; document its purpose and use cases, or rename it.

## Goal
Improve the discoverability and self-explanation of the `audit-trail` report by giving it a clearer display name, an expanded `description`, and a help blurb rendered on the report detail page header. URL slug stays `audit-trail` for URL stability.

## What the audit_trail report actually shows (today, factually)

Backed by `report_audit_trail(p_from date, p_to date)` in `supabase/migrations/20260506000020_reports.sql:411-433`. Reads from `audit_log` (see `supabase/migrations/20260506000008_audit.sql`), joins `profiles` for actor email, returns rows ordered by `occurred_at desc`.

**Columns surfaced (registry):** When, Actor, Action, Entity, ID. The SQL row also includes `diff jsonb` but the registry does not render it — so the report user sees a flat list of "who did what to which entity, when" without the before/after payload. (The `/audit` admin page renders the diff in collapsible form; the report does not.)

**Actions currently written into `audit_log`** (grepped from `writeAudit(...)` plus one direct insert):
- `product.create` — `apps/web/app/(admin)/products/actions.ts:101, 303`
- `product.update` — `apps/web/app/(admin)/products/actions.ts:178`
- `product.archive` — `apps/web/app/(admin)/products/actions.ts:331`
- `product.import` — `apps/web/app/(admin)/import/actions.ts:85` and `supabase/functions/csv-import/index.ts:99`
- `user.create` — `apps/web/app/(admin)/users/actions.ts:58`
- `user.role_change` — `apps/web/app/(admin)/users/actions.ts:97`
- `preferences.update` — `apps/web/app/(admin)/preferences/actions.ts:52`

Notably NOT in the audit log: inventory movements (those live in the `movements` ledger), lot CRUD, login events. The report is strictly "admin-side configuration & catalog changes + user role changes."

**Visibility:** `isAdminOnly: true` in the registry; the RPC also enforces `is_admin()` server-side and raises `forbidden` otherwise. Keep both.

## Naming decision

Pick **"Change Log"** as the display name. Justification:
- "Audit Trail" is correct-but-jargony (the client said as much).
- "Activity Log" implies user activity / login history, which this report does not show.
- "Catalog Change Log" is too narrow — user role changes and preferences are included too.
- "Change Log" is plain English, accurately covers all current actions (catalog edits, user role changes, preferences edits), and doesn't over-promise (no movement ledger, no login history).

**Slug stays `audit-trail`.** It is a stable public URL; any bookmark, link from a Manual entry, or external doc would break. Internal references (`getReport("audit-trail")`) also stay green.

## Decisions made unilaterally

1. **English-only copy.** The app has no i18n surface (no `next-intl` / `react-intl` / locale dir found). The Spanish ticket description does not mean the app text needs a Spanish version. If/when i18n lands, all `description` fields will need translation together — not a per-ticket concern.
2. **Add a new optional `helpText` field to `ReportDef`.** Used by the detail page only. The existing `description` (one-liner) keeps its current job on the index card. Other reports can opt in later by adding `helpText`; this ticket only populates it for `audit-trail`.
3. **No SQL, no migration, no DB type regeneration.** Behavior and column shape unchanged.
4. **Keep `isAdminOnly: true`.** Role-change rows are security-sensitive.

## Acceptance criteria

1. The report card on `/reports` shows display name **"Change Log"** (was "Audit Trail") and a one-sentence description that names the categories of events covered (catalog edits, user role changes, preferences).
2. The detail page `/reports/audit-trail` header renders a help blurb (2-4 sentences) below the title that:
   - States what the report shows (changes to catalog, users, preferences),
   - Names a concrete use case (e.g. "Use this to answer 'who changed the reorder point on item X last week?'"),
   - Clarifies what it does NOT show (stock movements — point user at Movement Ledger / Movements Summary instead).
3. The URL `/reports/audit-trail` continues to resolve. No 404 from slug rename.
4. The RPC `report_audit_trail` is untouched. No migration. `pnpm db:types` not required.
5. Admin-only gating remains (`isAdminOnly: true` + server-side `is_admin()` check unchanged).
6. The index card for the report still gets the admin badge and the row count / columns rendered unchanged.
7. `pnpm build` and `pnpm lint` pass.

## Data model changes
None.

## API / route changes
None.

## UI changes

### `apps/web/lib/reports/registry.ts`
- Extend `ReportDef` with `helpText?: string`.
- In the `audit-trail` entry:
  - `name`: `"Audit Trail"` → `"Change Log"`.
  - `description`: rewrite to ~12-18 words naming the categories. Suggested: `"Who changed what in the catalog, in user roles, or in app preferences — over a date range."`
  - `helpText`: 2-4 sentence blurb as described in AC #2.

### `apps/web/app/(app)/reports/[slug]/page.tsx`
- Below the existing title row (line 56-67), render `report.helpText` if present, in a muted, slightly indented paragraph. Server component, no client interactivity needed.
- Recommended placement: between the title row and the param form, so it reads before the user has to pick dates.

### No change to `apps/web/app/(app)/reports/page.tsx`
The index card already renders `r.description`; the rewritten one-liner flows through automatically.

### No change to `apps/web/app/(admin)/audit/page.tsx`
That's the live `/audit` log viewer (different surface — paginated, with diff). Out of scope; the ticket is about the `/reports/audit-trail` report.

## Files likely to touch
- `apps/web/lib/reports/registry.ts` — add `helpText?: string` to `ReportDef`; rewrite `name`, `description`, and add `helpText` on the `audit-trail` entry.
- `apps/web/app/(app)/reports/[slug]/page.tsx` — render `report.helpText` under the header.

## In scope
- Rename display name of the `audit-trail` report to "Change Log".
- Rewrite its `description`.
- Add a `helpText` field plumbed through the detail page, populated for this report only.

## Out of scope
- Renaming the slug or the underlying RPC.
- Changing `audit_log` columns or what gets written into it.
- Adding the `diff` column to the report output.
- Adding `helpText` to the other eight reports (the registry change makes that trivially possible; the actual copy is a separate concern per report).
- Internationalization / Spanish copy.
- Changes to the live `/audit` admin page.
- Changes to the `/reports` index card layout beyond what flows from a new `description` string.

## Institutional bites that apply
- **App Router conventions** — `apps/web/AGENTS.md`: this is Next.js 16 with breaking changes; the detail page is already a Server Component reading `report.helpText` synchronously, so no client boundary or async wrapper is needed. Render plain JSX.
- **Zod at the boundary** — N/A (no input boundary changed).
- **RLS + types regeneration** — N/A (no schema change; do not run `pnpm db:types`).
- **Commit format** — `Short imperative summary (OpenProject #90)`, no `Co-Authored-By: Claude` trailer, no auto-push.

## Verification protocol

1. `pnpm lint` — clean.
2. `pnpm build` — clean.
3. Manual smoke:
   - Visit `/reports` as admin → card reads "Change Log" with the new one-liner; admin badge still present.
   - Visit `/reports` as a non-admin → the card is hidden (existing filter at `apps/web/app/(app)/reports/page.tsx:14`).
   - Visit `/reports/audit-trail` as admin → header shows title, admin badge, and the new help blurb above the param form.
   - Visit `/reports/audit-trail` as a non-admin → still redirects to `/reports` (existing guard at line 32).
   - Run the report with default dates → rows render unchanged; CSV/PDF export buttons still work.
4. No DB seed steps. No migration run. Do not invoke `pnpm db:types`.

## Open questions
None. The ticket is unambiguous once the rename target and the "where does the help live" decisions are made; both are resolved above.

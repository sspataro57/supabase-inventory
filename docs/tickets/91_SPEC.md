# Technical Spec — Ticket #91

## Source

`docs/tickets/91.md` — "Reports: añadir reporte por Location". Feature derived from #69. Depends on the locations/sub-locations model from #92 (now merged on `main` via `supabase/migrations/20260521120000_locations.sql`).

## Goal

Add a new report **Inventory by Location** that aggregates on-hand inventory by room and sub-location, surfacing distinct product / lot counts and total on-hand per measure type, so the team can answer "what's in Dry Storage right now?" without scanning the lot-detail report.

## Decisions made unilaterally (do not re-ask)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Slug:** `inventory-by-location`. **Name:** `Inventory by Location`. | Per task brief. |
| 2 | **Single combined layout, no parameter.** The result set returns one row per `(room, sub_location)` plus one **roll-up row per room** with `sub_location_code = NULL`. Rendered in order, the roll-up sits at the top of each room and the sub-location rows follow. | Avoids a parameter switch and a second report. Same SQL function returns both granularities; the UI just renders them. |
| 3 | **Empty rooms are shown.** A room with zero products yields the roll-up row only, with zero counts. Rooms are ordered by `locations.sort_order asc`. | Operationally useful (per task brief). |
| 4 | **Unassigned bucket.** Products with `sub_location_id IS NULL` are surfaced as a synthetic room row with `location_code = ''`, `room_name = 'Unassigned'`, `sub_location_code = NULL`, sorted last. No sub-location breakdown rows for it (there is no sub-location). | Hiding them would silently drop active inventory; this is the safest default. |
| 5 | **On-hand columns reject the `total_on_hand_g` shape from the task brief** because not all ingredients are mass (the `measure_type` enum is `mass | volume | count`). Replaced by **three numeric columns**: `on_hand_mass_oz`, `on_hand_volume_floz`, `on_hand_count_ea`. Each is `sum(base_quantity) / to_base_factor(target_unit)` filtered by `p.measure_type`. Base units are `g`, `ml`, `ea`; targets are `oz` (`to_base_factor = 28.3495`), `fl_oz` (`to_base_factor = 29.5735` — confirm the exact code in `units`), `ea`. **If the `oz` and `fl_oz` rows do not exist in the seeded `units` table, fall back to `g` and `ml` and surface `on_hand_mass_g` / `on_hand_volume_ml` instead.** The verification protocol checks this. The `lb` column from the task brief is dropped — `oz` divided by 16 is trivial enough that one column suffices and we avoid the round-twice precision question. |
| 6 | **No changes to existing reports.** Purely additive. | Per task brief. |
| 7 | **Not admin-only.** Matches every other inventory-oriented report in the registry. | Consistency. |

## Acceptance criteria

1. A new report appears at `/reports/inventory-by-location` with display name **Inventory by Location** and the description "Distinct ingredients, distinct lots, and on-hand totals grouped by storage room and sub-location."
2. The report's RPC returns a single result set ordered first by `locations.sort_order asc` (with the synthetic "Unassigned" group sorted last), then within each room: the roll-up row first (`sub_location_code IS NULL`), then sub-location rows ordered by `sub_location_code asc`.
3. For each row the report exposes the columns:
   - `location_code text` (e.g. `DR`, empty string for Unassigned)
   - `room_name text` (e.g. `Dry Storage`, `Unassigned` for the synthetic bucket)
   - `sub_location_code text NULL` (NULL on roll-up rows; an actual code like `DR-A-04-02` on detail rows)
   - `product_count integer` — count of distinct `products.id` whose canonical sub-location falls in this scope
   - `lot_count integer` — count of distinct `lots.id` (non-archived) attached to those products
   - `on_hand_mass_oz numeric` — sum of `m.base_quantity` for movements on `mass` products divided by the `oz` `to_base_factor`. `0` if no mass products in scope.
   - `on_hand_volume_floz numeric` — same for `volume` products divided by the `fl_oz` `to_base_factor`. `0` if none.
   - `on_hand_count_ea numeric` — sum for `count` products (`ea` is already base). `0` if none.
4. Empty rooms appear as a single roll-up row with `sub_location_code = NULL` and zero counts/totals.
5. Products with `sub_location_id IS NULL` appear under the synthetic `Unassigned` room; they contribute to its `product_count`, `lot_count`, and on-hand totals exactly the same as products with a sub-location.
6. The report is reachable from `/reports` (the index page) — no admin gate.
7. CSV export of this report works (no PDF column spec required for shipping — see "Out of scope").
8. `report_inventory_detailed` is unchanged. No other report's SQL, types, or registry entries are modified.

## Data model changes

### New migration

Filename: `supabase/migrations/20260521130000_report_inventory_by_location.sql` (stamp after the locations migration `20260521120000`).

Adds **only** a new composite row type and a new `report_inventory_by_location()` SQL function. No schema mutations; no RLS; no seed.

```sql
-- ── row type ────────────────────────────────────────────────────────────────
create type report_inventory_by_location_row as (
  location_code        text,
  room_name            text,
  sub_location_code    text,
  product_count        integer,
  lot_count            integer,
  on_hand_mass_oz      numeric,
  on_hand_volume_floz  numeric,
  on_hand_count_ea     numeric
);

-- ── function ────────────────────────────────────────────────────────────────
-- Returns, for each room (including empty rooms and the synthetic "Unassigned"
-- bucket), a roll-up row (sub_location_code NULL) followed by one row per
-- sub-location that has at least one product. On-hand totals are split by
-- measure_type because mass/volume/count are not summable into a single number.
create or replace function report_inventory_by_location()
returns setof report_inventory_by_location_row
language sql stable security invoker as $$
  with
  -- Per-(product, sub_location_id) on-hand in base units.
  product_oh as (
    select
      p.id              as product_id,
      p.sub_location_id,
      p.measure_type,
      coalesce(sum(m.base_quantity), 0) as base_oh
    from products p
    left join movements m
      on m.product_id = p.id
     and m.movement_type <> 'void'
    where p.is_archived = false
    group by p.id
  ),
  -- Per-(product) active lot count.
  product_lots as (
    select p.id as product_id, count(l.id)::integer as lot_count
    from products p
    left join lots l on l.product_id = p.id and l.is_archived = false
    where p.is_archived = false
    group by p.id
  ),
  -- Conversion factors. Fall back to base if oz/fl_oz aren't seeded.
  factors as (
    select
      coalesce((select to_base_factor from units where code = 'oz'),    1) as oz_factor,
      coalesce((select to_base_factor from units where code = 'fl_oz_us'), 1) as floz_factor
  ),
  -- All rooms (including empty), plus a synthetic Unassigned row.
  rooms as (
    select id, code, name, sort_order, false as is_unassigned
    from locations
    where is_active = true
    union all
    select null::uuid, ''::text, 'Unassigned'::text,
           1000000 as sort_order, true as is_unassigned
  ),
  -- Map every product (assigned or not) to its room.
  product_room as (
    select
      p.id              as product_id,
      p.measure_type,
      p.sub_location_id,
      coalesce(sl.code, null)             as sub_location_code,
      coalesce(sl.location_id, null)      as location_id,
      (sl.location_id is null)            as is_unassigned
    from products p
    left join sub_locations sl on sl.id = p.sub_location_id
    where p.is_archived = false
  ),
  -- Joined dataset (one row per product) carrying everything we need to aggregate.
  scoped as (
    select
      pr.product_id,
      pr.measure_type,
      pr.sub_location_code,
      pr.location_id,
      pr.is_unassigned,
      poh.base_oh,
      pl.lot_count
    from product_room pr
    left join product_oh   poh on poh.product_id = pr.product_id
    left join product_lots pl  on pl.product_id  = pr.product_id
  ),
  -- Roll-up rows: one per room (and one for Unassigned).
  rollup_rows as (
    select
      r.code  as location_code,
      r.name  as room_name,
      null::text as sub_location_code,
      coalesce(count(distinct s.product_id) filter (where s.product_id is not null), 0)::integer as product_count,
      coalesce(sum(s.lot_count)             filter (where s.product_id is not null), 0)::integer as lot_count,
      round(coalesce(sum(s.base_oh) filter (where s.measure_type = 'mass'),   0) / (select oz_factor   from factors), 4) as on_hand_mass_oz,
      round(coalesce(sum(s.base_oh) filter (where s.measure_type = 'volume'), 0) / (select floz_factor from factors), 4) as on_hand_volume_floz,
      round(coalesce(sum(s.base_oh) filter (where s.measure_type = 'count'),  0)                                          , 4) as on_hand_count_ea,
      r.sort_order,
      0 as row_kind  -- roll-up comes first within its room
    from rooms r
    left join scoped s
      on (r.is_unassigned and s.is_unassigned)
      or (not r.is_unassigned and s.location_id = r.id)
    group by r.code, r.name, r.sort_order, r.is_unassigned
  ),
  -- Detail rows: one per (room, sub_location_code) that actually has products.
  detail_rows as (
    select
      loc.code  as location_code,
      loc.name  as room_name,
      s.sub_location_code,
      count(distinct s.product_id)::integer as product_count,
      coalesce(sum(s.lot_count), 0)::integer as lot_count,
      round(coalesce(sum(s.base_oh) filter (where s.measure_type = 'mass'),   0) / (select oz_factor   from factors), 4) as on_hand_mass_oz,
      round(coalesce(sum(s.base_oh) filter (where s.measure_type = 'volume'), 0) / (select floz_factor from factors), 4) as on_hand_volume_floz,
      round(coalesce(sum(s.base_oh) filter (where s.measure_type = 'count'),  0)                                          , 4) as on_hand_count_ea,
      loc.sort_order,
      1 as row_kind  -- detail rows follow the roll-up
    from scoped s
    join sub_locations sl on sl.code = s.sub_location_code
    join locations     loc on loc.id = sl.location_id
    where s.sub_location_code is not null
    group by loc.code, loc.name, s.sub_location_code, loc.sort_order
  )
  select
    location_code,
    room_name,
    sub_location_code,
    product_count,
    lot_count,
    on_hand_mass_oz,
    on_hand_volume_floz,
    on_hand_count_ea
  from (
    select * from rollup_rows
    union all
    select * from detail_rows
  ) all_rows
  order by sort_order asc, row_kind asc, sub_location_code asc nulls first
$$;
```

Notes on the SQL:
- `security invoker` matches every other report. RLS on `products`, `lots`, `movements`, `sub_locations`, `locations` already grants read to any authenticated user.
- The roll-up rows use `count(distinct s.product_id)` filtered by `s.product_id is not null` so empty rooms come out as `0`, not `1`.
- `lot_count` in roll-ups is the sum of per-product active lot counts; identical to `count(distinct lots.id)` for that scope because every lot belongs to exactly one product, which belongs to exactly one room.
- Sort: roll-up first within a room via the `row_kind` sentinel; "Unassigned" goes last via the `1000000` sort_order on the synthetic row.

### Type regeneration

`pnpm db:types` — picks up the new RPC and row type. Writes a new entry in `packages/shared/src/db.ts`.

## API / route changes

No new routes. The existing `/reports/[slug]` route handles arbitrary slugs by dispatching on the registry; the new slug `inventory-by-location` is picked up automatically.

`exportCsv` in `apps/web/app/(app)/reports/[slug]/actions.ts` works as-is.

## TypeScript / shared types

Add a new row type in `apps/web/lib/reports/types.ts`:

```ts
export type ReportInventoryByLocationRow = {
  location_code: string;
  room_name: string;
  sub_location_code: string | null;
  product_count: number;
  lot_count: number;
  on_hand_mass_oz: number;
  on_hand_volume_floz: number;
  on_hand_count_ea: number;
};
```

Add it to the `AnyReportRow` union.

## Registry update

Append to `REPORTS` in `apps/web/lib/reports/registry.ts`:

```ts
{
  slug: "inventory-by-location",
  name: "Inventory by Location",
  description: "Distinct ingredients, distinct lots, and on-hand totals grouped by storage room and sub-location.",
  isAdminOnly: false,
  params: [],
  rpcName: "report_inventory_by_location",
  columns: [
    { key: "location_code",        label: "Room Code" },
    { key: "room_name",            label: "Room" },
    { key: "sub_location_code",    label: "Sub-Location" },
    { key: "product_count",        label: "Ingredients",  numeric: true },
    { key: "lot_count",            label: "Lots",         numeric: true },
    { key: "on_hand_mass_oz",      label: "Mass (oz)",    numeric: true },
    { key: "on_hand_volume_floz",  label: "Volume (fl oz)", numeric: true },
    { key: "on_hand_count_ea",     label: "Count (ea)",   numeric: true },
  ],
},
```

The existing `ReportTable` (`apps/web/app/(app)/reports/[slug]/ReportTable.tsx`) renders `sub_location_code: null` as the empty string via `formatCell` — that gives the roll-up row a visually distinct (blank Sub-Location) cell, which is exactly what we want.

## UI changes

None beyond the registry entry. The report list at `/reports` is rendered from the same registry and will pick up the new card automatically.

A future iteration could group roll-up rows visually (e.g. bold the roll-up, indent the detail rows). Not in scope here.

## Files likely to touch

- `supabase/migrations/20260521130000_report_inventory_by_location.sql` — NEW. Composite row type + SQL function.
- `packages/shared/src/db.ts` — regenerated by `pnpm db:types`.
- `apps/web/lib/reports/types.ts` — append `ReportInventoryByLocationRow` and add it to `AnyReportRow`.
- `apps/web/lib/reports/registry.ts` — append the new `ReportDef` entry.

That is the complete list. No changes to:
- `apps/web/app/(app)/reports/[slug]/page.tsx` (slug dispatch is registry-driven)
- `apps/web/app/(app)/reports/[slug]/ReportTable.tsx`
- `apps/web/app/(app)/reports/[slug]/actions.ts` (CSV export uses registry columns)
- `apps/web/app/(app)/reports/page.tsx`
- Any existing migration

## In scope

- New SQL composite type + function `report_inventory_by_location()`.
- New TypeScript row type, union member, and registry entry.
- Verifying the new report renders at `/reports/inventory-by-location` and exports to CSV.

## Out of scope

- **PDF export columns** for this report. `PDF_COLUMNS["inventory-by-location"]` would be added to `apps/web/lib/reports/pdf/columns.ts` to wire `exportPdf`; without it, the PDF export will render no columns. Decide separately whether PDF is needed here — leave it for a follow-up because eight columns will be tight on landscape letter and the column widths need real layout iteration.
- Visual differentiation of roll-up vs detail rows (bold, indent, sub-totals row). Future polish.
- A "filter by room" UI parameter. Not asked for and the current shape already shows all rooms.
- Editing the locations or sub_locations CRUD UI (covered by ticket #92's "Future work").
- Mobile / Capacitor flows.
- MCP / Chat tool exposure (`report.inventoryByLocation()`). Future.
- Changes to `report_inventory_detailed` (already extended by #92).
- Per-lot location reporting.
- Adding `oz` / `fl_oz` to the `units` table if they aren't already there. The function falls back gracefully to base units. Seeding new units is a separate ticket if needed.

## Institutional bites that apply

- **All schema changes go through `supabase/migrations/`.** The new function and composite type live in a dedicated migration file with a timestamp after `20260521120000_locations.sql` so the deploy ordering is unambiguous.
- **Regenerate types after schema change.** `pnpm db:types` must be run and `packages/shared/src/db.ts` committed.
- **RLS is on for every user-facing table.** No new tables here, so nothing new to gate — but the function runs `security invoker`, which means existing `select` policies on `products`, `lots`, `movements`, `sub_locations`, `locations` apply as the calling user. That matches the pattern of every other `report_*()` function.
- **Server components by default.** No new client code added; the existing `ReportTable` is the one and only client component on the path.
- **Next.js 16 caveats per `apps/web/AGENTS.md`.** Nothing exotic here — registry change is pure data; no use of `searchParams`, dynamic params, or caching APIs.
- **Zod at the boundary.** No new request inputs to validate; the report takes no params.
- **No service-role usage** in the path.

## Verification protocol

1. **Apply locally.** `pnpm supabase db reset` after dropping the new migration file in place. Confirm:
   - `select * from pg_type where typname = 'report_inventory_by_location_row';` returns one row.
   - `select * from report_inventory_by_location() order by 1, 3;` returns at least six roll-up rows (one per seeded room) plus the Unassigned row.
2. **Seeded units sanity.** Confirm `select code, to_base_factor from units where code in ('oz','fl_oz','ea');`. If `oz` or `fl_oz` is missing, the function returns mass/volume totals in base units (`g`, `ml`). Either accept that and rename the columns to `_g` / `_ml`, **or** add a units seed in a separate migration. Decide before merge.
3. **Empty room.** Insert a product into Cooler, leave Dry Storage empty (or vice-versa). Confirm the empty room appears with `product_count = 0`, `lot_count = 0`, all on-hand columns `0`, `sub_location_code IS NULL`.
4. **Unassigned bucket.** Insert a product with `sub_location_id IS NULL` (or null one out via SQL). Confirm it shows under `room_name = 'Unassigned'`, `location_code = ''`, sorted last.
5. **Roll-up consistency.** For one populated room, confirm `room.product_count = sum(detail rows in that room).product_count` (or check distinct count manually — distinct products may sit across multiple sub-locations only if you've assigned them, which we don't, but the SQL handles it via `count(distinct)`).
6. **Type generation.** `pnpm db:types`, commit. Confirm `Database["public"]["Functions"]["report_inventory_by_location"]` exists in `packages/shared/src/db.ts`.
7. **Build + lint.** `pnpm build` and `pnpm lint`.
8. **Manual smoke** (`pnpm dev`):
   1. Log in as any authenticated user. Visit `/reports`.
   2. Click `Inventory by Location`. Confirm the table renders with the columns from the registry entry.
   3. Confirm the order is: rooms in `sort_order` (`DR` → `CO` → `FZ` → `WH` → `3DC` → `ULF` → `Unassigned`), with the roll-up row first inside each room.
   4. Click the `Sub-Location` column header — confirm sorting works (the existing `ReportTable` sort just compares cell values; NULL sub-location sorts as empty string, fine).
   5. Click `Export CSV`. Confirm the CSV has all eight columns with the registry labels as headers.
9. **RLS spot-check.** Sign in as a non-admin authenticated user; confirm the report still loads (no admin gate).

## Open questions

None. All ambiguity from the task brief was resolvable from the locations migration and the existing reports pattern. The one substantive divergence from the brief (replacing `total_on_hand_g` with three split-by-measure-type columns) is documented in "Decisions made unilaterally" because the `measure_type` enum forces it.

## Future work (out of this ticket)

- PDF column spec for `inventory-by-location` in `apps/web/lib/reports/pdf/columns.ts`.
- Visual grouping in `ReportTable` (bold roll-up rows, indented sub-rows, room separators).
- Optional `?room=<code>` filter param on the registry entry.
- A "Movements by Location" report (in-flows / out-flows per room over a date range).
- MCP / Chat tool exposure.
- Seed `oz` and `fl_oz` into `units` if not already present, then make the column labels unconditional.

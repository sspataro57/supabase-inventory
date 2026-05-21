# Technical Spec — Ticket #92

## Source

`docs/tickets/92.md` — "Catalog/Reports: modelar Locations y Sub-locations". Feature derived from parent ticket #69. Six storage rooms (Dry Storage, Cooler, Freezer, Warehouse, 3-Door Cooler, ULF) with structured sub-locations of shape `<ROOM>-<SHELF>-<LEVEL>-<SPOT>` (example given: `DR-A-04-02`). Model in DB + expose in Catalog UI + expose in Reports.

## Goal

Introduce a normalised two-table model (`locations` + `sub_locations`) and tie each ingredient (product) to one canonical sub-location. The free-text `lots.location` column added in ticket #68 is dropped in the same migration. Surface room/sub-location in Catalog and in the `inventory-detailed` report.

## Decisions (post-OQ)

| OQ | Decision |
|----|----------|
| 1 — room codes | `DR` Dry Storage · `CO` Cooler · `FZ` Freezer · `WH` Warehouse · `3DC` 3-Door Cooler · `ULF` Ultra Low Freezer |
| 2 — `sub_locations.code` | **Trigger** (`BEFORE INSERT OR UPDATE`) — not a generated column. |
| 3 — sub-location creation | **On-the-fly from the New Ingredient form.** UI = room dropdown + 3 free-text fields (shelf / level / spot). Server upserts the `sub_locations` row if it doesn't exist, then assigns it to the product. |
| 4 — FK placement | **On `products`** (`products.sub_location_id`). One canonical storage spot per ingredient. |
| 5 — Catalog list filter | Moot — one location per product, so `?room=DR` is a straightforward predicate on `products.sub_location.location.code`. |
| 6 — legacy `lots.location` | **Dropped in the same migration.** Destructive but the column was added very recently (#68) and the model is moving entirely off lot-level location. |

## Acceptance criteria

1. `locations` table holds **exactly** six rows seeded by the migration: `DR`, `CO`, `FZ`, `WH`, `3DC`, `ULF`.
2. `sub_locations` table holds `(location_id, shelf, level, spot)` plus a `code` column maintained by a `BEFORE INSERT OR UPDATE` trigger. `code` is `UNIQUE` and follows the pattern `<ROOM>-<SHELF>-<LEVEL>-<SPOT>` (e.g. `DR-A-04-02`, with level/spot zero-padded to 2).
3. `products.sub_location_id uuid REFERENCES sub_locations(id) ON DELETE SET NULL` is added (nullable so existing rows survive).
4. `lots.location text` is **dropped** in the same migration.
5. RLS on both new tables: read = any authenticated user; write = admin only. Same pattern as `products` / `units`.
6. The New Ingredient form (`apps/web/components/NewIngredientForm.tsx`) replaces the hardcoded `LOCATIONS` constant with a **Room** select (populated from `locations`) plus three free-text inputs: **Shelf** (single letter A–Z), **Level** (1–99), **Spot** (1–99). On submit, `createIngredient`:
   - Validates the four parts.
   - Looks up an existing `sub_locations` row matching `(location_id, shelf, level, spot)`; inserts it if missing.
   - Writes `products.sub_location_id` with the resulting id.
7. The Catalog detail page (`apps/web/app/(app)/catalog/[id]/page.tsx`) shows the product's sub-location code (e.g. `DR-A-04-02`) and the room display name in the header.
8. The Catalog list page (`apps/web/app/(app)/catalog/page.tsx`) gains an optional "Filter by room" dropdown. `?room=<code>` restricts to products whose `sub_location.location.code = <code>`.
9. The Reports section: **Inventory — Lot Detail** (`report_inventory_detailed`) gains two columns `sub_location_code text` and `room_name text` (joined through `products → sub_locations → locations`). Empty strings for products with no sub-location. Columns are also added to `apps/web/lib/reports/registry.ts` and `apps/web/lib/reports/types.ts`.
10. `pnpm db:types` is run; `packages/shared/src/db.ts` includes the two new tables, the new `products.sub_location_id` column, and **no longer** has `lots.location`.
11. Zod schemas for sub-location code and parts live in `packages/shared/src/schemas/locations.ts` and are used by `createIngredient`.

## Data model changes

### New migration

Filename: `supabase/migrations/20260521120000_locations.sql` (pick a stamp after the latest `20260514000001`).

```sql
-- ── locations (rooms) ───────────────────────────────────────────────────────
create table locations (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint locations_code_format check (code ~ '^[A-Z0-9]{1,4}$')
);

create index locations_active_sort_idx on locations (is_active, sort_order);

-- ── sub_locations (shelf/level/spot inside a room) ──────────────────────────
create table sub_locations (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete restrict,
  shelf       text not null,
  level       smallint not null,
  spot        smallint not null,
  code        text not null,
  is_active   boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),

  unique (location_id, shelf, level, spot),
  unique (code),
  constraint sub_locations_shelf_format check (shelf ~ '^[A-Z]$'),
  constraint sub_locations_level_range  check (level between 1 and 99),
  constraint sub_locations_spot_range   check (spot  between 1 and 99)
);

create index sub_locations_location_idx on sub_locations (location_id);

-- Trigger maintains sub_locations.code = '<loc.code>-<SHELF>-<LL>-<SS>'
create or replace function sub_locations_set_code() returns trigger
language plpgsql as $$
declare
  loc_code text;
begin
  select code into loc_code from locations where id = new.location_id;
  if loc_code is null then
    raise exception 'sub_locations.location_id % does not exist', new.location_id;
  end if;
  new.shelf := upper(new.shelf);
  new.code  := loc_code || '-' || new.shelf || '-' ||
               lpad(new.level::text, 2, '0') || '-' ||
               lpad(new.spot::text,  2, '0');
  return new;
end;
$$;

create trigger sub_locations_set_code_trg
  before insert or update of location_id, shelf, level, spot
  on sub_locations
  for each row execute function sub_locations_set_code();

-- ── extend products ─────────────────────────────────────────────────────────
alter table products
  add column sub_location_id uuid references sub_locations(id) on delete set null;

create index products_sub_location_idx on products (sub_location_id);

-- ── drop the legacy lot-level location column added in #68 ──────────────────
alter table lots drop column if exists location;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table locations     enable row level security;
alter table sub_locations enable row level security;

create policy locations_read  on locations     for select using (auth.uid() is not null);
create policy locations_write on locations     for all    using (is_admin()) with check (is_admin());

create policy sub_locations_read  on sub_locations for select using (auth.uid() is not null);
create policy sub_locations_write on sub_locations for all    using (is_admin()) with check (is_admin());

-- ── seed the six rooms ──────────────────────────────────────────────────────
insert into locations (code, name, sort_order) values
  ('DR',  'Dry Storage',    10),
  ('CO',  'Cooler',         20),
  ('FZ',  'Freezer',        30),
  ('WH',  'Warehouse',      40),
  ('3DC', '3-Door Cooler',  50),
  ('ULF', 'Ultra Low Freezer', 60)
on conflict (code) do nothing;
```

### Update `report_inventory_detailed`

Same migration file, after the schema changes:

```sql
drop function if exists report_inventory_detailed();
drop type     if exists report_inventory_detailed_row;

create type report_inventory_detailed_row as (
  product_id        uuid,
  sku               text,
  product_name      text,
  lot_id            uuid,
  lot_code          text,
  expires_on        date,
  is_expired        boolean,
  on_hand_display   numeric,
  display_unit      text,
  sub_location_code text,
  room_name         text
);

create or replace function report_inventory_detailed()
returns setof report_inventory_detailed_row
language sql stable security invoker as $$
  select
    p.id, p.sku, p.name,
    l.id, l.lot_code,
    l.expires_on,
    l.expires_on < current_date,
    round(coalesce(sum(m.base_quantity), 0) /
          (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)), 4),
    resolve_display_unit(p.measure_type, p.display_unit),
    coalesce(sl.code, ''),
    coalesce(loc.name, '')
  from products p
  join lots l on l.product_id = p.id and l.is_archived = false
  left join sub_locations sl  on sl.id  = p.sub_location_id
  left join locations     loc on loc.id = sl.location_id
  left join movements     m   on m.lot_id = l.id and m.movement_type <> 'void'
  where p.is_archived = false
  group by p.id, l.id, sl.code, loc.name
  order by p.name, l.expires_on nulls last
$$;
```

### Type regeneration

After applying locally (`pnpm supabase db reset`), run `pnpm db:types`. This rewrites `packages/shared/src/db.ts`.

## Validation

New file `packages/shared/src/schemas/locations.ts`:

```ts
import { z } from "zod";

export const RoomCodeSchema = z.string().regex(/^[A-Z0-9]{1,4}$/);
export const ShelfSchema   = z.string().regex(/^[A-Za-z]$/).transform((s) => s.toUpperCase());
export const LevelSchema   = z.coerce.number().int().min(1).max(99);
export const SpotSchema    = z.coerce.number().int().min(1).max(99);

export const SubLocationCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{1,4}-[A-Z]-\d{2}-\d{2}$/, "Sub-location code must look like DR-A-04-02");

export const LocationSchema = z.object({
  id: z.string().uuid(),
  code: RoomCodeSchema,
  name: z.string().min(1),
  is_active: z.boolean(),
});

export const SubLocationSchema = z.object({
  id: z.string().uuid(),
  location_id: z.string().uuid(),
  shelf: z.string().regex(/^[A-Z]$/),
  level: z.number().int().min(1).max(99),
  spot: z.number().int().min(1).max(99),
  code: SubLocationCodeSchema,
  is_active: z.boolean(),
});

export type LocationDto = z.infer<typeof LocationSchema>;
export type SubLocationDto = z.infer<typeof SubLocationSchema>;
```

Update `packages/shared/src/schemas/products.ts` — `NewIngredientFormSchema`:

- Remove `location` field.
- Add four fields driven by the form: `room_id` (UUID), `shelf`, `level`, `spot`.

```ts
room_id: z.string().uuid(),
shelf:   ShelfSchema,
level:   LevelSchema,
spot:    SpotSchema,
```

Export `locations` schemas from `packages/shared/src/index.ts` (or via a fresh barrel).

## Server action changes

In `apps/web/app/(admin)/products/actions.ts`, `createIngredient(formData)`:

1. Parse with the updated `NewIngredientFormSchema`.
2. Look up or create the sub-location:
   ```ts
   const { data: existing } = await supabase
     .from("sub_locations")
     .select("id")
     .eq("location_id", room_id)
     .eq("shelf", shelf)
     .eq("level", level)
     .eq("spot", spot)
     .maybeSingle();

   let subLocationId = existing?.id;
   if (!subLocationId) {
     const { data: created, error } = await supabase
       .from("sub_locations")
       .insert({ location_id: room_id, shelf, level, spot })
       .select("id")
       .single();
     if (error) throw new Error(`Could not create sub-location: ${error.message}`);
     subLocationId = created.id;
   }
   ```
   (Admin gate already enforced on `createIngredient`, so the write is allowed by RLS.)
3. Write `products.sub_location_id = subLocationId` in the same insert (or as a follow-up update if the product is inserted first to obtain its id).
4. Continue with the existing lot-creation path. **Do not** write to `lots.location` anywhere — that column no longer exists.

## UI changes

### `apps/web/components/NewIngredientForm.tsx`

- Remove the hardcoded `LOCATIONS` constant.
- Accept `locations: LocationDto[]` as a prop from the server component.
- Replace the single Location select with four fields:
  - **Room** `<select name="room_id">` — options from `locations`, sorted by `sort_order`.
  - **Shelf** `<input name="shelf">` — single uppercase letter, `maxLength={1}`, `pattern="[A-Za-z]"`.
  - **Level** `<input name="level" type="number" min={1} max={99}>`.
  - **Spot** `<input name="spot" type="number" min={1} max={99}>`.
- Optional live preview: render the canonical code as the user types (`{room.code}-{shelf}-{pad(level)}-{pad(spot)}`).

### `apps/web/app/(admin)/products/new/page.tsx`

Server-fetch `locations` and pass to the form.

### `apps/web/app/(app)/catalog/page.tsx`

- Add a "Room" `<select>` to the filter form, options from `locations`.
- Read `?room=<code>` from `searchParams`.
- Filter the product list to those whose `sub_location.location.code = ?room`. Easiest path: select `products` joined to `sub_locations(code, location_id, locations(code, name))`, then filter in SQL via `.eq("sub_locations.locations.code", roomCode)`. Confirm Supabase JS supports this filter form on a nested join; if not, fetch `locations.id` first and `.eq("sub_locations.location_id", id)`.

### `apps/web/app/(app)/catalog/[id]/page.tsx`

- In the header, render the product's sub-location: `{sub_location.code} · {sub_location.location.name}` (e.g. `DR-A-04-02 · Dry Storage`).
- No new section needed; this is one line per product.

### `apps/web/app/(app)/reports/[slug]/page.tsx`

No code change. The new columns are picked up automatically from the registry update.

## Files likely to touch

- `supabase/migrations/20260521120000_locations.sql` — NEW. Tables, trigger, RLS, seed, FK on `products`, DROP `lots.location`, update `report_inventory_detailed`.
- `packages/shared/src/db.ts` — regenerated.
- `packages/shared/src/schemas/locations.ts` — NEW.
- `packages/shared/src/schemas/products.ts` — drop `location`, add `room_id` / `shelf` / `level` / `spot`.
- `packages/shared/src/index.ts` — export locations schemas.
- `apps/web/components/NewIngredientForm.tsx` — replace LOCATIONS constant with Room dropdown + 3 free-text fields.
- `apps/web/app/(admin)/products/new/page.tsx` — server-fetch locations, pass to form.
- `apps/web/app/(admin)/products/actions.ts` — `createIngredient` upserts sub-location and writes `products.sub_location_id`. Stops writing to `lots.location`.
- `apps/web/app/(app)/catalog/page.tsx` — Room filter dropdown + filter.
- `apps/web/app/(app)/catalog/[id]/page.tsx` — show sub-location in header.
- `apps/web/lib/reports/registry.ts` — append two columns to `inventory-detailed`.
- `apps/web/lib/reports/types.ts` — extend `ReportInventoryDetailedRow`.

## In scope

- Two new tables (`locations`, `sub_locations`) with seed, trigger, RLS, indexes.
- New nullable FK on `products`.
- DROP `lots.location text` (the column from #68).
- Zod schemas for rooms / sub-locations / form fields.
- New Ingredient form: Room dropdown + 3 free-text fields, on-the-fly upsert.
- Catalog list: room filter.
- Catalog detail: sub-location + room in header.
- `inventory-detailed` report gains two columns.
- Type regeneration.

## Out of scope

- Multi-location inventory for one product. Each product has one canonical sub-location.
- Per-lot location tracking. Lots inherit their product's location.
- Editing rooms or sub-locations from the UI. Admins manage them via SQL / Studio. A `/admin/locations` CRUD page is Future work.
- Surfacing location in any report other than `inventory-detailed`.
- "Movements by Location" / "Inventory by Room" rollups.
- Chat / MCP tool extensions.
- Mobile scan flows.
- Per-room RLS.

## Institutional bites that apply

- All schema changes go through `supabase/migrations/`. One new migration file covers tables + trigger + RLS + seed + drop-column + report-function update.
- `pnpm db:types` is mandatory after the migration.
- RLS: both new tables ship with policies in the same migration. Read = `auth.uid() is not null`; write = `is_admin()`. The existing `is_admin()` recursion fix covers us.
- Zod at every input boundary: `createIngredient` uses the updated form schema.
- Server components by default; the form stays client.
- Next.js 16 caveats per `apps/web/AGENTS.md` — nothing exotic in this change, but `revalidatePath` calls remain in place.
- No service-role usage needed; the seed runs from the migration as `postgres`.

## Verification protocol

1. **Apply the migration locally.** `pnpm supabase db reset`. Confirm `select count(*) from locations` = 6, with codes `DR / CO / FZ / WH / 3DC / ULF`.
2. **Trigger sanity.** Insert `(location_id=<DR>, shelf='a', level=4, spot=2)` into `sub_locations` and confirm `code` comes back as `DR-A-04-02`. Insert `(level=100)` and confirm `sub_locations_level_range` errors.
3. **Regenerate types.** `pnpm db:types`, commit `packages/shared/src/db.ts`. Confirm `lots.location` is gone and `products.sub_location_id` is present.
4. **Build + lint.** `pnpm build` and `pnpm lint`.
5. **Manual smoke** (local `pnpm dev`):
   1. Log in as admin. Visit `/products/new`. Confirm the Room dropdown lists six rooms. Fill `shelf=A`, `level=4`, `spot=2`, submit.
   2. Confirm a new `sub_locations` row `DR-A-04-02` was created and the new product's `sub_location_id` references it.
   3. Repeat with the same `(room, shelf, level, spot)` for a second product; confirm no duplicate sub-location row (the upsert reused it).
   4. Visit `/catalog/<id>` and confirm the header shows `DR-A-04-02 · Dry Storage`.
   5. Visit `/catalog`, select Room = Dry Storage in the filter, confirm the new product is listed. Switch to Cooler, confirm it disappears.
   6. Visit `/reports/inventory-detailed`. Confirm `Sub-Location` and `Room` columns appear and are populated.
   7. As a non-admin, confirm `/products/new` is forbidden (route group already enforces this).
6. **RLS spot-check.** In a SQL editor under an `authenticated` (non-admin) role, confirm `insert into locations ...` errors and `select * from locations` works.

## Future work (out of this ticket)

- `/admin/locations` CRUD page (rename rooms, archive sub-locations).
- A "Move ingredient to a different sub-location" admin action with audit log.
- Per-lot location override (if business ever needs to split one SKU across rooms).
- Inventory-by-Room and Movements-by-Room reports.
- Chat / MCP filters by location.
- Mobile scan flow targeting a QR-coded sub-location.

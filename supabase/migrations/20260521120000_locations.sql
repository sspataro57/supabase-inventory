-- Locations and Sub-locations (ticket #92)
-- Six storage rooms with structured sub-locations of shape <ROOM>-<SHELF>-<LL>-<SS>.
-- Each product gets a single canonical sub_location_id. The free-text lots.location
-- column added in ticket #68 is dropped here because the model is moving entirely
-- off lot-level location.

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

alter table products
  add column sub_location_id uuid references sub_locations(id) on delete set null;

create index products_sub_location_idx on products (sub_location_id);

-- Free-text lot location from #68 is superseded by products.sub_location_id.
alter table lots drop column if exists location;

alter table locations     enable row level security;
alter table sub_locations enable row level security;

create policy locations_read  on locations     for select using (auth.uid() is not null);
create policy locations_write on locations     for all    using (is_admin()) with check (is_admin());

create policy sub_locations_read  on sub_locations for select using (auth.uid() is not null);
create policy sub_locations_write on sub_locations for all    using (is_admin()) with check (is_admin());

insert into locations (code, name, sort_order) values
  ('DR',  'Dry Storage',       10),
  ('CO',  'Cooler',            20),
  ('FZ',  'Freezer',           30),
  ('WH',  'Warehouse',         40),
  ('3DC', '3-Door Cooler',     50),
  ('ULF', 'Ultra Low Freezer', 60)
on conflict (code) do nothing;

-- Extend the inventory_detailed report with sub-location/room columns.
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
    p.id,
    p.sku,
    p.name,
    l.id,
    l.lot_code,
    l.expires_on,
    l.expires_on < current_date,
    round(
      coalesce(sum(m.base_quantity), 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ),
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

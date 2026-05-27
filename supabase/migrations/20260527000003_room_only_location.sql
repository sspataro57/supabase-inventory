-- Only Room is required when classifying a product (OpenProject #105).
--
-- Until now, products had to be placed at a fully-qualified sub-location
-- (room + shelf + level + spot). The new requirement keeps Room mandatory but
-- makes Shelf/Level/Spot optional. To preserve the room association for
-- "room-only" products without inventing a synthetic sub_location row,
-- we denormalize the room onto products.location_id and use it as a fallback
-- when sub_location_id is null.

alter table products
  add column location_id uuid references locations(id) on delete set null;

create index if not exists products_location_idx on products (location_id);

-- Backfill: every existing product was previously placed at a sub_location,
-- so derive products.location_id from there. Rows with sub_location_id NULL
-- stay NULL until reclassified through the form.
update products p
   set location_id = sl.location_id
  from sub_locations sl
 where p.sub_location_id = sl.id
   and p.location_id is null;

-- Refresh report_inventory_detailed to look up the room via the new fallback.
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
    coalesce(l.expires_on < current_date, false),
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
  left join locations     loc on loc.id = coalesce(sl.location_id, p.location_id)
  left join movements     m   on m.lot_id = l.id and m.movement_type <> 'void'
  where p.is_archived = false
  group by p.id, l.id, sl.code, loc.name
  order by p.name, l.expires_on nulls last
$$;

-- Refresh report_inventory_by_location: a room-only product groups under its
-- room's rollup row but contributes no sub-location detail row. The Unassigned
-- bucket now only captures products with no room at all (location_id IS NULL).
create or replace function report_inventory_by_location()
returns setof report_inventory_by_location_row
language sql stable security invoker as $$
  with
  product_oh as (
    select
      p.id              as product_id,
      coalesce(sum(m.base_quantity), 0) as base_oh
    from products p
    left join movements m
      on m.product_id = p.id
     and m.movement_type <> 'void'
    where p.is_archived = false
    group by p.id
  ),
  product_lots as (
    select p.id as product_id, count(l.id)::integer as lot_count
    from products p
    left join lots l on l.product_id = p.id and l.is_archived = false
    where p.is_archived = false
    group by p.id
  ),
  factors as (
    select
      coalesce((select to_base_factor from units where code = 'oz'),    1) as oz_factor,
      coalesce((select to_base_factor from units where code = 'fl_oz_us'), 1) as floz_factor
  ),
  rooms as (
    select id, code, name, sort_order, false as is_unassigned
    from locations
    where is_active = true
    union all
    select null::uuid, ''::text, 'Unassigned'::text,
           1000000 as sort_order, true as is_unassigned
  ),
  product_room as (
    select
      p.id              as product_id,
      p.measure_type,
      p.sub_location_id,
      sl.code           as sub_location_code,
      coalesce(sl.location_id, p.location_id) as location_id
    from products p
    left join sub_locations sl on sl.id = p.sub_location_id
    where p.is_archived = false
  ),
  scoped as (
    select
      pr.product_id,
      pr.measure_type,
      pr.sub_location_code,
      pr.location_id,
      (pr.location_id is null) as is_unassigned,
      poh.base_oh,
      pl.lot_count
    from product_room pr
    left join product_oh   poh on poh.product_id = pr.product_id
    left join product_lots pl  on pl.product_id  = pr.product_id
  ),
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
      0 as row_kind
    from rooms r
    left join scoped s
      on (r.is_unassigned and s.is_unassigned)
      or (not r.is_unassigned and s.location_id = r.id)
    group by r.code, r.name, r.sort_order, r.is_unassigned
  ),
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
      1 as row_kind
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

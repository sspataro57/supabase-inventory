-- Report: Inventory by Location (ticket #91)
-- One roll-up row per room (sub_location_code IS NULL) followed by one detail
-- row per sub-location with at least one product. Empty rooms appear as
-- roll-up rows with zero counts. Products without a sub_location_id surface
-- under a synthetic 'Unassigned' bucket sorted last.

create type report_inventory_by_location_row as (
  location_code       text,
  room_name           text,
  sub_location_code   text,
  product_count       integer,
  lot_count           integer,
  on_hand_mass_oz     numeric,
  on_hand_volume_floz numeric,
  on_hand_count_ea    numeric
);

create or replace function report_inventory_by_location()
returns setof report_inventory_by_location_row
language sql stable security invoker as $$
  with
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
      sl.location_id    as location_id,
      (sl.location_id is null) as is_unassigned
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
      pr.is_unassigned,
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

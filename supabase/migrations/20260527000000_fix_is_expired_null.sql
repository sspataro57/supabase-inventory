-- Bug #95: report_inventory_detailed() returned NULL for is_expired when
-- lots.expires_on IS NULL. The composite return type declares is_expired as
-- a non-null boolean, so wrap the comparison with coalesce(..., false): a lot
-- without an expiration date is not expired.

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
  left join locations     loc on loc.id = sl.location_id
  left join movements     m   on m.lot_id = l.id and m.movement_type <> 'void'
  where p.is_archived = false
  group by p.id, l.id, sl.code, loc.name
  order by p.name, l.expires_on nulls last
$$;

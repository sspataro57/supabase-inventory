-- "Other" room with free-text label (OpenProject #107).
-- Some placements (developer desk, R&D Kitchen, etc.) don't fit any of the
-- built-in rooms. Picking "Other" on the form lets the user type a free-form
-- label that we store on the product directly. Mutually exclusive with
-- products.location_id at the application layer; this migration just makes
-- the storage available and surfaces the text as room_name in
-- report_inventory_detailed when no sub_location/location is set.

alter table products
  add column custom_location_text text;

-- Refresh report_inventory_detailed: room_name now falls back to
-- products.custom_location_text when the product has no sub_location and no
-- assigned room. Keeps the existing precedence for "real" placements.
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
    coalesce(loc.name, p.custom_location_text, '')
  from products p
  join lots l on l.product_id = p.id and l.is_archived = false
  left join sub_locations sl  on sl.id  = p.sub_location_id
  left join locations     loc on loc.id = coalesce(sl.location_id, p.location_id)
  left join movements     m   on m.lot_id = l.id and m.movement_type <> 'void'
  where p.is_archived = false
  group by p.id, l.id, sl.code, loc.name, p.custom_location_text
  order by p.name, l.expires_on nulls last
$$;

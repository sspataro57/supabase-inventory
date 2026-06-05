-- #150 / #151: Enrich the "Inventory by Ingredient" report.
--
-- #150: surface the product-level fields captured in the New Ingredient form
--       (Inventory Type, Manufacturer + item #, Broker + item #, Allergen,
--       Category, Location). Lot-level fields (lot code, dates) stay in the
--       "Inventory — Lot Detail" report since this report aggregates lots.
-- #151: add optional filters by Inventory Type, Allergen and Category.
--
-- This also carries the #155/#156 fan-out fix (lot_count via scalar subquery,
-- no lots join) so the function is correct regardless of migration ordering.

drop function if exists report_inventory_per_product();

drop type if exists report_inventory_per_product_row cascade;

create type report_inventory_per_product_row as (
  product_id              uuid,
  sku                     text,
  name                    text,
  inventory_type          text,
  manufacturer            text,
  manufacturer_item_no    text,
  broker                  text,
  broker_item_no          text,
  allergen                text,
  category                text,
  location                text,
  display_unit            text,
  on_hand_display         numeric,
  reorder_point_display   numeric,
  reorder_qty_display     numeric,
  is_low_stock            boolean,
  lot_count               bigint
);

create or replace function report_inventory_per_product(
  p_inventory_type text default null,
  p_allergen       text default null,
  p_category       text default null
)
returns setof report_inventory_per_product_row
language sql stable security invoker as $$
  select
    p.id,
    p.sku,
    p.name,
    p.inventory_type,
    p.manufacturer,
    p.manufacturer_item_no,
    p.broker,
    p.broker_item_no,
    p.allergen,
    p.category,
    coalesce(
      (select loc.name || coalesce(' · ' || sl.code, '')
         from sub_locations sl
         join locations loc on loc.id = sl.location_id
        where sl.id = p.sub_location_id),
      (select loc.name from locations loc where loc.id = p.location_id),
      p.custom_location_text
    ) as location,
    resolve_display_unit(p.measure_type, p.display_unit) as display_unit,
    round(
      coalesce(sum(m.base_quantity), 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as on_hand_display,
    round(
      p.reorder_point /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as reorder_point_display,
    round(
      p.reorder_quantity /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as reorder_qty_display,
    case
      when p.reorder_point is not null
       and coalesce(sum(m.base_quantity), 0) <= p.reorder_point
      then true else false
    end as is_low_stock,
    (select count(*) from lots l
       where l.product_id = p.id and l.is_archived = false) as lot_count
  from products p
  left join movements m on m.product_id = p.id and m.movement_type <> 'void'
  where p.is_archived = false
    and (p_inventory_type is null or p.inventory_type = p_inventory_type)
    and (p_allergen       is null or p.allergen       = p_allergen)
    and (p_category       is null or p.category       = p_category)
  group by p.id
  order by p.sku
$$;

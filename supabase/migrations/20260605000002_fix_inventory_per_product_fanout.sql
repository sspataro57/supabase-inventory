-- #155 / #156: "Inventory by Ingredient" report multiplied on-hand by lot count.
--
-- report_inventory_per_product() joined BOTH movements and lots to products on
-- product_id, with no relationship between those two tables. That produced a
-- Cartesian fan-out: every movement row was duplicated once per lot, so
-- sum(m.base_quantity) came out multiplied by the number of lots. A product
-- with two 480oz lots (960oz real) reported 1920oz.
--
-- Fix: drop the lots join and compute lot_count with a scalar subquery, so the
-- movement aggregation is no longer fanned out. on_hand and is_low_stock are now
-- correct; lot_count is unchanged.
create or replace function report_inventory_per_product()
returns setof report_inventory_per_product_row
language sql stable security invoker as $$
  select
    p.id,
    p.sku,
    p.name,
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
  group by p.id
  order by p.name
$$;

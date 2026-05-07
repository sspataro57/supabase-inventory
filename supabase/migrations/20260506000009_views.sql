-- Current on-hand in BASE units per product
create view product_stock as
select
  p.id          as product_id,
  p.sku,
  p.name,
  p.measure_type,
  p.display_unit,
  p.reorder_point,
  p.reorder_quantity,
  p.user_can_check_in,
  p.user_can_check_out,
  coalesce(sum(m.base_quantity), 0) as base_on_hand,
  case
    when p.reorder_point is not null
     and coalesce(sum(m.base_quantity), 0) <= p.reorder_point
    then true else false
  end as is_low_stock
from products p
left join movements m on m.product_id = p.id and m.movement_type <> 'void'
where p.is_archived = false
group by p.id;

-- Current on-hand in BASE units per lot
create view lot_stock as
select
  l.id            as lot_id,
  l.product_id,
  l.lot_code,
  l.expires_on,
  l.received_on,
  l.notes,
  coalesce(sum(m.base_quantity), 0) as base_on_hand
from lots l
left join movements m on m.lot_id = l.id and m.movement_type <> 'void'
where l.is_archived = false
group by l.id;

-- ============================================================
-- Performance index (covers date-range + product aggregations)
-- ============================================================
create index if not exists movements_report_idx
  on movements (occurred_at desc, product_id)
  where movement_type <> 'void';

-- ============================================================
-- Helper: resolve display unit code for a product row
-- returns products.display_unit if set, else preferences default
-- ============================================================
create or replace function resolve_display_unit(
  p_measure_type  measure_type,
  p_display_unit  text
) returns text language sql stable security invoker as $$
  select coalesce(
    p_display_unit,
    case p_measure_type
      when 'mass'   then (select default_unit_mass   from preferences where id = 1)
      when 'volume' then (select default_unit_volume from preferences where id = 1)
      when 'count'  then (select default_unit_count  from preferences where id = 1)
    end,
    case p_measure_type::text
      when 'mass'   then 'g'
      when 'volume' then 'ml'
      else 'ea'
    end
  )
$$;

-- ============================================================
-- Row types
-- ============================================================

create type report_inventory_per_product_row as (
  product_id              uuid,
  sku                     text,
  name                    text,
  display_unit            text,
  on_hand_display         numeric,
  reorder_point_display   numeric,
  reorder_qty_display     numeric,
  is_low_stock            boolean,
  lot_count               bigint
);

create type report_inventory_detailed_row as (
  product_id      uuid,
  sku             text,
  product_name    text,
  lot_id          uuid,
  lot_code        text,
  expires_on      date,
  is_expired      boolean,
  on_hand_display numeric,
  display_unit    text
);

create type report_physical_count_sheet_row as (
  sku             text,
  name            text,
  display_unit    text,
  system_on_hand  numeric
);

create type report_movements_per_product_row as (
  movement_id      uuid,
  occurred_at      timestamptz,
  movement_type    text,
  input_quantity   numeric,
  input_unit       text,
  display_quantity numeric,
  display_unit     text,
  reason           text,
  lot_code         text,
  performed_by     text
);

create type report_movements_summary_row as (
  day           date,
  product_id    uuid,
  sku           text,
  product_name  text,
  display_unit  text,
  n_check_ins   bigint,
  n_check_outs  bigint,
  in_display    numeric,
  out_display   numeric,
  net_display   numeric
);

create type report_low_stock_row as (
  product_id              uuid,
  sku                     text,
  name                    text,
  display_unit            text,
  on_hand_display         numeric,
  reorder_point_display   numeric,
  shortage_display        numeric,
  suggested_order_display numeric
);

create type report_expiring_lots_row as (
  lot_id            uuid,
  lot_code          text,
  product_id        uuid,
  sku               text,
  product_name      text,
  expires_on        date,
  days_until_expiry integer,
  is_expired        boolean,
  on_hand_display   numeric,
  display_unit      text
);

create type report_dead_stock_row as (
  product_id        uuid,
  sku               text,
  name              text,
  display_unit      text,
  on_hand_display   numeric,
  last_movement_at  timestamptz,
  days_inactive     integer
);

create type report_audit_trail_row as (
  occurred_at  timestamptz,
  actor_email  text,
  action       text,
  entity_type  text,
  entity_id    text,
  diff         jsonb
);

-- ============================================================
-- 1. inventory_per_product
-- ============================================================
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
    count(distinct l.id) as lot_count
  from products p
  left join movements m on m.product_id = p.id and m.movement_type <> 'void'
  left join lots l on l.product_id = p.id and l.is_archived = false
  where p.is_archived = false
  group by p.id
  order by p.name
$$;

-- ============================================================
-- 2. inventory_detailed (lot level)
-- ============================================================
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
    l.expires_on < current_date as is_expired,
    round(
      coalesce(sum(m.base_quantity), 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as on_hand_display,
    resolve_display_unit(p.measure_type, p.display_unit) as display_unit
  from products p
  join lots l on l.product_id = p.id and l.is_archived = false
  left join movements m on m.lot_id = l.id and m.movement_type <> 'void'
  where p.is_archived = false
  group by p.id, l.id
  order by p.name, l.expires_on nulls last
$$;

-- ============================================================
-- 3. physical_count_sheet
-- ============================================================
create or replace function report_physical_count_sheet(p_name_filter text default null)
returns setof report_physical_count_sheet_row
language sql stable security invoker as $$
  select
    p.sku,
    p.name,
    resolve_display_unit(p.measure_type, p.display_unit) as display_unit,
    round(
      coalesce(sum(m.base_quantity), 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as system_on_hand
  from products p
  left join movements m on m.product_id = p.id and m.movement_type <> 'void'
  where p.is_archived = false
    and (p_name_filter is null or p.name ilike '%' || p_name_filter || '%')
  group by p.id
  order by p.name
$$;

-- ============================================================
-- 4. movements_per_product
-- ============================================================
create or replace function report_movements_per_product(
  p_product_id  uuid,
  p_from        date,
  p_to          date
) returns setof report_movements_per_product_row
language sql stable security invoker as $$
  select
    m.id,
    m.occurred_at,
    m.movement_type::text,
    m.input_quantity,
    m.input_unit,
    round(
      abs(m.base_quantity) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as display_quantity,
    resolve_display_unit(p.measure_type, p.display_unit) as display_unit,
    m.reason,
    l.lot_code,
    pr.email as performed_by
  from movements m
  join products p on p.id = m.product_id
  left join lots l on l.id = m.lot_id
  left join profiles pr on pr.id = m.performed_by
  where m.product_id = p_product_id
    and m.movement_type <> 'void'
    and m.occurred_at >= p_from::timestamptz
    and m.occurred_at <  (p_to + 1)::timestamptz
  order by m.occurred_at desc
$$;

-- ============================================================
-- 5. movements_summary
-- ============================================================
create or replace function report_movements_summary(
  p_from  date,
  p_to    date
) returns setof report_movements_summary_row
language sql stable security invoker as $$
  select
    (m.occurred_at at time zone 'America/New_York')::date as day,
    p.id,
    p.sku,
    p.name,
    resolve_display_unit(p.measure_type, p.display_unit) as display_unit,
    count(*) filter (where m.movement_type = 'check_in')  as n_check_ins,
    count(*) filter (where m.movement_type = 'check_out') as n_check_outs,
    round(
      coalesce(sum(m.base_quantity) filter (where m.movement_type = 'check_in'),  0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as in_display,
    round(
      coalesce(sum(-m.base_quantity) filter (where m.movement_type = 'check_out'), 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as out_display,
    round(
      coalesce(sum(m.base_quantity) filter (where m.movement_type in ('check_in','check_out')), 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as net_display
  from movements m
  join products p on p.id = m.product_id
  where m.movement_type in ('check_in','check_out')
    and m.occurred_at >= p_from::timestamptz
    and m.occurred_at <  (p_to + 1)::timestamptz
  group by 1, p.id
  order by 1 desc, p.name
$$;

-- ============================================================
-- 6. low_stock
-- ============================================================
create or replace function report_low_stock()
returns setof report_low_stock_row
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
      (p.reorder_point - coalesce(sum(m.base_quantity), 0)) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as shortage_display,
    round(
      coalesce(p.reorder_quantity, 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as suggested_order_display
  from products p
  left join movements m on m.product_id = p.id and m.movement_type <> 'void'
  where p.is_archived = false
    and p.reorder_point is not null
  group by p.id
  having coalesce(sum(m.base_quantity), 0) <= p.reorder_point
  order by
    (p.reorder_point - coalesce(sum(m.base_quantity), 0)) / p.reorder_point desc
$$;

-- ============================================================
-- 7. expiring_lots
-- ============================================================
create or replace function report_expiring_lots(p_days_ahead integer default 30)
returns setof report_expiring_lots_row
language sql stable security invoker as $$
  select
    l.id,
    l.lot_code,
    p.id,
    p.sku,
    p.name,
    l.expires_on,
    (l.expires_on - current_date)::integer as days_until_expiry,
    l.expires_on < current_date as is_expired,
    round(
      coalesce(sum(m.base_quantity), 0) /
      (select to_base_factor from units where code = resolve_display_unit(p.measure_type, p.display_unit)),
      4
    ) as on_hand_display,
    resolve_display_unit(p.measure_type, p.display_unit) as display_unit
  from lots l
  join products p on p.id = l.product_id
  left join movements m on m.lot_id = l.id and m.movement_type <> 'void'
  where l.is_archived = false
    and p.is_archived = false
    and l.expires_on is not null
    and l.expires_on <= current_date + p_days_ahead
  group by l.id, p.id
  having coalesce(sum(m.base_quantity), 0) > 0
  order by l.expires_on
$$;

-- ============================================================
-- 8. dead_stock (admin only)
-- ============================================================
create or replace function report_dead_stock(p_days_inactive integer default 90)
returns setof report_dead_stock_row
language plpgsql stable security invoker as $$
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;
  return query
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
      max(m.occurred_at) filter (where m.movement_type <> 'void') as last_movement_at,
      extract(day from now() - max(m.occurred_at) filter (where m.movement_type <> 'void'))::integer as days_inactive
    from products p
    left join movements m on m.product_id = p.id
    where p.is_archived = false
    group by p.id
    having
      max(m.occurred_at) filter (where m.movement_type <> 'void') is null
      or extract(day from now() - max(m.occurred_at) filter (where m.movement_type <> 'void')) >= p_days_inactive
    order by last_movement_at nulls first;
end $$;

-- ============================================================
-- 9. audit_trail (admin only)
-- ============================================================
create or replace function report_audit_trail(
  p_from  date,
  p_to    date
) returns setof report_audit_trail_row
language plpgsql stable security invoker as $$
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select
      a.occurred_at,
      pr.email as actor_email,
      a.action,
      a.entity_type,
      a.entity_id,
      a.diff
    from audit_log a
    left join profiles pr on pr.id = a.actor_id
    where a.occurred_at >= p_from::timestamptz
      and a.occurred_at <  (p_to + 1)::timestamptz
    order by a.occurred_at desc;
end $$;

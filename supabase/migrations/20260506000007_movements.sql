create type movement_type as enum ('check_in','check_out','adjustment','void');

create table movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete restrict,
  lot_id          uuid references lots(id) on delete restrict,
  movement_type   movement_type not null,
  -- stored in BASE units; + adds stock, - removes stock
  base_quantity   numeric(20,4) not null,
  -- what the user typed (for audit/display)
  input_quantity  numeric(20,4) not null,
  input_unit      text not null references units(code),
  reason          text,
  voids_movement  uuid references movements(id),
  occurred_at     timestamptz not null default now(),
  performed_by    uuid not null references profiles(id),
  created_at      timestamptz not null default now()
);

create index movements_product_occurred_idx on movements (product_id, occurred_at desc);
create index movements_lot_idx on movements (lot_id);

-- Enforce lot rules on movements
create or replace function movements_validate_lot()
returns trigger language plpgsql as $$
declare
  lot_required boolean;
begin
  if new.movement_type = 'void' then
    return new;
  end if;

  select require_lot_per_movement into lot_required from preferences where id = 1;

  if lot_required and new.lot_id is null then
    raise exception 'lot_id is required for movements (admin preference: require_lot_per_movement)'
      using errcode = 'check_violation';
  end if;

  if new.lot_id is not null then
    if (select product_id from lots where id = new.lot_id) <> new.product_id then
      raise exception 'lot % does not belong to product %', new.lot_id, new.product_id;
    end if;
  end if;

  return new;
end $$;

create trigger movements_lot_check
before insert on movements
for each row execute function movements_validate_lot();

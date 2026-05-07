create table products (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text unique not null,
  name                text not null,
  description         text,
  measure_type        measure_type not null,
  display_unit        text references units(code),
  pack_size           integer,
  user_can_check_in   boolean not null default false,
  user_can_check_out  boolean not null default false,
  reorder_point       numeric(20,4),
  reorder_quantity    numeric(20,4),
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  created_by          uuid references profiles(id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id),

  constraint pack_size_only_for_count
    check (pack_size is null or measure_type = 'count')
);

create index products_sku_idx on products (sku);
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);

create table product_codes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  code        text not null,
  code_type   text not null check (code_type in ('barcode','qr','sku')),
  unique (code)
);

-- Enforce that display_unit measure type matches the product's measure type
create or replace function products_validate_display_unit()
returns trigger language plpgsql as $$
begin
  if new.display_unit is not null then
    if (select measure_type from units where code = new.display_unit) <> new.measure_type then
      raise exception 'display_unit % does not match measure_type %',
        new.display_unit, new.measure_type;
    end if;
  end if;
  return new;
end $$;

create trigger products_display_unit_check
before insert or update on products
for each row execute function products_validate_display_unit();

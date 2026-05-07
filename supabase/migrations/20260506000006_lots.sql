create table lots (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete restrict,
  lot_code        text not null,
  expires_on      date,
  received_on     date not null default current_date,
  notes           text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references profiles(id),
  unique (product_id, lot_code)
);

create index lots_product_expires_idx on lots (product_id, expires_on);

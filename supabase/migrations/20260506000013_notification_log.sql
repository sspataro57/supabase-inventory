-- Tracks sent notifications to avoid resending within 24h
create table notification_log (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null, -- 'low_stock' | 'expiring_lot'
  entity_id    uuid not null, -- product_id or lot_id
  sent_date    date not null default current_date,
  sent_at      timestamptz not null default now(),
  unique (kind, entity_id, sent_date)
);

create index notification_log_sent_at_idx on notification_log (sent_at desc);

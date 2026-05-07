create table audit_log (
  id           bigserial primary key,
  actor_id     uuid references profiles(id),
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  diff         jsonb,
  occurred_at  timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_occurred_idx on audit_log (occurred_at desc);
create index audit_log_actor_idx on audit_log (actor_id, occurred_at desc);

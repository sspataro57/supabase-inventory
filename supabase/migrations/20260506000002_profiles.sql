create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null check (role in ('admin','user')) default 'user',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Helper used in RLS policies (stable = result cached per transaction, not security definer)
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

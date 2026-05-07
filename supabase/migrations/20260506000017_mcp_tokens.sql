create table mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  name         text not null,
  token_prefix text not null,   -- first 8 chars of raw token for display
  token_hash   text not null,   -- argon2id hash of full token
  is_revoked   boolean not null default false,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

create index mcp_tokens_user_idx on mcp_tokens (user_id);
create index mcp_tokens_prefix_idx on mcp_tokens (token_prefix);

alter table mcp_tokens enable row level security;

create policy "users can manage own tokens"
  on mcp_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

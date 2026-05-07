create table chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','tool')),
  content         text,
  created_at      timestamptz not null default now()
);

create table chat_tool_calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  source          text not null check (source in ('chat','mcp')),
  tool_name       text not null,
  tool_input      jsonb,
  tool_result     jsonb,
  actor_id        uuid references profiles(id),
  called_at       timestamptz not null default now()
);

create index chat_conversations_user_idx on chat_conversations (user_id, updated_at desc);
create index chat_messages_conv_idx on chat_messages (conversation_id, created_at asc);
create index chat_tool_calls_conv_idx on chat_tool_calls (conversation_id, called_at desc);

-- RLS
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table chat_tool_calls enable row level security;

create policy "users can manage own conversations"
  on chat_conversations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can manage messages in own conversations"
  on chat_messages for all
  to authenticated
  using (
    conversation_id in (
      select id from chat_conversations where user_id = auth.uid()
    )
  );

create policy "users can view own tool calls"
  on chat_tool_calls for select
  to authenticated
  using (actor_id = auth.uid() or exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

create policy "service can insert tool calls"
  on chat_tool_calls for insert
  to authenticated
  with check (actor_id = auth.uid());

create table preferences (
  id                            int primary key default 1 check (id = 1),
  default_unit_mass             text not null references units(code) default 'g',
  default_unit_volume           text not null references units(code) default 'ml',
  default_unit_count            text not null references units(code) default 'ea',
  low_stock_check_enabled       boolean not null default true,
  require_lot_per_movement      boolean not null default false,
  audit_retention_days          int not null default 365,
  -- chat / LLM settings
  default_llm_provider          text not null default 'openai'
                                  check (default_llm_provider in ('openai','anthropic')),
  default_llm_model             text,
  chat_daily_message_limit      int not null default 50,
  updated_at                    timestamptz not null default now(),
  updated_by                    uuid references profiles(id)
);

# Inventory System — Spec

**Stack:** Supabase (Postgres + Auth + Storage + Realtime) · Next.js (App Router) on Vercel · Capacitor (Android-first) for native scanning
**Tenancy:** Single company, single tenant
**Status:** v1 spec

---

## 1. Goals & scope

A simple inventory system for a single company. Two roles: **Admin** and **User**. Admins manage the catalog and rules; Users query inventory and perform check-in/check-out movements when permitted. Products are tracked granularly by **weight**, **volume**, or **count (units)**, with full unit conversion. A global default unit per measure type is set in preferences and is overridable per product by an Admin.

### In scope (v1)
- Catalog CRUD (Admin)
- Inventory queries (all roles)
- Check-in / check-out movements (Users, gated by per-product setting)
- Lot/batch tracking with expiration dates
- Min stock alerts / reorder points
- Full audit log of all movements and catalog changes
- CSV import/export of catalog and stock
- Barcode/QR scanning (Capacitor, Android first) for **lookup + transactions**
- Unit conversion engine (mass, volume, count)
- Read-only chat assistant for natural-language inventory queries
- Semantic / vector search over the catalog (pgvector)
- MCP server exposing read-only inventory tools to external clients (Claude Desktop, Claude Code, etc.)
- Semantic / vector search over the product catalog (pgvector)
- MCP server endpoint exposing the read-only tool surface to external clients (Claude Desktop, Claude Code, etc.)

### Out of scope (v1)
- Multi-location / multi-warehouse
- Purchase orders, suppliers, vendor management
- Cost accounting / valuation (FIFO/LIFO)
- Label printing
- iOS build (Capacitor project should remain iOS-compatible; just not shipped)

---

## 2. Roles & permissions

| Capability | Admin | User |
|---|---|---|
| View catalog & stock | ✅ | ✅ |
| Search / scan to lookup | ✅ | ✅ |
| Check-in stock (receive) | ✅ | ✅ if product allows |
| Check-out stock (consume) | ✅ | ✅ if product allows |
| Create / edit / archive products | ✅ | ❌ |
| Set per-product unit override | ✅ | ❌ |
| Set per-product transaction permissions | ✅ | ❌ |
| Manage lots & expiration | ✅ | ✅ (during check-in) |
| Edit / void past movements | ✅ | ❌ |
| Manage preferences (default units, thresholds, lot policy) | ✅ | ❌ |
| Invite / disable users | ✅ | ❌ |
| Export / import CSV | ✅ | export only |
| Use chat assistant (read-only) | ✅ | ✅ |
| Generate MCP tokens (own) | ✅ | ✅ |
| Revoke any MCP token | ✅ | own only |
| View audit log | ✅ | own actions only |

Roles are stored on a `profiles` row keyed to `auth.users.id`. Enforcement is done in **Postgres RLS** (defense in depth) and mirrored in the Next.js server actions.

---

## 3. Domain model

### Measure types
Three fixed measure types: `mass`, `volume`, `count`.
- A product belongs to **exactly one** measure type, set at creation, immutable.
- All quantities for a product are stored in a **canonical base unit** for its measure type, regardless of how the user enters or sees them.

| Measure type | Canonical base unit | Display default (configurable) |
|---|---|---|
| mass | gram (`g`) | `g` |
| volume | milliliter (`ml`) | `ml` |
| count | each (`ea`) | `ea` |

### Units & conversion
Units live in a `units` table seeded with standard SI/imperial values plus user-extensible entries. Each row: `code`, `measure_type`, `to_base_factor` (multiply by this to get base), `display_name`, `system` (`si` | `imperial` | `custom`).

Seed examples:
- mass: `g` (1), `kg` (1000), `mg` (0.001), `oz` (28.3495), `lb` (453.592)
- volume: `ml` (1), `l` (1000), `fl_oz_us` (29.5735), `gal_us` (3785.41), `tsp` (4.92892), `tbsp` (14.7868), `cup_us` (236.588)
- count: `ea` (1), `dozen` (12), `case` (configurable per product via `pack_size`)

Conversion rule: **all internal storage and arithmetic uses the base unit.** Conversion happens only at the I/O boundary (forms, displays, CSV).

```
display_value = base_value / unit.to_base_factor
base_value    = input_value * unit.to_base_factor
```

For `count` with custom pack sizes (e.g. "case of 24"), the product carries a `pack_size` integer; a synthetic unit `case` is offered in the UI with `to_base_factor = pack_size`.

### Display unit resolution (per product, per render)
1. If `products.display_unit` is set → use it.
2. Else if `preferences.default_display_unit_<measure_type>` is set → use it.
3. Else use the canonical base unit.

---

## 4. Database schema (Postgres)

All tables live in `public` schema. Timestamps are `timestamptz`. PKs are `uuid` (`gen_random_uuid()`).

```sql
-- ── Auth / users ────────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null check (role in ('admin','user')) default 'user',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Units ───────────────────────────────────────────────────
create type measure_type as enum ('mass','volume','count');

create table units (
  code              text primary key,             -- 'g', 'kg', 'lb', 'ml', ...
  measure_type      measure_type not null,
  to_base_factor    numeric(20,10) not null check (to_base_factor > 0),
  display_name      text not null,
  system            text not null check (system in ('si','imperial','custom')),
  is_active         boolean not null default true
);

-- ── Preferences (single row, id=1) ──────────────────────────
create table preferences (
  id                            int primary key default 1 check (id = 1),
  default_unit_mass             text not null references units(code) default 'g',
  default_unit_volume           text not null references units(code) default 'ml',
  default_unit_count            text not null references units(code) default 'ea',
  low_stock_check_enabled       boolean not null default true,
  require_lot_per_movement      boolean not null default false,
  audit_retention_days          int not null default 365,
  updated_at                    timestamptz not null default now(),
  updated_by                    uuid references profiles(id)
);

-- ── Products ────────────────────────────────────────────────
create table products (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text unique not null,
  name                text not null,
  description         text,
  measure_type        measure_type not null,
  display_unit        text references units(code), -- null = inherit from preferences
  pack_size           integer,                      -- only meaningful for measure_type='count'
  -- transaction gating (per-product, set by admin)
  user_can_check_in   boolean not null default false,
  user_can_check_out  boolean not null default false,
  -- thresholds (in BASE units)
  reorder_point       numeric(20,4),
  reorder_quantity    numeric(20,4),
  -- lifecycle
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  created_by          uuid references profiles(id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id),

  constraint pack_size_only_for_count
    check (pack_size is null or measure_type = 'count'),
  constraint display_unit_matches_measure_type
    check (display_unit is null) -- enforced via trigger, see below
);

create index products_sku_idx on products (sku);
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);

-- ── Barcodes (one product → many codes) ─────────────────────
create table product_codes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  code        text not null,
  code_type   text not null check (code_type in ('barcode','qr','sku')),
  unique (code)
);

-- ── Lots / batches ──────────────────────────────────────────
create table lots (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete restrict,
  lot_code        text not null,                    -- supplier lot # or auto-generated
  expires_on      date,
  received_on     date not null default current_date,
  notes           text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references profiles(id),
  unique (product_id, lot_code)
);

create index lots_product_expires_idx on lots (product_id, expires_on);

-- ── Movements (immutable ledger; stock = sum of movements) ──
create type movement_type as enum ('check_in','check_out','adjustment','void');

create table movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete restrict,
  lot_id          uuid references lots(id) on delete restrict,
  movement_type   movement_type not null,
  -- always stored in BASE units; sign convention: + adds stock, - removes
  base_quantity   numeric(20,4) not null,
  -- what the user typed (for audit/display)
  input_quantity  numeric(20,4) not null,
  input_unit      text not null references units(code),
  reason          text,
  voids_movement  uuid references movements(id),     -- for movement_type='void'
  occurred_at     timestamptz not null default now(),
  performed_by    uuid not null references profiles(id),
  created_at      timestamptz not null default now()
);

create index movements_product_occurred_idx on movements (product_id, occurred_at desc);
create index movements_lot_idx on movements (lot_id);

-- ── Audit log (catalog & admin actions; movements have their own ledger) ──
create table audit_log (
  id           bigserial primary key,
  actor_id     uuid references profiles(id),
  action       text not null,             -- 'product.create', 'product.update', 'user.role_change', ...
  entity_type  text not null,             -- 'product','lot','preferences','profile'
  entity_id    text,                      -- uuid or other id as text
  diff         jsonb,                     -- { before: {...}, after: {...} }
  occurred_at  timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_occurred_idx on audit_log (occurred_at desc);
```

### Stock view

```sql
-- Current on-hand in BASE units
create view product_stock as
select
  p.id          as product_id,
  p.sku,
  p.name,
  p.measure_type,
  coalesce(sum(m.base_quantity), 0) as base_on_hand,
  p.reorder_point,
  case
    when p.reorder_point is not null
     and coalesce(sum(m.base_quantity),0) <= p.reorder_point
    then true else false
  end as is_low_stock
from products p
left join movements m on m.product_id = p.id and m.movement_type <> 'void'
where p.is_archived = false
group by p.id;

create view lot_stock as
select
  l.id            as lot_id,
  l.product_id,
  l.lot_code,
  l.expires_on,
  coalesce(sum(m.base_quantity), 0) as base_on_hand
from lots l
left join movements m on m.lot_id = l.id and m.movement_type <> 'void'
where l.is_archived = false
group by l.id;
```

### Trigger: enforce `display_unit` measure type matches product

```sql
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
```

### Trigger: enforce lot requirement on movements

```sql
create or replace function movements_validate_lot()
returns trigger language plpgsql as $$
declare
  lot_required boolean;
begin
  -- Only enforce on stock-changing movements; voids reference an existing row
  if new.movement_type = 'void' then
    return new;
  end if;

  select require_lot_per_movement into lot_required from preferences where id = 1;

  if lot_required and new.lot_id is null then
    raise exception 'lot_id is required for movements (admin preference: require_lot_per_movement)'
      using errcode = 'check_violation';
  end if;

  -- If a lot is provided, it must belong to the same product
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

### RLS policies (sketch)

```sql
alter table products    enable row level security;
alter table movements   enable row level security;
alter table lots        enable row level security;
alter table preferences enable row level security;
alter table audit_log   enable row level security;
alter table profiles    enable row level security;

-- Helper: is current user admin?
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

-- products: everyone authenticated reads non-archived; only admin writes
create policy products_read on products for select
  using (auth.uid() is not null);
create policy products_write on products for all
  using (is_admin()) with check (is_admin());

-- movements: everyone reads; insert allowed only if (admin) OR
-- (user AND respective per-product flag is true)
create policy movements_read on movements for select
  using (auth.uid() is not null);

create policy movements_insert_admin on movements for insert
  with check (is_admin());

create policy movements_insert_user_checkin on movements for insert
  with check (
    not is_admin()
    and movement_type = 'check_in'
    and exists (
      select 1 from products p
      where p.id = movements.product_id and p.user_can_check_in = true
    )
    and base_quantity > 0
    and performed_by = auth.uid()
  );

create policy movements_insert_user_checkout on movements for insert
  with check (
    not is_admin()
    and movement_type = 'check_out'
    and exists (
      select 1 from products p
      where p.id = movements.product_id and p.user_can_check_out = true
    )
    and base_quantity < 0
    and performed_by = auth.uid()
  );

-- preferences: read all, write admin
create policy preferences_read on preferences for select using (auth.uid() is not null);
create policy preferences_write on preferences for all using (is_admin()) with check (is_admin());
```

> **Sign convention:** check-in stores `base_quantity > 0`, check-out stores `base_quantity < 0`. The API computes the sign — UI always shows positive numbers.

---

## 5. Application architecture

### Frontend (Next.js, App Router)
- `app/(app)/dashboard` — low-stock + recent movements
- `app/(app)/catalog` — product list, search, filters
- `app/(app)/catalog/[id]` — product detail, stock by lot, movement history
- `app/(app)/scan` — Capacitor-only route, opens scanner, resolves to product
- `app/(app)/movements/new` — manual check-in/out form
- `app/(admin)/products/new|edit` — admin CRUD
- `app/(admin)/users` — user management
- `app/(admin)/preferences` — defaults, units, thresholds
- `app/(admin)/audit` — audit log viewer
- `app/api/import` / `app/api/export` — CSV endpoints

Server Components for reads, Server Actions for writes. Supabase SSR client (`@supabase/ssr`). All movement writes go through a server action that validates role + per-product flag before insert (matching the RLS — belt and suspenders).

### Backend (Supabase)
- **Auth:** email + password, magic link optional. Admin invites users via Supabase Admin API from a server action.
- **Database:** schema above, RLS on every table.
- **Realtime:** subscribe to `movements` and `product_stock` for the dashboard.
- **Storage:** bucket `product-images` (optional v1).
- **Edge Functions:** `low-stock-notify` (cron, daily), `csv-import` (signed URL upload → parse → batched inserts).

### Mobile (Capacitor)
- Wraps the same Next.js app via `@capacitor/core` + a thin shell.
- Plugins: `@capacitor-mlkit/barcode-scanning` (Android-native, supports 1D + QR), `@capacitor/camera`, `@capacitor/preferences` (offline JWT cache).
- Detection: `Capacitor.isNativePlatform()` gates the scan tab and calls `BarcodeScanner.scan()`. Web build falls back to a "Scan unavailable on web" placeholder or `zxing-js/browser` if you want webcam scanning.
- Auth flow: same Supabase session; the JWT is stored in `Preferences` so the app reopens logged-in.

### Scan → action flow
1. User taps Scan, scanner opens fullscreen.
2. On detected code → POST `/api/scan/resolve` with `{ code }`.
3. Server looks up `product_codes.code` → returns product + current stock + per-product permissions.
4. UI routes to a "Found X. Check in / Check out / View" sheet.
5. User picks quantity + unit (defaults to product `display_unit`), optionally selects/creates a lot, submits.
6. Server action converts to base units, inserts movement, returns updated stock.

---

## 6. Chat assistant (read-only)

A natural-language query surface over the inventory. Users type questions like *"how much flour do we have left"*, *"what lots expire this month"*, *"which products are below reorder point"*, and the assistant answers using a fixed toolset that hits the same views and tables the rest of the app uses. **Read-only by design** — the assistant has no tools that mutate state, no SQL execution, and runs as the calling user so RLS still applies.

### Provider abstraction

Mirrors the `LLMProvider` pattern from `mcp-svc`. A single interface, two implementations, switchable per-request via header or per-deploy via env var.

```ts
// lib/llm/provider.ts
export type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: ToolCall[] };
export type ToolDef    = { name: string; description: string; parameters: JSONSchema };
export type ToolCall   = { id: string; name: string; arguments: Record<string, unknown> };

export interface LLMProvider {
  name: 'openai' | 'anthropic';
  chat(opts: {
    system: string;
    messages: ChatMessage[];
    tools: ToolDef[];
    temperature?: number;
  }): Promise<{ message: ChatMessage; finishReason: 'stop' | 'tool_calls' | 'length' }>;
}
```

- `OpenAIProvider` — uses `gpt-4.1-mini` by default, OpenAI-compatible base URL configurable (so it'll point at any drop-in).
- `AnthropicProvider` — uses `claude-sonnet-4-5` by default; tool schema is translated from the same `ToolDef[]`.
- Selection: `LLM_PROVIDER` env (`openai` | `anthropic`) sets the default; an admin override at `preferences.default_llm_provider` wins; a per-request header `X-LLM-Provider` (admin only) wins above that for testing.

```sql
alter table preferences
  add column default_llm_provider text not null default 'openai'
    check (default_llm_provider in ('openai','anthropic')),
  add column default_llm_model    text;  -- null = provider's hardcoded default
```

### Tools exposed to the model

All tools are pure reads. They run **as the authenticated user** through a Supabase server client built with the user's JWT — meaning RLS is the security boundary, the model can't see anything the user couldn't see anyway.

| Tool | Purpose |
|---|---|
| `search_products` | Fuzzy search by name/SKU/barcode; returns id, name, sku, measure_type, display_unit. |
| `get_product` | Full product detail by id or SKU, including reorder point and per-product permissions. |
| `get_stock` | Current on-hand for one or many products, in a requested unit (validated against measure_type). Reads `product_stock` view. |
| `get_lots` | Lots for a product, with on-hand and expiration. Reads `lot_stock`. |
| `list_low_stock` | Products at or below reorder point. |
| `list_expiring_lots` | Lots expiring within N days (default 30). |
| `list_movements` | Movement history with filters: product, date range, type, user. Capped at 100 rows per call. |
| `convert_units` | Pure helper, no DB. Convert a value between units of the same measure type. |
| `get_preferences` | Default units, thresholds, lot policy. Useful so the model phrases answers in the right unit. |

Each tool definition lives in `lib/chat/tools/*.ts` and exports both the JSON schema and a typed handler. The handler signature is `(args, ctx) => Promise<unknown>` where `ctx` carries the per-request Supabase client.

### Architecture

```
User (web or Capacitor)
   │
   ▼
POST /api/chat  (Next.js Route Handler, edge or node)
   │  • Auth: validate Supabase JWT, load profile
   │  • Build LLMProvider from preferences + env
   │  • Build tool registry (schemas only)
   │
   ▼
Agent loop  (max 6 iterations, hard timeout 30s)
   │  while finishReason === 'tool_calls':
   │     for each tool_call:
   │        validate args against schema
   │        run handler with user-scoped supabase client
   │        append tool result to messages
   │     re-call provider
   │
   ▼
Stream final assistant message back via SSE
```

The route handler streams tokens via Server-Sent Events. The client renders incrementally and shows a small "looked up: get_stock(flour)" affordance per tool call so users see what the model did. Every tool call is logged.

### Database additions

```sql
-- Conversations: lightweight, one row per chat thread
create table chat_conversations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  title        text,                        -- auto-generated from first message
  provider     text not null,               -- 'openai' | 'anthropic' (snapshot at create)
  model        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index chat_conversations_user_idx on chat_conversations (user_id, updated_at desc);

create table chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','tool','system')),
  content         text,
  tool_calls      jsonb,                    -- assistant turn: [{id,name,arguments}]
  tool_call_id    text,                     -- tool turn: which call this responds to
  tool_name       text,                     -- tool turn: convenience for queries
  tokens_in       int,
  tokens_out      int,
  created_at      timestamptz not null default now()
);

create index chat_messages_conv_idx on chat_messages (conversation_id, created_at);

-- Tool call audit (separate from chat_messages so we keep it even if user deletes a thread)
create table chat_tool_calls (
  id              bigserial primary key,
  source          text not null check (source in ('chat','mcp')),
  conversation_id uuid,                     -- chat: thread id; mcp: null
  mcp_token_id    uuid references mcp_tokens(id),  -- mcp: which token; chat: null
  user_id         uuid not null references profiles(id),
  tool_name       text not null,
  arguments       jsonb not null,
  result_summary  text,                     -- e.g. "12 rows" or short text; not the full payload
  duration_ms     int,
  occurred_at     timestamptz not null default now(),
  constraint chat_tool_calls_source_consistency check (
    (source = 'chat' and conversation_id is not null and mcp_token_id is null)
 or (source = 'mcp'  and conversation_id is null     and mcp_token_id is not null)
  )
);

create index chat_tool_calls_user_idx on chat_tool_calls (user_id, occurred_at desc);

alter table chat_conversations enable row level security;
alter table chat_messages      enable row level security;
alter table chat_tool_calls    enable row level security;

-- Users see their own threads; admins see all
create policy chat_conversations_rw on chat_conversations
  for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

create policy chat_messages_rw on chat_messages
  for all
  using (
    exists (select 1 from chat_conversations c
            where c.id = chat_messages.conversation_id
              and (c.user_id = auth.uid() or is_admin()))
  )
  with check (
    exists (select 1 from chat_conversations c
            where c.id = chat_messages.conversation_id
              and (c.user_id = auth.uid() or is_admin()))
  );

create policy chat_tool_calls_read on chat_tool_calls
  for select using (user_id = auth.uid() or is_admin());
-- inserts only via service role from the route handler
```

### System prompt (sketch)

```
You are an inventory assistant for {company}. You answer questions about products,
stock levels, lots, expirations, and movement history using the provided tools.

Hard rules:
- You never modify inventory. There are no write tools. If a user asks to check
  something in or out, tell them to use the Movements screen or the scanner.
- Quantities you receive from tools are in BASE units (g, ml, ea). When showing
  numbers to the user, convert to the product's display_unit (or the user's
  requested unit) using convert_units. Never show a base value with the wrong
  unit label.
- If a question is ambiguous (e.g. "how much sugar" and there are three sugar
  SKUs), call search_products and ask the user to disambiguate by SKU or name.
- Cite specifics: when you give a number, mention the product name/SKU and the
  unit. When you give a date, format it ISO (YYYY-MM-DD).
- If a tool returns nothing or errors, say so plainly. Don't invent data.

Today is {date}. Default units: mass={mass_unit}, volume={volume_unit}, count={count_unit}.
```

### Frontend

- `app/(app)/chat` — conversation list + new-chat button.
- `app/(app)/chat/[id]` — thread view, streaming responses, tool-call chips inline (`🔧 get_stock`).
- Capacitor: same route, no native plugin needed. Voice input is a v2 nice-to-have via `@capacitor-community/speech-recognition`.
- Suggested prompts on empty state, sourced from common patterns: *"What's expiring this month?"*, *"Show low stock."*, *"How much {top product by movement count} do we have?"*

### Cost & rate limiting

- Per-user soft cap: 50 messages/day, configurable in preferences (`chat_daily_message_limit`).
- Per-conversation hard cap: 30 turns, then a "start a new chat" nudge.
- Token accounting written to `chat_messages.tokens_in/out`; daily rollup view for admins.
- Tool call cap per turn: 8 (the agent loop also has a 6-iteration ceiling).

### Semantic search over the catalog

`search_products` is hybrid: trigram + ILIKE for exact-ish matches, **pgvector cosine similarity** for semantic ones. A query for *"all-purpose flour"* finds a SKU named *"AP wheat flour, bleached"* even though no token overlaps.

Embeddings live in Postgres alongside the product. No external store.

```sql
create extension if not exists vector;

alter table products
  add column embedding vector(1536),                   -- text-embedding-3-small dimensions
  add column embedding_source_hash text,               -- sha256 of (name || description || sku)
  add column embedding_updated_at  timestamptz;

-- HNSW for fast ANN, cosine distance
create index products_embedding_hnsw
  on products using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
```

**Generation.** Done from a Next.js Route Handler — no separate worker:

- On `products` insert/update, a Postgres trigger writes the row id to a small `embedding_queue` table.
- `app/api/embeddings/run/route.ts` is invoked by **Vercel Cron** every 5 minutes. It pulls up to N queued rows, calls OpenAI `text-embedding-3-small` (or whichever provider you configure), updates the row, deletes the queue entry. Idempotent via `embedding_source_hash` so re-runs are cheap.
- Manual "rebuild all embeddings" action available to admins (enqueues every row).

```sql
create table embedding_queue (
  product_id  uuid primary key references products(id) on delete cascade,
  enqueued_at timestamptz not null default now()
);

create or replace function products_enqueue_embedding()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT')
     or (new.name is distinct from old.name)
     or (new.description is distinct from old.description)
     or (new.sku is distinct from old.sku)
  then
    insert into embedding_queue(product_id) values (new.id)
      on conflict (product_id) do update set enqueued_at = now();
  end if;
  return new;
end $$;

create trigger products_enqueue_embedding_trg
after insert or update on products
for each row execute function products_enqueue_embedding();
```

**Hybrid query** inside `search_products` — trigram + vector fused via reciprocal rank fusion in a single CTE (same shape as your `rag-svc`):

```sql
with
q_text as (
  select id,
         row_number() over (order by similarity(name, $1) desc) as rnk
  from products
  where is_archived = false
    and (name % $1 or sku ilike '%'||$1||'%')
  order by similarity(name, $1) desc
  limit 50
),
q_vec as (
  select id,
         row_number() over (order by embedding <=> $2::vector) as rnk
  from products
  where is_archived = false and embedding is not null
  order by embedding <=> $2::vector
  limit 50
)
select p.id, p.sku, p.name, p.measure_type,
       coalesce(1.0/(60 + qt.rnk), 0) + coalesce(1.0/(60 + qv.rnk), 0) as score
from products p
left join q_text qt on qt.id = p.id
left join q_vec  qv on qv.id = p.id
where qt.id is not null or qv.id is not null
order by score desc
limit 10;
```

The `$2` query embedding is computed on the same request that calls the tool — one `text-embedding-3-small` call per `search_products` invocation, ~2-5ms server-side, fractions of a cent. Cached for 5 minutes per query string in a small in-memory LRU on the route handler.

**Cost & scale.** `text-embedding-3-small` is $0.02 per 1M tokens. A 10k-SKU catalog with ~50 tokens of text per product is ~500k tokens — about $0.01 to embed the whole thing once. Re-embedding only happens when name/description/sku changes. HNSW handles 10k–1M rows comfortably on Supabase.

### Open questions

1. **Streaming on Capacitor.** SSE works fine in a Capacitor WebView; if you ever go offline-first, swap to a request/response with a typing-indicator UI.
2. **PII in logs.** Chat messages may contain user-typed product names, no PII expected, but treat `chat_messages` as user data for retention/deletion purposes.

---

## 7. MCP server

The same read-only tool registry the in-app chat uses is also exposed as an **MCP (Model Context Protocol) server** over HTTP. Lets users wire the inventory into Claude Desktop, Claude Code, Cursor, or any MCP-compatible client. No separate process — it's a Vercel Route Handler.

### Transport

[Streamable HTTP](https://modelcontextprotocol.io/docs/concepts/transports#streamable-http) at `POST /api/mcp`. This is the current standard MCP transport for HTTP, replaces the older HTTP+SSE pair, and works fine on Vercel's serverless runtime. No long-lived connections required for the read-only case.

### Authentication

MCP clients authenticate with a **personal access token** (PAT), not the user's session JWT (Claude Desktop has nowhere to put a Supabase login). Tokens are user-scoped, revocable, and inherit the user's role.

```sql
create table mcp_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,                       -- "Claude Desktop laptop", "Claude Code work"
  token_hash    text not null unique,                -- bcrypt or argon2 of the raw token
  prefix        text not null,                       -- first 8 chars of the raw token, for UI display
  last_used_at  timestamptz,
  expires_at    timestamptz,                         -- nullable = never expires
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index mcp_tokens_user_idx on mcp_tokens (user_id) where revoked_at is null;

alter table mcp_tokens enable row level security;
create policy mcp_tokens_rw on mcp_tokens for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid());
```

User flow: `app/(app)/settings/mcp` → "Generate token" → modal shows the raw token **once** with copy button + setup snippet for Claude Desktop. Token format: `inv_pat_<32 random bytes base64url>`. The route handler validates `Authorization: Bearer <token>` by looking up the hash, loads the owner's profile, builds a Supabase client with that user's identity, and runs tools through the same handlers as in-app chat. **RLS is still the security boundary.**

### Tool surface

Same nine tools from section 6, exposed under the MCP `tools/list` and `tools/call` methods. The tool registry is the single source of truth — `lib/chat/tools/*.ts` exports JSON Schema, the in-app chat consumes it as OpenAI/Anthropic tool defs, the MCP server consumes the same exports as MCP tool defs. One registry, two adapters.

```ts
// app/api/mcp/route.ts (sketch)
import { createMcpHandler } from '@/lib/mcp/handler';
import { tools } from '@/lib/chat/tools';

export const POST = createMcpHandler({
  serverInfo: { name: 'inventory', version: '1.0.0' },
  authenticate: async (req) => verifyPatAndLoadProfile(req),  // returns { userId, supabase } or 401
  tools,                                                       // same registry as in-app chat
});
```

The handler implements the MCP JSON-RPC dispatch (`initialize`, `tools/list`, `tools/call`, `ping`) and translates each `tools/call` to the matching tool handler. Errors map to MCP error codes; results are returned as `content: [{ type: 'text', text: JSON.stringify(...) }]`.

### Resources & prompts

Optional v1.1: expose a couple of MCP **resources** so clients can browse — e.g. `inventory://products` (list), `inventory://low-stock` (snapshot). Skip for now; tools cover the use case.

### Audit

Every MCP tool call writes to the existing `chat_tool_calls` table with `source='mcp'` and the `mcp_token_id` set, so admins see chat and MCP usage in one place. Last-used timestamp on the token row is bumped on every call.

### Setup snippet (shown to user when they generate a token)

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "inventory": {
      "transport": {
        "type": "http",
        "url": "https://inventory.yourcompany.com/api/mcp",
        "headers": { "Authorization": "Bearer inv_pat_xxxxxxxx..." }
      }
    }
  }
}
```

For Claude Code: `claude mcp add --transport http inventory https://inventory.yourcompany.com/api/mcp --header "Authorization: Bearer inv_pat_..."`.

### Why this is fine on Vercel

Streamable HTTP is request/response with optional streaming — no WebSockets, no persistent connections. Each `tools/call` is a normal POST that fits comfortably inside Vercel's function execution limits (10s on Hobby, 60s+ on Pro). The agent loop, conversation state, and reasoning all live on the **client** (Claude Desktop, etc.) — your server only answers tool calls.



---

## 8. Key flows

### Admin creates product
- Form fields: SKU, name, measure_type, optional display_unit (filtered to that measure), pack_size (count only), reorder_point/quantity (entered in display_unit, stored in base), `user_can_check_in/out` toggles, barcode(s).
- Validation: unique SKU, display_unit measure_type matches, reorder_point ≥ 0, pack_size > 0 if count + provided.
- Writes: `products` insert + `product_codes` rows + `audit_log` entry.

### User checks out 250 g of "Flour" (display_unit = `kg`)
- User enters `0.25` in `kg` field, or scans then types.
- Server action:
  - Verify `products.user_can_check_out = true`.
  - Convert: `base_quantity = -1 * (0.25 * 1000) = -250` (g).
  - Insert movement with `input_quantity=0.25`, `input_unit='kg'`, `base_quantity=-250`.
  - If new on-hand ≤ `reorder_point`, enqueue low-stock notification (debounced per product per 24h).

### Lot/expiration
- On check-in, user can pick existing lot (filtered to product, non-archived) or create one inline (`lot_code`, `expires_on`).
- Check-out from a specific lot is supported but optional **unless** `preferences.require_lot_per_movement = true`, in which case every check-in, check-out, and adjustment must reference a lot. `void` movements are exempt (they reference the original).
- When required-lot mode is on, the check-out UI defaults to FEFO (first-expiring lot with stock); user can override.
- Dashboard shows lots expiring within N days (default 30, in preferences).

### CSV import
- Admin uploads `products.csv` to a signed Storage URL.
- Edge Function parses (header: `sku,name,measure_type,display_unit,pack_size,reorder_point,reorder_unit,user_can_check_in,user_can_check_out,barcodes`).
- For each row: upsert by SKU, validate units, convert reorder_point to base, write barcodes (semicolon-separated).
- Returns a result file with `row, status, error` for any failures.

### CSV export
- `products.csv`: catalog snapshot.
- `stock.csv`: `sku,name,base_on_hand,display_on_hand,display_unit,low_stock` from `product_stock` joined with `products`.
- `movements.csv`: full ledger with date range filter.

---

## 9. Audit & immutability

- **Movements are append-only.** Mistakes are corrected by inserting a `void` movement that references the original (`voids_movement`), plus optionally a corrective `adjustment`. Stock views ignore `void` rows.
- **Catalog changes** (`products`, `preferences`, `units`, `profiles.role`) write to `audit_log` via server action (cleaner than DB triggers for jsonb diffs from app context).
- Users see their own actions; admins see everything.

---

## 10. Notifications & alerts

- Daily Edge Function cron at 08:00 ET:
  - Find products with `is_low_stock = true` → email admins (Supabase + Resend).
  - Find lots expiring in ≤ 30 days → same email.
- In-app banner on dashboard, no separate notification center in v1.

---

## 11. Security notes

- RLS is the source of truth; server actions are a usability layer, not security.
- `is_admin()` is `stable`, not `security definer`, so role checks are honest and can't be spoofed via search_path.
- Service role key only used in Edge Functions, never in Next.js runtime.
- MCP tokens are stored hashed; the raw token is shown to the user exactly once at generation time. Tokens inherit the owner's role; revocation is immediate (route handler reads `revoked_at` on every request — no caching of token validity).
- Capacitor build uses HTTPS scheme, server URL pinned to production, deep links signed.

---

## 12. Open questions / deferred decisions

1. **Negative stock:** allow check-out beyond on-hand? Default v1: **block** (server action rejects if resulting `base_on_hand < 0`). Easy to relax later.
2. **Decimal precision:** `numeric(20,4)` for base quantity gives 0.1 mg / 0.1 µl resolution. Increase scale if you need finer.
3. **Custom units:** v1 ships SI + US imperial seeds. Adding a `units` row is admin-only. Currency-style symbols not supported.
4. **Per-user transaction quotas:** not in v1.
5. **Offline scanning:** not in v1. Requires queue + sync. Capacitor app requires connectivity.
6. **Photo attachments to movements:** out of v1.

---

## 13. Rollout sequence

1. Schema + RLS + seed `units` + `preferences` row.
2. Auth + profiles + admin bootstrap script.
3. Catalog CRUD (admin) + product detail page.
4. Movements (web) with conversion engine + stock views.
5. Audit log writer + viewer.
6. CSV export → CSV import.
7. Capacitor shell + scan resolve endpoint + scan → transact flow.
8. Lot tracking + expiration UI.
9. Low-stock + expiration cron.
10. Chat assistant: provider abstraction, tool registry, `/api/chat` route, conversation UI.
11. Embeddings: pgvector extension, `embedding_queue`, Vercel Cron worker, hybrid `search_products`.
12. MCP server: `/api/mcp` Streamable HTTP handler, PAT management UI, audit hookup.
13. Polish: search, filters, dashboard.

-- Add embedding columns to products
alter table products
  add column if not exists embedding vector(1536),
  add column if not exists embedding_source_hash text,
  add column if not exists embedding_updated_at timestamptz;

-- HNSW index for cosine similarity search
create index if not exists products_embedding_hnsw
  on products using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Queue table for async embedding generation
create table embedding_queue (
  product_id  uuid primary key references products(id) on delete cascade,
  queued_at   timestamptz not null default now()
);

-- Auto-enqueue on product insert or name/description/sku change
create or replace function products_enqueue_embedding()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') or
     (TG_OP = 'UPDATE' and (
       new.name is distinct from old.name or
       new.sku is distinct from old.sku or
       new.description is distinct from old.description
     ))
  then
    insert into embedding_queue (product_id) values (new.id)
    on conflict (product_id) do update set queued_at = now();
  end if;
  return new;
end $$;

create trigger products_embedding_enqueue
after insert or update on products
for each row execute function products_enqueue_embedding();

-- Hybrid search function: trigram + vector cosine via reciprocal rank fusion
create or replace function search_products_hybrid(
  query_text  text,
  query_vec   vector(1536),
  result_limit int default 10
)
returns table (
  id           uuid,
  sku          text,
  name         text,
  measure_type text,
  display_unit text,
  is_archived  boolean,
  rrf_score    double precision
)
language sql stable as $$
  with trigram_ranked as (
    select p.id,
           row_number() over (order by similarity(p.name || ' ' || coalesce(p.sku,'') || ' ' || coalesce(p.description,''), query_text) desc) as rank
    from products p
    where (p.name || ' ' || coalesce(p.sku,'') || ' ' || coalesce(p.description,'')) % query_text
       or p.name ilike '%' || query_text || '%'
       or p.sku ilike '%' || query_text || '%'
    limit 40
  ),
  vector_ranked as (
    select p.id,
           row_number() over (order by p.embedding <=> query_vec) as rank
    from products p
    where p.embedding is not null
    order by p.embedding <=> query_vec
    limit 40
  ),
  rrf as (
    select
      coalesce(t.id, v.id) as id,
      coalesce(1.0 / (60 + coalesce(t.rank, 1000)), 0) +
      coalesce(1.0 / (60 + coalesce(v.rank, 1000)), 0) as score
    from trigram_ranked t
    full outer join vector_ranked v on t.id = v.id
  )
  select p.id, p.sku, p.name, p.measure_type, p.display_unit, p.is_archived,
         r.score as rrf_score
  from rrf r
  join products p on p.id = r.id
  order by r.score desc
  limit result_limit;
$$;

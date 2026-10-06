-- ====================================================================
-- Phase 4: Advisory Queries Log & Feedback Schema
-- Architecture_Advisory.md §13, §14
-- ====================================================================

create table if not exists advisory_queries (
  id                  bigserial primary key,
  farmer_id           uuid references farmer_profile(id) on delete set null,
  farm_id             bigint references farms(id) on delete set null,
  user_query          text not null,
  context_snapshot    jsonb not null,          -- the AdvisoryContext actually used — for debugging/audit
  response_text       text not null,
  retrieved_chunk_ids bigint[] not null default '{}',
  confidence          text not null check (confidence in ('grounded', 'partial', 'insufficient')),
  feedback            smallint check (feedback in (-1, 1)), -- null = no feedback yet, 1 = up, -1 = down
  created_at          timestamptz not null default now()
);

create index if not exists idx_advisory_queries_farmer on advisory_queries (farmer_id);
create index if not exists idx_advisory_queries_farm on advisory_queries (farm_id);
create index if not exists idx_advisory_queries_confidence on advisory_queries (confidence);
create index if not exists idx_advisory_queries_created on advisory_queries (created_at desc);

-- Access grants
grant select, insert, update on advisory_queries to anon, authenticated, service_role;
grant usage, select on sequence advisory_queries_id_seq to anon, authenticated, service_role;

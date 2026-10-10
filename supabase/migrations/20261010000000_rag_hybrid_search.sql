-- ====================================================================
-- Hybrid RAG search: Postgres full-text search alongside pgvector.
-- Used by app/data/advisory/rag_repo.py (_match_supabase), which fuses
-- this ranking with match_rag_chunks via Reciprocal Rank Fusion (k=60).
-- Safe to re-run.
-- ====================================================================

-- Generated tsvector column + GIN index so the lexical ranking stays fast.
alter table rag_chunks
  add column if not exists chunk_tsv tsvector
  generated always as (to_tsvector('english', coalesce(chunk_text, ''))) stored;

create index if not exists rag_chunks_tsv_idx on rag_chunks using gin (chunk_tsv);

create or replace function search_rag_chunks_fts(
  query_text text,
  match_crop text,
  match_doc_types text[],
  match_count int default 24
)
returns table (
  chunk_text text,
  document_id bigint,
  page_number int,
  crop text,
  doc_type text,
  rank real
)
language sql stable as $$
  with q as (
    -- OR the query words together: websearch_to_tsquery would AND them, which
    -- returns nothing for natural-language farmer questions.
    select to_tsquery('english',
             array_to_string(
               array(select lexeme from unnest(to_tsvector('english', query_text))), ' | ')
           ) as tsq
  )
  select c.chunk_text, c.document_id, c.page_number, c.crop, c.doc_type,
         ts_rank_cd(c.chunk_tsv, q.tsq) as rank
  from rag_chunks c, q
  where q.tsq is not null
    and c.chunk_tsv @@ q.tsq
    and (match_crop is null or c.crop = match_crop or c.crop is null)
    and (match_doc_types is null or c.doc_type = any(match_doc_types))
  order by rank desc
  limit match_count;
$$;

grant execute on function search_rag_chunks_fts to anon, authenticated, service_role;

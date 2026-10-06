-- ====================================================================
-- Phase 3: RAG Knowledge Pipeline Schema (Vector Search)
-- Architecture_Advisory.md §10.1
-- ====================================================================

-- 1. Ensure pgvector extension is enabled
create extension if not exists vector;

-- 2. RAG Documents metadata table
create table if not exists rag_documents (
  id            bigserial primary key,
  title         text not null,
  doc_type      text not null check (doc_type in ('agronomy_pop','disease_treatment','govt_scheme')),
  crop          text,                       -- null for crop-agnostic docs (e.g. government scheme)
  state         text,                       -- null for national-level docs (e.g. ICAR Kharif Guide)
  source_url    text not null,
  license_note  text not null,              -- Provenance & reuse verification
  ingested_at   timestamptz not null default now(),
  version_tag   text                        -- e.g. 'ICAR-Kharif-2025', 'PAU-PoP-2024'
);

create index if not exists idx_rag_documents_crop on rag_documents (crop);
create index if not exists idx_rag_documents_doc_type on rag_documents (doc_type);

-- 3. RAG Chunks with 768-dimensional embeddings (gemini-embedding-001 Matryoshka)
create table if not exists rag_chunks (
  id            bigserial primary key,
  document_id   bigint not null references rag_documents(id) on delete cascade,
  crop          text,                        -- denormalized for fast filtering
  doc_type      text not null,
  chunk_text    text not null,
  chunk_index   integer not null,
  page_number   integer,                     -- for citation display back to the farmer
  embedding     vector(768) not null
);

create index if not exists rag_chunks_embedding_idx on rag_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists rag_chunks_crop_idx on rag_chunks (crop, doc_type);

-- 4. Cosine similarity match RPC function
create or replace function match_rag_chunks(
  query_embedding vector(768), 
  match_crop text, 
  match_doc_types text[], 
  match_count int default 6
)
returns table (
  chunk_text text, 
  document_id bigint, 
  page_number int, 
  similarity float
)
language sql stable as $$
  select 
    chunk_text, 
    document_id, 
    page_number, 
    1 - (embedding <=> query_embedding) as similarity
  from rag_chunks
  where (match_crop is null or crop = match_crop or crop is null)
    and (match_doc_types is null or doc_type = any(match_doc_types))
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Access grants
grant select on rag_documents to anon, authenticated, service_role;
grant select on rag_chunks to anon, authenticated, service_role;
grant all on rag_documents to service_role;
grant all on rag_chunks to service_role;
grant execute on function match_rag_chunks to anon, authenticated, service_role;

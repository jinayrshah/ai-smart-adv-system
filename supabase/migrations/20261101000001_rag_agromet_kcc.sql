-- New knowledge sources: IMD district agromet bulletins and Kisan Call Centre Q&A.
alter table public.rag_documents drop constraint if exists rag_documents_doc_type_check;
alter table public.rag_documents add constraint rag_documents_doc_type_check
  check (doc_type in ('agronomy_pop','disease_treatment','govt_scheme','agromet_advisory','kcc_qa'));
alter table public.rag_documents add column if not exists district text;
alter table public.rag_documents add column if not exists published_on date;
create index if not exists idx_rag_documents_district on public.rag_documents (doc_type, district, published_on desc);

-- Passages may be stored before an embedding is available (keyword search still finds them;
-- vector search skips rows with no embedding).
alter table public.rag_chunks alter column embedding drop not null;

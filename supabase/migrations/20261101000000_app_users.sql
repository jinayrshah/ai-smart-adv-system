-- Login accounts for the Express auth layer (server.ts). Previously a JSON file, which on
-- Vercel lived in /tmp and was wiped on cold starts, orphaning each farmer's saved farm.
create table if not exists public.app_users (
  identifier text primary key,          -- +91 mobile or email, as typed at sign-up
  id uuid not null unique,              -- the farmer_id used by /api/farmer/*
  data jsonb not null,                  -- the user record incl. bcrypt password hash
  updated_at timestamptz not null default now()
);

-- Only the server (service role) reads or writes accounts.
alter table public.app_users enable row level security;

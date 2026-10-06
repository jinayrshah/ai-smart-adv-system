-- Migration: 20261006000000_advisory_phase1.sql
-- Description: Farmer Profile & Onboarding Schema (Architecture_Advisory.md §6)

create table if not exists farmer_profile (
  id                 uuid primary key,
  full_name          text,
  preferred_language text not null default 'en',
  phone              text,
  created_at         timestamptz not null default now()
);

create table if not exists farms (
  id              bigserial primary key,
  farmer_id       uuid not null references farmer_profile(id) on delete cascade,
  name            text not null default 'My farm',
  lat             numeric(8,5) not null,
  lon             numeric(8,5) not null,
  grid_key        text not null,
  state           text not null,
  district        text not null,
  soil_type       text,
  soil_source     text not null default 'farmer_input'
                   check (soil_source in ('farmer_input','soil_health_card','district_default','soilgrids')),
  soil_npk        jsonb,
  irrigation_type text check (irrigation_type in ('borewell','canal','rainfed','drip','sprinkler','other')),
  field_size_acres numeric(6,2),
  created_at      timestamptz not null default now()
);

create table if not exists farm_crops (
  id           bigserial primary key,
  farm_id      bigint not null references farms(id) on delete cascade,
  crop         text not null,
  variety      text,
  sowing_date  date not null,
  season       text,
  status       text not null default 'active' check (status in ('active','harvested','failed')),
  unique (farm_id, crop, sowing_date)
);

create index if not exists farm_crops_active_idx on farm_crops (farm_id) where status = 'active';
create index if not exists farms_farmer_idx on farms (farmer_id);

-- Enable RLS
alter table farmer_profile enable row level security;
alter table farms          enable row level security;
alter table farm_crops     enable row level security;

-- Policies for farmer_profile
drop policy if exists "Users can view own profile" on farmer_profile;
create policy "Users can view own profile" on farmer_profile
  for select using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on farmer_profile;
create policy "Users can insert own profile" on farmer_profile
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on farmer_profile;
create policy "Users can update own profile" on farmer_profile
  for update using (auth.uid() = id);

-- Policies for farms
drop policy if exists "Users can view own farms" on farms;
create policy "Users can view own farms" on farms
  for select using (auth.uid() = farmer_id);

drop policy if exists "Users can insert own farms" on farms;
create policy "Users can insert own farms" on farms
  for insert with check (auth.uid() = farmer_id);

drop policy if exists "Users can update own farms" on farms;
create policy "Users can update own farms" on farms
  for update using (auth.uid() = farmer_id);

drop policy if exists "Users can delete own farms" on farms;
create policy "Users can delete own farms" on farms
  for delete using (auth.uid() = farmer_id);

-- Policies for farm_crops
drop policy if exists "Users can view own farm crops" on farm_crops;
create policy "Users can view own farm crops" on farm_crops
  for select using (
    exists (
      select 1 from farms
      where farms.id = farm_crops.farm_id
      and farms.farmer_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own farm crops" on farm_crops;
create policy "Users can insert own farm crops" on farm_crops
  for insert with check (
    exists (
      select 1 from farms
      where farms.id = farm_crops.farm_id
      and farms.farmer_id = auth.uid()
    )
  );

drop policy if exists "Users can update own farm crops" on farm_crops;
create policy "Users can update own farm crops" on farm_crops
  for update using (
    exists (
      select 1 from farms
      where farms.id = farm_crops.farm_id
      and farms.farmer_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own farm crops" on farm_crops;
create policy "Users can delete own farm crops" on farm_crops
  for delete using (
    exists (
      select 1 from farms
      where farms.id = farm_crops.farm_id
      and farms.farmer_id = auth.uid()
    )
  );

-- Grants for service_role
grant all on farmer_profile to service_role;
grant all on farms to service_role;
grant all on farm_crops to service_role;

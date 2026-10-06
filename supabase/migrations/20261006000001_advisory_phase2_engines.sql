-- ====================================================================
-- Phase 2: Agronomy Reference Tables (GDD, Kc, Soil & Climate)
-- Architecture_Advisory.md §7, §8, §9, §9b
-- ====================================================================

-- 1. Growth Stage Norms (Thermal Time & GDD)
create table if not exists crop_stage_norms (
  crop                        text not null,
  stage_order                 smallint not null,
  stage_name                  text not null,
  gdd_base_c                  numeric(4,1) not null,
  gdd_cumulative_at_stage_end numeric(6,1) not null,
  typical_days_fallback       smallint,
  source                      text not null,
  created_at                  timestamptz not null default now(),
  primary key (crop, stage_order)
);

create index if not exists idx_crop_stage_norms_crop on crop_stage_norms (crop);

-- 2. Crop Coefficient Reference (FAO-56 Kc values)
create table if not exists crop_kc_reference (
  crop        text not null,
  stage_name  text not null,
  kc          numeric(3,2) not null,
  source      text not null default 'FAO-56 Table 12',
  created_at  timestamptz not null default now(),
  primary key (crop, stage_name)
);

create index if not exists idx_crop_kc_crop on crop_kc_reference (crop);

-- 3. Soil Suitability Reference
create table if not exists crop_soil_suitability (
  crop             text not null primary key,
  ideal_soil_types text[] not null,
  ideal_ph_min     numeric(3,1) not null,
  ideal_ph_max     numeric(3,1) not null,
  notes            text,
  source           text not null,
  created_at       timestamptz not null default now()
);

-- 4. Climate Suitability Reference
create table if not exists crop_climate_suitability (
  crop                   text not null,
  stage_name             text not null default '',
  ideal_temp_min_c       numeric(4,1) not null,
  ideal_temp_max_c       numeric(4,1) not null,
  ideal_humidity_min_pct numeric(4,1),
  ideal_humidity_max_pct numeric(4,1),
  notes                  text,
  source                 text not null,
  created_at             timestamptz not null default now(),
  primary key (crop, stage_name)
);

create index if not exists idx_crop_climate_crop on crop_climate_suitability (crop);

-- Grant select to anon and authenticated (reference datasets are public)
grant select on crop_stage_norms to anon, authenticated, service_role;
grant select on crop_kc_reference to anon, authenticated, service_role;
grant select on crop_soil_suitability to anon, authenticated, service_role;
grant select on crop_climate_suitability to anon, authenticated, service_role;

-- Allow full modifications to service_role (for data seeding & maintenance)
grant all on crop_stage_norms to service_role;
grant all on crop_kc_reference to service_role;
grant all on crop_soil_suitability to service_role;
grant all on crop_climate_suitability to service_role;

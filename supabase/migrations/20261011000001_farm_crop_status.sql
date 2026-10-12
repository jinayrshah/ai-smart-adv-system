-- Daily snapshot written by jobs/recompute_growth_stages.py (Architecture_Advisory §19):
-- growth stage + FAO-56 water-balance status per active crop, so dashboards can read
-- one row instead of recomputing the engines on every page load.
create table if not exists farm_crop_status (
  crop_id                bigint primary key references farm_crops(id) on delete cascade,
  farm_id                bigint not null references farms(id) on delete cascade,
  crop                   text not null,
  sowing_date            date not null,
  accumulated_gdd        numeric(7,1),
  stage_name             text not null,
  stage_order            int not null,
  stage_progress_pct     numeric(5,1),
  days_since_sowing      int not null,
  estimation_method      text not null check (estimation_method in ('gdd','calendar_fallback')),
  weather_coverage_pct   numeric(5,1),
  next_stage_name        text,
  gdd_remaining_in_stage numeric(7,1),
  water_method           text,
  water_action           text,
  water_deficit_7d_mm    numeric(6,1),
  root_zone_depletion_mm numeric(6,1),
  raw_mm                 numeric(6,1),
  days_to_stress         int,
  kc                     numeric(4,2),
  water_confidence       text,
  soil_flags_count       int not null default 0,
  recomputed_at          timestamptz not null default now()
);

create index if not exists farm_crop_status_farm_idx on farm_crop_status (farm_id);

alter table farm_crop_status enable row level security;

drop policy if exists "Users can view own crop status" on farm_crop_status;
create policy "Users can view own crop status" on farm_crop_status
  for select using (
    exists (select 1 from farms where farms.id = farm_crop_status.farm_id and farms.farmer_id = auth.uid())
  );

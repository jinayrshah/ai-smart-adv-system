-- Migration: 20261002000000_data_layer.sql
-- Description: Mandi Price + Weather Data Layer schema (Architecture §5)
-- Tables, indexes, view, priority-aware upsert RPC, and RLS policies

-- Ensure pgvector is active
create extension if not exists vector;

-- ========== MANDI ==========
create table if not exists mandi_prices (
  id              bigserial primary key,
  state           text not null,
  district        text not null default '',
  market          text not null,
  commodity       text not null,
  variety         text not null default '',
  grade           text not null default '',
  arrival_date    date not null,
  min_price       numeric(10,2),
  max_price       numeric(10,2),
  modal_price     numeric(10,2),
  arrivals_tonnes numeric(12,3),
  unit            text not null default 'Rs/Quintal',
  source          text not null check (source in ('datagov_live','agmarknet_pkg','ceda','kaggle_seed')),
  source_priority smallint not null,   -- datagov_live=100, agmarknet_pkg=80, ceda=50, kaggle_seed=10
  quality_flag    text not null default 'ok'
                   check (quality_flag in ('ok','nonpositive','order_violation','missing_price','outlier')),
  fetched_at      timestamptz not null default now(),
  constraint mandi_prices_uniq
    unique (state, district, market, commodity, variety, grade, arrival_date)
);

create index if not exists mandi_prices_trend_idx on mandi_prices (commodity, market, arrival_date desc);
create index if not exists mandi_prices_state_idx on mandi_prices (state, commodity, arrival_date desc);

-- View: daily price aggregation across varieties
create or replace view v_mandi_daily as
select commodity, state, district, market, arrival_date,
       percentile_cont(0.5) within group (order by modal_price) as modal_price,
       min(min_price) as min_price,
       max(max_price) as max_price,
       count(*)       as n_varieties,
       max(source_priority) as best_priority
from mandi_prices
where quality_flag = 'ok'
group by commodity, state, district, market, arrival_date;

-- Priority-aware upsert RPC. Called by backend with JSON array of records.
-- Caller MUST de-duplicate keys inside batch prior to RPC invocation.
create or replace function upsert_mandi_prices(rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  with incoming as (
    select * from jsonb_to_recordset(rows) as r(
      state text, district text, market text, commodity text, variety text, grade text,
      arrival_date date, min_price numeric, max_price numeric, modal_price numeric,
      arrivals_tonnes numeric, unit text, source text, source_priority smallint, quality_flag text)
  )
  insert into mandi_prices as m
    (state, district, market, commodity, variety, grade, arrival_date, min_price, max_price,
     modal_price, arrivals_tonnes, unit, source, source_priority, quality_flag, fetched_at)
  select state, coalesce(district,''), market, commodity, coalesce(variety,''), coalesce(grade,''),
         arrival_date, min_price, max_price, modal_price, arrivals_tonnes,
         coalesce(unit,'Rs/Quintal'), source, source_priority, coalesce(quality_flag,'ok'), now()
  from incoming
  on conflict on constraint mandi_prices_uniq
  do update set min_price = excluded.min_price, max_price = excluded.max_price,
                modal_price = excluded.modal_price, arrivals_tonnes = excluded.arrivals_tonnes,
                source = excluded.source, source_priority = excluded.source_priority,
                quality_flag = excluded.quality_flag, fetched_at = now()
  where excluded.source_priority >= m.source_priority;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function upsert_mandi_prices(jsonb) from public, anon, authenticated;
grant execute on function upsert_mandi_prices(jsonb) to service_role;

-- ========== TIER B: MANDI WATCH LIST ==========
create table if not exists mandi_watch (
  id                 bigserial primary key,
  state              text not null,
  district           text not null default '',
  market             text not null default '',
  commodity          text not null,
  first_requested_at timestamptz not null default now(),
  last_requested_at  timestamptz not null default now(),
  request_count      integer not null default 1,
  tracked            boolean not null default true,
  unique (state, district, market, commodity)
);

create index if not exists mandi_watch_tracked_idx on mandi_watch (tracked, last_requested_at desc);

-- ========== LOCATIONS ==========
create table if not exists locations (
  id             bigserial primary key,
  kind           text not null check (kind in ('mandi','district','farm','custom')),
  name           text not null,
  state          text not null,
  district       text not null default '',
  lat            numeric(8,5) not null,
  lon            numeric(8,5) not null,
  grid_key       text not null,
  geocode_source text,
  verified       boolean not null default false,
  tracked        boolean not null default true,
  unique (kind, name, state, district)
);

create index if not exists locations_grid_idx on locations (grid_key);

-- ========== WEATHER ==========
create table if not exists weather_daily (
  grid_key          text not null,
  date              date not null,
  source            text not null check (source in ('open_meteo','openweather','nasa_power')),
  kind              text not null check (kind in ('forecast','recent','archive')),
  tmax_c            real,
  tmin_c            real,
  tmean_c           real,
  precip_mm         real,
  precip_prob_pct   real,
  rh_mean_pct       real,
  wind_max_kmh      real,
  radiation_mj_m2   real,
  et0_mm            real,
  soil_moisture_top real,
  spread_tmax_c     real,
  spread_precip_mm  real,
  models_rain_frac  real,
  fetched_at        timestamptz not null default now(),
  primary key (grid_key, date, source, kind)
);

create index if not exists weather_daily_date_idx on weather_daily (date);

create table if not exists weather_daily_fused (
  grid_key        text not null,
  date            date not null,
  phase           text not null check (phase in ('past','today','future')),
  tmax_c          real,
  tmin_c          real,
  precip_mm       real,
  precip_prob_pct real,
  rh_mean_pct     real,
  radiation_mj_m2 real,
  et0_mm          real,
  primary_source  text not null,
  validators      text[] not null default '{}',
  confidence      text not null check (confidence in ('high','medium','low')),
  degraded        boolean not null default false,
  disagreement    jsonb,
  updated_at      timestamptz not null default now(),
  primary key (grid_key, date)
);

create table if not exists weather_current (
  grid_key        text primary key,
  observed_at     timestamptz not null,
  temp_c          real,
  rh_pct          real,
  wind_kmh        real,
  precip_mm_1h    real,
  weather_code    int,
  source          text not null,
  confidence      text not null check (confidence in ('high','medium','low')),
  cross_check     jsonb,
  updated_at      timestamptz not null default now()
);

create table if not exists weather_normals_monthly (
  grid_key          text not null,
  month             smallint not null check (month between 1 and 12),
  tmax_c            real,
  tmin_c            real,
  precip_mm_month   real,
  source            text not null,
  period            text not null,
  primary key (grid_key, month)
);

-- ========== OPS ==========
create table if not exists ingestion_runs (
  id            bigserial primary key,
  job           text not null,
  source        text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running' check (status in ('running','ok','partial','failed')),
  rows_in       integer,
  rows_upserted integer,
  rows_flagged  integer,
  notes         jsonb
);

-- ========== SECURITY (RLS) ==========
alter table mandi_prices             enable row level security;
alter table mandi_watch              enable row level security;
alter table locations                enable row level security;
alter table weather_daily            enable row level security;
alter table weather_daily_fused      enable row level security;
alter table weather_current          enable row level security;
alter table weather_normals_monthly  enable row level security;
alter table ingestion_runs           enable row level security;

-- Grants for service_role
grant all on mandi_prices to service_role;
grant all on mandi_watch to service_role;
grant all on locations to service_role;
grant all on weather_daily to service_role;
grant all on weather_daily_fused to service_role;
grant all on weather_current to service_role;
grant all on weather_normals_monthly to service_role;
grant all on ingestion_runs to service_role;
grant all on v_mandi_daily to service_role;

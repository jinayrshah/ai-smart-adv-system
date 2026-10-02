# Architecture — Mandi Price + Weather Data Layer

**Project:** Smart Crop Advisory System (SIH25010 origin, solo rebuild)
**Stack:** Next.js (Vercel) · FastAPI · Supabase Postgres · GitHub (`main` / `dev` / `feature*` / `fix*`)
**Version:** v2 · 2026-09-28
**Audience:** Antigravity IDE agent (primary), Jinay (reviewer)
**Status:** SOURCE OF TRUTH for design. `Implementationplan_MarketData_Weather.md` is the task runbook and defers to this file on any conflict.

Put both files in the repo under `docs/data-layer/`.

---

## 0. Operating rules for Antigravity (read first)

1. Read both files completely before writing code.
2. **Phase 0 is reconnaissance, not coding.** Inspect the existing repo and write `docs/data-layer/recon.md` mapping what already exists → the target design below. Do **not** rewrite or duplicate working code (the current data.gov.in fetcher, the OpenWeatherMap service, the market-analysis route/UI). Wrap or extend it.
3. Paths in §7 are **logical**. Map them onto the real repo structure; keep the module boundaries.
4. **Free only.** No paid API, no paid plan upgrades, no new paid services.
5. **Never invent** endpoints, parameters, or response fields. Use only what this document lists. If a real response differs from what is described here, adapt inside the adapter layer, log a WARNING, and record the difference in `recon.md`.
6. Secrets only via environment variables. Commit `.env.example`, never `.env`.
7. Git: branch from `dev` as `feature/data-layer-phase-N`, one PR per phase into `dev`. Never commit to `main`.
8. Ask the user **only** the questions in §17, once, at the end of Phase 0. Persist the answers in `config/tracked_scope.yaml`. Everything else has a default in this document — use it.
9. **No fake data, ever.** No synthetic history, no silent interpolation, no silent averaging of sources. Every value served to the UI carries its source; every weather value also carries a confidence level. (The project deliberately removed its dummy data — keep it that way.)
10. Do not start the next phase until the user says `go phase N`.

---

## 1. Goals, non-goals, constraints

**Goals**
- G1. Real price history for trend charts from day one (7–90 days), then automatic daily accumulation.
- G2. Weather for advisory + UI: current, 7-day forecast, last 30 days of actuals, each with honest confidence.
- G3. Everything stays fresh automatically at $0.
- G4. Any single provider failing must never break the app (degrade, don't crash).
- G5. **Any crop, any market, anywhere in India** — a farmer can look up current price/weather for something outside the 6 advisory crops without leaving the app. This is a **second, lighter tier** (§2.1) — it does not mean pre-loading full history for all of India.

**Non-goals**
- No ML price prediction.
- No permanently-stored full history for every crop/market in India (G5 is a live/cached lookup, not a data warehouse — see §2.1 for why, and the storage math in §13).
- No hyper-local per-farm weather in this phase (design stays extensible: a new source = one adapter + one priority row).
- No HTML scraping unless every other path for a needed window has failed.

**Constraints**

| Constraint | Consequence for the design |
|---|---|
| $0 budget | Only free tiers / open data. |
| Supabase Free: 500 MB DB, project pauses after 7 days idle | Scope-filter ingestion (tracked crops × tracked states); retention jobs; the daily ingest job doubles as keep-alive. |
| Vercel Hobby cron: once/day max, fires anywhere inside the scheduled hour, UTC only | Do **not** use Vercel Cron for ingestion. Use GitHub Actions cron. |
| FastAPI host may be serverless (Vercel) or a normal server (unknown until recon) | API is a **stateless read path**. No in-process schedulers, no in-memory state that must survive. |
| Solo developer, low ops | Few moving parts, idempotent jobs, one health endpoint. |

---

## 2. System context

```
              SCHEDULER: GitHub Actions cron (+ manual dispatch)
   ingest_mandi_daily · ingest_weather · reconcile_recent · power_validate · backfill_mandi(manual)
                              │  python -m jobs.<name>   (same code as the API, imported)
   MANDI SOURCES              ▼                                 ▼               WEATHER SOURCES
 data.gov.in (live) ─┐   ┌───────────────────┐       ┌────────────────────┐   ┌─ Open-Meteo   (PRIMARY)
 agmarknet pkg ──────┼──►│ mandi adapters    │       │ weather adapters   │◄──┼─ NASA POWER   (validator)
 CEDA API / CSV ─────┤   │ canonicalize      │       │ grid snap + batch  │   └─ OpenWeather  (validator)
 Kaggle CSV ─────────┘   │ validate          │       │ route by horizon   │
                         │ reconcile(priority)│      │ fuse + confidence  │
                         └─────────┬─────────┘       └─────────┬──────────┘
                                   ▼                           ▼
                  ┌─────────────────── Supabase Postgres ───────────────────┐
                  │ mandi_prices ─► v_mandi_daily │ weather_daily ─► weather_daily_fused │
                  │ weather_current · weather_normals_monthly · locations · ingestion_runs │
                  └────────────────────────────┬────────────────────────────┘
                                               │ (service role, server-side only)
                     FastAPI (stateless) ── /api/market/*  /api/weather/*  /api/context/*  /api/health/data
                                               │
                                   Next.js UI  +  Advisory (RAG) service
```

**Design principles**
- **P1. Ingest writes, API reads.** Providers are called by scheduled jobs (and a tightly limited on-demand path), never on every user request. Fast, cheap, serverless-safe.
- **P2. Provenance everywhere.** Every row/point states its source; weather adds confidence.
- **P3. One primary + validators — not averaging.** Averaging two biased sources does not produce truth. Pick the best source per situation, use the others to *detect disagreement*, and lower confidence when they disagree.
- **P4. Idempotent everything.** Any job can be re-run any time; the result is the same.
- **P5. Degrade gracefully.** Fresh → stale-but-served (flagged) → clear error only if there has never been data.
- **P6. Free-tier budget is a design input.** Storage, call counts, and schedules are sized for it (§12, §13).

### 2.1 Two coverage tiers — why one design serves both

The request "any crop, anywhere in India" and the request "deep advisory for 6 crops" have different answers to *how much do we store, forever, for every single one*. Pre-ingesting full history for all ~300 commodities × ~4,000+ mandis would run **1.4M+ rows just for a 90-day window** (§13) — on the Supabase Free 500 MB cap, that alone is the whole budget with nothing left for weather or the advisory tier. So this is **one system with two tiers**, not two systems:

| | **Tier A — Advisory** | **Tier B — Explore** |
|---|---|---|
| Scope | The 6 deep-advisory crops × tracked states/markets (`config/tracked_scope.yaml`) | Any crop, any state/market/location in India |
| Mandi data | Pre-ingested daily + backfilled 90 days (§8.1–8.4) | **Live pass-through** to the same data.gov.in feed on request, no pre-filtering, plus an opportunistic **watch list** (§9.5) that "graduates" a searched crop/market into daily tracking |
| Weather data | Scheduled, multi-source **fused** (Open-Meteo + NASA POWER + OpenWeather), full confidence scoring (§4.2) | Live single-source **Open-Meteo** fetch on first request (§9.4), confidence capped at `medium` until it graduates into scheduled tracking |
| History depth | 90 days now, deepened via CEDA over time, then indefinite | "Today" always; a rolling recent window builds up automatically **only for what's actually been searched** |
| Retention | Long / indefinite | Bounded — capped watch list + short retention on anything not re-searched (§13) |
| Storage growth | Small and predictable (a handful of crops × markets) | Grows only with **real usage**, not with all of India's combinatorics |

**The mechanism is the same table, the same schema, the same jobs** — Tier B does not duplicate the pipeline. A Tier B crop/market that gets searched repeatedly simply becomes indistinguishable from a Tier A one (same `mandi_prices` rows, same trend API), except it isn't in the curated 90-day backfill and its retention is shorter unless it earns a permanent spot. This is the same pattern the weather side already uses for untracked coordinates (§9.4) — Tier B generalizes it, and applies the equivalent idea to mandi prices (§9.5).

**What this buys:** the farmer never has to leave the app for a price or a weather check, without you ever paying for storage, and without a second codebase to maintain.

**What this doesn't buy (yet):** deep multi-year trend charts for every crop in India, for free, on day one. That's a real scale-up (paid DB tier, or a much smarter selective backfill) — Phase 6/7 territory, not something to pretend is solved here.

---

## 3. Source catalogue and verdicts

### 3.1 Mandi prices

| Source | Role | Coverage / latency | Access | Priority | Notes |
|---|---|---|---|---|---|
| **data.gov.in — Agmarknet daily feed** (resource `9ef84268-d588-465a-a308-a864a43d0070`) | **Live / today** | Current-day feed; fills through the IST day (pull after ~14:00 IST). Full feed ≈ 16,000 rows/day. Historical-date queries are **unreliable** (reports conflict — one project says it serves only the current day, another queries past dates). Do not depend on it for history. | REST + **personal** API key (free). The public demo key caps responses at 10 records/request. | 100 | Already integrated — reuse the existing fetcher. |
| **`agmarknet` PyPI package** (unofficial, MIT, pin `0.2.2`) | **Recent-window backfill (0–60 days)** and gap fill | Queries the Agmarknet report backend directly (current data), returns pandas DataFrames, resolves names to IDs, chunks long ranges | `pip install agmarknet==0.2.2` | 80 | Brand new (first released July 2026) → wrap defensively; fallback in §8.2. |
| **CEDA Agri-Market Data** (Ashoka University) | **Deep history (> ~60 days back)** + cross-check | Daily-level raw data 2001 → present, 300+ commodities, 2,700+ mandis; **refreshed monthly → lags the present by weeks** | Free API key (`api.ceda.ashoka.edu.in`) or manual CSV export | 50 | Do **not** use for the "last 7–30 days" window. |
| **Kaggle "Daily Wholesale Commodity Prices – India Mandis"** | Offline seed / demo safety net | Static snapshot 2013 → ~May 2025 | One-time CSV | 10 | Seasonality + offline demos only. |
| e-NAM | — | Last 7 days only, no developer API | — | — | Not usable. Skip. |

### 3.2 Weather

| Source | Role | What it is | Resolution / latency | Cost |
|---|---|---|---|---|
| **Open-Meteo** | **PRIMARY** (current, forecast, recent past, archive) | Free open API re-serving national-weather-service model output + ECMWF ERA5/ERA5-Land reanalysis | Forecast: best-match blend, 9–25 km globally, up to 16 days. Archive: ERA5-Land ~9–11 km (1950→) with ~5-day lag. `past_days` up to 92 | Free, no key (non-commercial, ~10,000 calls/day) |
| **NASA POWER** | **Independent validator + agro baselines + fallback** | NASA satellite/reanalysis-derived agro-climatology (MERRA-2 meteorology, CERES solar) | Meteorology 0.5°×0.625°, solar 1°×1° (coarse). Latency 2–7 days. Radiation from 1984, meteorology from 1981 | Free, no key, CC BY 4.0 |
| **OpenWeatherMap** (free endpoints only) | **Cross-check** for current + 5-day forecast | Commercial API with its own model blend | 3-hourly for 5 days; free tier 60 calls/min, 1M/month | Free |

### 3.3 Verdict — "best for what"

| Need | Best choice | Why |
|---|---|---|
| Weather — overall (forecast + history) | **Open-Meteo** | One free, key-less API covering forecast, recent days, and ERA5-Land history at the finest free resolution; ET₀, soil moisture, and precipitation probability included |
| Weather — independent validation, agro baselines, fallback | **NASA POWER** | A different modelling lineage from Open-Meteo/ECMWF, so disagreement is meaningful; agriculture-specific parameter set |
| Weather — quick sanity cross-check for current/next 5 days | **OpenWeatherMap (free)** | Already integrated; a third opinion |
| Mandi — today's prices | **data.gov.in feed** | Official, current, already working |
| Mandi — last 0–60 days | **`agmarknet` package** | Talks to the live Agmarknet backend; CEDA lags |
| Mandi — deep history | **CEDA** | 2001 → present, monthly-refreshed mirror |
| Mandi — offline / demo | **Kaggle CSV** | No network dependency |

> **Honest note.** There is no single "most accurate" source. Accuracy in this system comes from (a) routing each request to the right source for its time horizon, (b) validating with an independent source where one exists, and (c) telling the user how sure we are. **All four mandi sources originate from the same Agmarknet database**, so they add *availability and completeness*, not independent verification. The **weather sources are partially independent**, which is where real cross-validation is possible.

> **Tier B note.** The broad/national mandi lookup (§2.1) does not add a new source — it reuses the **data.gov.in live feed**, just without the state/commodity pre-filter that Tier A uses. The `agmarknet` package and CEDA stay Tier-A-only (deep history for 6 crops); Tier B is "today's price for anything," not "90 days of history for everything."

---

## 4. How the sources work together (accuracy model)

### 4.1 Mandi pipeline

```
raw record ─► canonicalize names ─► validate ─► reconcile by priority ─► store ─► aggregate for charts
```

1. **Canonicalize.** Same crop/market appears under different spellings across sources (`Soyabean` vs `Soybean`, `Lasalgaon` vs `Lasalgaon(Niphad)`). Without this you get duplicate rows instead of reconciled ones. Config-driven alias maps (§17). Unmapped **commodity** in scope → dropped and reported. Unmapped **market** → stored under its normalized name and reported (never lose data; collapse later).
2. **Validate.** Flag (do not delete): `nonpositive`, `order_violation` (not `min ≤ modal ≤ max`), `missing_price`, `outlier` (modal > 5× or < ⅕ of the trailing 60-day median for the same commodity+market+variety). Flagged rows are stored but excluded from chart aggregates.
3. **Reconcile by priority.** Same key (state, district, market, commodity, variety, grade, date) from two sources → the higher `source_priority` wins; equal priority → the more recent fetch wins. This stops a stale Kaggle/CEDA row from ever overwriting a live row.
4. **Aggregate.** Several varieties per crop per market per day exist. `v_mandi_daily` shows **median modal price across varieties** (robust), min of mins, max of maxes. The API accepts a `variety` filter to show one variety. The data.gov.in feed has **no arrivals field**, so arrival-weighting is not used.
5. **Gaps are gaps.** Mandis do not report daily (holidays, closures). The trend API returns a full date spine with `null` on missing days. Never interpolate or forward-fill silently.

### 4.2 Weather pipeline

```
providers (parallel, per grid cell) ─► normalize to WeatherDay ─► route by horizon ─► fuse ─► confidence ─► store ─► serve
```

**Grid snapping.** Round lat/lon to 0.1° (ERA5-Land grid) → `grid_key = "20.0,73.8"`. Many locations share a cache entry; the finest data we use cannot resolve smaller distances anyway.

**Routing by horizon (which source is PRIMARY)**

| Phase | Dates (IST) | Primary | Validators | Fallback if primary missing |
|---|---|---|---|---|
| past-archive | ≤ today − 6 | Open-Meteo **archive** (ERA5-Land) | NASA POWER | NASA POWER (mark `degraded`) |
| past-recent | today − 5 … today − 1 | Open-Meteo forecast endpoint with `past_days` (model analysis) | NASA POWER if latency allows (2–7 days ⇒ often absent) | NASA POWER if present |
| today | today | Open-Meteo forecast (`current` + daily) | OpenWeather current | OpenWeather |
| future | today + 1 … + 7 | Open-Meteo forecast (best match) | OpenWeather (covers ≤ 5 days) + Open-Meteo multi-model spread | OpenWeather |

**Why the two "past" phases exist.** ERA5-Land lags ~5 days, so the newest days come from Open-Meteo's model analysis. A daily `reconcile_recent` job later replaces those days with ERA5-Land archive values as they become available and re-fuses them (precedence per source: `archive` > `recent` > `forecast`).

**Variable → validator map** (only compare like with like)

| Variable | Primary | Validated against | Note |
|---|---|---|---|
| Tmax / Tmin | Open-Meteo | OpenWeather (future/today), NASA POWER (past) | |
| Precipitation | Open-Meteo | OpenWeather (future/today), NASA POWER (past) | Compare **buckets** and absolute/relative difference (§9.2) |
| Relative humidity | Open-Meteo | NASA POWER | |
| Solar radiation | Open-Meteo | NASA POWER | POWER solar grid is 1°×1° → wider tolerance |
| ET₀ | Open-Meteo (FAO-56) | — | No comparable independent field; not validated |
| Wind | Open-Meteo | **not compared** | POWER `WS2M` is 2 m; Open-Meteo is 10 m — not comparable |
| Soil moisture (top layer) | Open-Meteo (optional) | — | Model estimate; optional column |

**Confidence (weather only)**
- `high` — primary + ≥ 1 validator with data, all within tolerance.
- `medium` — only the primary has data, **or** forecast models disagree moderately, **or** a fallback source was used.
- `low` — any validated variable is out of tolerance (e.g., different rain buckets).
- **Advisory contract:** if `confidence == "low"`, the advisory/RAG layer must phrase weather-linked advice as uncertain and must not give hard "do it now" instructions. Pass `confidence` and `primary_source` into the advisory prompt context.

**Forecast uncertainty from a single free API.** A second Open-Meteo call requests `models=ecmwf_ifs025,gfs_seamless,icon_seamless` (daily Tmax/Tmin/precip only). Model spread and the fraction of models forecasting rain become uncertainty signals (`spread_*`, `models_rain_frac`). This is a principled measure of forecast disagreement at no extra cost.

### 4.3 Same-source baselines for anomalies
"Rain this month vs normal" must compare like with like. **Normals are computed from the same primary dataset** (Open-Meteo archive / ERA5-Land, 2010–2024) that produces the recent values. Do **not** compare ERA5-Land actuals against a NASA POWER climatology — that injects inter-dataset bias into the anomaly. NASA POWER climatology is only a fallback baseline if the archive is unavailable.

### 4.4 What we deliberately do not do
- No averaging of providers. No blending weights. No ML bias-correction (yet).
- No pretending point accuracy: gridded rainfall is an **area average** (~9–25 km). In monsoon convective rain, a farm can get much more or less than its grid cell. UI copy must say "area estimate".
- No prediction of prices from weather. The context layer (§10.4) only shows **descriptive** signals.

---

## 5. Data model (Supabase / Postgres)

Put this in `supabase/migrations/<timestamp>_data_layer.sql`.

```sql
-- ========== MANDI ==========
create table mandi_prices (
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
create index mandi_prices_trend_idx on mandi_prices (commodity, market, arrival_date desc);
create index mandi_prices_state_idx on mandi_prices (state, commodity, arrival_date desc);

-- All key columns are NOT NULL (empty string = unknown) so the unique constraint really dedupes.

create view v_mandi_daily as
select commodity, state, district, market, arrival_date,
       percentile_cont(0.5) within group (order by modal_price) as modal_price,
       min(min_price) as min_price,
       max(max_price) as max_price,
       count(*)       as n_varieties,
       max(source_priority) as best_priority
from mandi_prices
where quality_flag = 'ok'
group by commodity, state, district, market, arrival_date;

-- Priority-aware upsert. Called by the backend as RPC with a JSON array.
-- IMPORTANT: the caller must de-duplicate keys inside one batch first
-- (ON CONFLICT DO UPDATE cannot touch the same row twice in one statement).
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

-- ========== TIER B: MANDI WATCH LIST (§9.5) ==========
-- A crop/market pair a user searched outside the tracked-6-crop scope. Rows here "graduate"
-- into the daily ingest job's scope. Bounded by application logic (LRU cap), not by the DB.
create table mandi_watch (
  id                bigserial primary key,
  state             text not null,
  district          text not null default '',
  market            text not null default '',    -- '' = whole state/commodity, no single market pinned
  commodity         text not null,
  first_requested_at timestamptz not null default now(),
  last_requested_at  timestamptz not null default now(),
  request_count      integer not null default 1,
  tracked            boolean not null default true,   -- false once LRU-evicted; rows outlive eviction for stats
  unique (state, district, market, commodity)
);
create index mandi_watch_tracked_idx on mandi_watch (tracked, last_requested_at desc);

-- ========== LOCATIONS ==========
create table locations (
  id             bigserial primary key,
  kind           text not null check (kind in ('mandi','district','farm','custom')),
  name           text not null,
  state          text not null,
  district       text not null default '',
  lat            numeric(8,5) not null,
  lon            numeric(8,5) not null,
  grid_key       text not null,            -- computed in app code: f"{round(lat,1):.1f},{round(lon,1):.1f}"
  geocode_source text,
  verified       boolean not null default false,
  tracked        boolean not null default true,
  unique (kind, name, state, district)
);
create index locations_grid_idx on locations (grid_key);

-- ========== WEATHER ==========
create table weather_daily (                 -- raw, per source
  grid_key        text not null,
  date            date not null,
  source          text not null check (source in ('open_meteo','openweather','nasa_power')),
  kind            text not null check (kind in ('forecast','recent','archive')),
  tmax_c          real, tmin_c real, tmean_c real,
  precip_mm       real, precip_prob_pct real,
  rh_mean_pct     real, wind_max_kmh real,
  radiation_mj_m2 real, et0_mm real,
  soil_moisture_top real,                    -- optional (Open-Meteo)
  spread_tmax_c   real, spread_precip_mm real, models_rain_frac real,   -- multi-model spread (forecast only)
  fetched_at      timestamptz not null default now(),
  primary key (grid_key, date, source, kind)
);
create index weather_daily_date_idx on weather_daily (date);

create table weather_daily_fused (           -- what the API serves
  grid_key        text not null,
  date            date not null,
  phase           text not null check (phase in ('past','today','future')),
  tmax_c real, tmin_c real, precip_mm real, precip_prob_pct real,
  rh_mean_pct real, radiation_mj_m2 real, et0_mm real,
  primary_source  text not null,
  validators      text[] not null default '{}',
  confidence      text not null check (confidence in ('high','medium','low')),
  degraded        boolean not null default false,
  disagreement    jsonb,                     -- e.g. {"precip_mm":{"open_meteo":12.1,"openweather":1.0}}
  updated_at      timestamptz not null default now(),
  primary key (grid_key, date)
);

create table weather_current (
  grid_key        text primary key,
  observed_at     timestamptz not null,
  temp_c real, rh_pct real, wind_kmh real, precip_mm_1h real, weather_code int,
  source          text not null,
  confidence      text not null check (confidence in ('high','medium','low')),
  cross_check     jsonb,                     -- {"openweather":{"temp_c":28.9}}
  updated_at      timestamptz not null default now()
);

create table weather_normals_monthly (
  grid_key        text not null,
  month           smallint not null check (month between 1 and 12),
  tmax_c real, tmin_c real, precip_mm_month real,
  source          text not null,             -- 'open_meteo_era5land' (default) | 'nasa_power' (fallback)
  period          text not null,             -- e.g. '2010-2024'
  primary key (grid_key, month)
);

-- ========== OPS ==========
create table ingestion_runs (
  id            bigserial primary key,
  job           text not null,               -- ingest_mandi_daily | ingest_weather | reconcile_recent | ...
  source        text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running' check (status in ('running','ok','partial','failed')),
  rows_in       integer, rows_upserted integer, rows_flagged integer,
  notes         jsonb                        -- unmapped names, disagreement stats, errors
);

-- ========== SECURITY ==========
-- Deny-by-default. The frontend must NOT query these tables directly; it goes through FastAPI
-- (service role, server-side only). If the recon finds the existing frontend already reads
-- market data straight from Supabase, add narrowly-scoped read policies for those objects only.
alter table mandi_prices             enable row level security;
alter table mandi_watch              enable row level security;
alter table locations                enable row level security;
alter table weather_daily            enable row level security;
alter table weather_daily_fused      enable row level security;
alter table weather_current          enable row level security;
alter table weather_normals_monthly  enable row level security;
alter table ingestion_runs           enable row level security;
```

**If a market-history table already exists** (created when day-by-day accumulation was added), Phase 1 includes a one-off data migration into `mandi_prices` (`source='datagov_live'`, `source_priority=100`) and the old table stays untouched until Phase 2 is accepted.

---

## 6. Contracts: normalized types and adapter interface

All adapters return **normalized** objects; nothing provider-specific leaks past the adapter.

```python
# app/data/types.py
from dataclasses import dataclass
from datetime import date, datetime

@dataclass(frozen=True)
class MandiRecord:
    state: str; district: str; market: str; commodity: str; variety: str; grade: str
    arrival_date: date
    min_price: float | None; max_price: float | None; modal_price: float | None
    arrivals_tonnes: float | None
    source: str                    # datagov_live | agmarknet_pkg | ceda | kaggle_seed
    source_priority: int

@dataclass(frozen=True)
class GridPoint:
    grid_key: str; lat: float; lon: float

@dataclass
class WeatherDay:
    grid_key: str; date: date; source: str; kind: str        # forecast | recent | archive
    tmax_c: float | None = None; tmin_c: float | None = None; tmean_c: float | None = None
    precip_mm: float | None = None; precip_prob_pct: float | None = None
    rh_mean_pct: float | None = None; wind_max_kmh: float | None = None
    radiation_mj_m2: float | None = None; et0_mm: float | None = None
    soil_moisture_top: float | None = None
    spread_tmax_c: float | None = None; spread_precip_mm: float | None = None
    models_rain_frac: float | None = None

@dataclass
class WeatherCurrent:
    grid_key: str; observed_at: datetime; source: str
    temp_c: float | None; rh_pct: float | None; wind_kmh: float | None
    precip_mm_1h: float | None; weather_code: int | None
```

```python
# app/data/weather/providers/base.py
class WeatherProvider(Protocol):
    name: str
    async def daily(self, points: list[GridPoint], start: date, end: date, kind: str) -> list[WeatherDay]: ...
    async def current(self, points: list[GridPoint]) -> list[WeatherCurrent]: ...
```

```python
# app/data/mandi/sources/base.py
class MandiSource(Protocol):
    name: str
    priority: int
    def fetch(self, start: date, end: date, scope: TrackedScope) -> Iterable[MandiRecord]: ...
```

**Unit rules (normalize inside adapters):** prices ₹/quintal; temperature °C; precipitation mm/day; wind km/h; radiation MJ/m²/day; ET₀ mm/day; humidity %. Missing/fill values (`-999`, `NA`, empty) → `None`. Never store sentinels.

**Error taxonomy:** `ProviderTimeout`, `ProviderHTTPError(status)`, `ProviderSchemaError` (unexpected shape/fields), `ProviderQuotaError`. Adapters raise these; the runner decides retry / skip / degrade (§12).

---

## 7. Repo layout (logical — map to the real repo in Phase 0)

```
backend/
  app/
    core/            config.py  http.py (shared httpx.AsyncClient, retries, timeouts)  logging.py  timeutil.py (today_ist)
    data/
      types.py
      mandi/
        sources/     datagov_live.py  agmarknet_pkg.py  ceda.py  kaggle_seed.py  base.py
        canonical.py   # alias maps from config/tracked_scope.yaml
        validate.py    # flags: nonpositive, order_violation, missing_price, outlier
        reconcile.py   # de-dupe within batch, priority rules
        repository.py  # calls rpc upsert_mandi_prices in chunks of 1000
        series.py      # date spine + gap detection for the trend API
        service.py
      weather/
        providers/   open_meteo.py  nasa_power.py  openweather.py  base.py
        grid.py        # snap_to_grid(), batching
        fusion.py      # route + fuse + confidence (pure functions, unit-tested)
        agro.py        # rain_7d, rain_30d, dry_spell_days, anomalies
        repository.py
        service.py     # get_current / get_forecast / get_history / get_summary
      locations/     geocode.py  repository.py
    api/routes/      market.py  weather.py  context.py  health.py
    schemas/         market.py  weather.py  context.py     # Pydantic response models
  jobs/              ingest_mandi_daily.py  backfill_mandi.py  load_kaggle_seed.py  load_ceda_csv.py
                     ingest_weather.py  reconcile_recent.py  power_validate.py
                     refresh_normals.py  build_locations.py  prune.py
  config/            tracked_scope.yaml  fusion.yaml
  tests/             fixtures/<provider>/*.json  test_*.py
supabase/migrations/ <timestamp>_data_layer.sql
.github/workflows/   ingest-mandi.yml  ingest-weather.yml  reconcile-recent.yml  power-validate.yml  backfill-mandi.yml  prune.yml  ci.yml
docs/data-layer/     Architecture_MarketData_Weather.md  Implementationplan_MarketData_Weather.md  recon.md
frontend/            lib/api/market.ts  lib/api/weather.ts  components/… (see §14)
```

Jobs import the same `app.data.*` modules the API uses — logic is never duplicated.

---

## 8. Provider integration specs

### 8.1 data.gov.in — live mandi feed
- **URL:** `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- **Params:** `api-key`, `format=json`, `limit=1000`, `offset`, plus filters for state and commodity.
  Use **exactly the filter-key syntax the existing working fetcher already uses** (older docs show `filters[State]`, newer responses use lowercase field names — match whatever works today).
- **Scope:** loop over tracked state × tracked commodity (a few requests of ≤ 1000 rows) instead of downloading the whole ~16k-row feed.
- **Pagination — known trap:** the server may return fewer rows than `limit`. **Advance `offset` by `len(records)` actually returned, never by the requested `limit`.** Stop when `records` is empty or `offset >= total`. Hard cap pages per query (e.g., 50).
- **Demo-key detector:** on startup make one request with `limit=1000`; if `total > 10` but `len(records) <= 10`, log ERROR `sample/demo key detected — register a personal key at data.gov.in` and abort.
- **Fields (map case-insensitively):** `state, district, market, commodity, variety, grade, arrival_date (DD/MM/YYYY), min_price, max_price, modal_price`. Prices arrive as strings; empty/`NA` → `None`. No arrivals field.
- **Timing:** feed fills through the day → run 15:30 IST and again 21:30 IST (idempotent; the second pass catches late reporters).
- **Tier B live lookup (§9.5):** the exact same adapter function, called synchronously on a cache miss with `state` + `commodity` (+ optional `market`) and no date loop — just today. One request, same field mapping, same `upsert_mandi_prices` write path with `source='datagov_live'`. This is not a second client to build.

### 8.2 `agmarknet` package — recent-window backfill and gap fill
```python
from agmarknet import Agmarknet
api = Agmarknet()
df = api.report(from_date="2026-08-29", to_date="2026-09-28",    # strings YYYY-MM-DD
                commodity="Onion", state="Maharashtra", data_type="both")
```
- Pin `agmarknet==0.2.2`. Call in **≤ 31-day windows**; the backend restricts very large queries (the package chunks by calendar year for long ranges).
- Column names per its docs: `arrival_date, state_name, district_name, market_name, cmdt_grp_name, cmdt_name, variety_name, grade_name, min_price, max_price, model_price` (sic), `unit_name_price` (+ arrival quantity/unit columns when `data_type="both"`). **Assert required columns at runtime**; if one is missing raise `ProviderSchemaError` with the list of columns actually received. Map arrival quantity to `arrivals_tonnes` only if the unit column proves it is tonnes (convert quintal → tonnes ÷ 10).
- **If the package breaks:** it is MIT-licensed — read its source to find the report endpoint it calls, and vendor a minimal client (≈ 50 lines) in `sources/agmarknet_pkg.py`. Do **not** jump to Playwright/HTML scraping.

### 8.3 CEDA — deep history
- Register a free key at `https://api.ceda.ashoka.edu.in/`. **Read their API docs after the key is issued** to write `ceda.py`; do not guess query parameters.
- **Not blocked on the key:** implement `jobs/load_ceda_csv.py` first (manual CSV export from `agmarknet.ceda.ashoka.edu.in`, then import). Raw fields: `date, state_name, district_name, market_name, commodity_name, variety, grade, min_price, max_price, modal_price` (+ arrivals table).
- Refreshed monthly → use only for dates older than ~60 days.

### 8.4 Kaggle seed
- `jobs/load_kaggle_seed.py --csv <path>`. Expected headers: `Arrival_Date, State, District, Market, Commodity, Variety, Min_Price, Max_Price, Modal_Price` (verify the header row; abort with a clear message if different). Filter to tracked scope, `source='kaggle_seed'`, priority 10.

### 8.5 Open-Meteo (PRIMARY)
Use **plain `httpx` + JSON** (async, batchable, easy to fixture-test). Do not use the FlatBuffers SDK.

| Purpose | Endpoint | Key params |
|---|---|---|
| Forecast + recent past + today | `GET https://api.open-meteo.com/v1/forecast` | `latitude=a,b,c&longitude=x,y,z` (comma-separated batch → list response), `daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,precipitation_probability_max,relative_humidity_2m_mean,wind_speed_10m_max,shortwave_radiation_sum,et0_fao_evapotranspiration`, `current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`, `past_days=7`, `forecast_days=8`, `timezone=Asia/Kolkata` |
| Forecast spread | same endpoint | `models=ecmwf_ifs025,gfs_seamless,icon_seamless`, `daily=temperature_2m_max,temperature_2m_min,precipitation_sum`, `forecast_days=7` (response keys are suffixed with the model id; verify ids against the docs) |
| Archive (ERA5-Land) | `GET https://archive-api.open-meteo.com/v1/archive` | `start_date`, `end_date` (**≤ today − 6**, there is a ~5-day lag), `models=era5_land`, same `daily` list, `timezone=Asia/Kolkata` |
| Normals (one-off per grid) | archive endpoint | `2010-01-01 → 2024-12-31`, `daily=temperature_2m_max,temperature_2m_min,precipitation_sum`, `models=era5_land`; aggregate to monthly means in Python |
| Geocoding (for `locations`) | `GET https://geocoding-api.open-meteo.com/v1/search` | `name`, `count=5`, restrict to India; match `admin1` to state |

- **Splitting the forecast response:** dates `< today_ist` → `kind='recent'`; dates `≥ today_ist` → `kind='forecast'`.
- Archive soil moisture layers differ from forecast layers; soil moisture is an optional stretch column — leave `NULL` if not implemented.
- **Budget:** free non-commercial tier is roughly 10,000 calls/day (confirm on open-meteo.com/en/pricing). Large batches / long ranges may count as more than one call → target ≪ 2,000 call-equivalents/day (§12).
- Attribution is required (§19).

### 8.6 NASA POWER (validator + baselines)
`GET https://power.larc.nasa.gov/api/temporal/daily/point`
`?start=YYYYMMDD&end=YYYYMMDD&latitude=<lat>&longitude=<lon>&community=ag&parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN&format=json`

- Response values live under `properties.parameter.<PARAM>.<YYYYMMDD>`. The fill value (`-999`) is given in the response header → treat as `None`. Read units from the response metadata (with `community=ag`: °C, mm/day, %, MJ/m²/day) and assert them.
- **One request per point.** Max 3 concurrent, backoff on 429/5xx. History is immutable → cache aggressively.
- **Latency 2–7 days** → for dates newer than that, values are missing: ignore them (that is normal, not an error).
- Coarse grid (met 0.5°×0.625°, solar 1°×1°) → validator only, wide tolerances (§9.2). Use as primary only as a **fallback**.
- Daily aggregation is in local solar time by default (small offset vs IST) — irrelevant for daily totals at validator accuracy; do not "fix" it.
- Optional later (Phase 6): soil-wetness parameters — confirm exact names in the POWER Parameter Dictionary before using.
- Attribution: CC BY 4.0.

### 8.7 OpenWeatherMap (cross-check, free endpoints only)
- Current: `GET https://api.openweathermap.org/data/2.5/weather?lat=&lon=&appid=&units=metric`
- Forecast: `GET https://api.openweathermap.org/data/2.5/forecast?lat=&lon=&appid=&units=metric` (40 × 3-hour slots)
- Daily aggregation: group slots by **local date** (`city.timezone` seconds offset); `tmax = max(main.temp_max)`, `tmin = min(main.temp_min)`, `precip = Σ rain["3h"]`, `precip_prob = max(pop) × 100`, `rh = mean(main.humidity)`. Skip incomplete days (< 8 slots).
- **Do not use One Call 3.0** (separate subscription, card required). Reuse the key already in the project.
- Limits: 60 calls/min, 1M/month. New keys need ~10 min to activate.
- **License caution:** OpenWeather data is ODbL/CC BY-SA (share-alike). Treat it as a **transient validator** — keep rows ≤ 14 days, never republish raw OpenWeather data.

### 8.8 Locations
`build_locations.py` creates `locations` rows for every tracked mandi/district: geocode via Open-Meteo Geocoding (fallback: district centroid), set `verified=false`, and write `docs/data-layer/locations_review.csv` (name, state, district, lat, lon) so Jinay can eyeball ~30–60 rows once and flip `verified=true`. Weather is fetched per **grid_key**, so several locations share one fetch.

---

## 9. Algorithms

### 9.1 Mandi
```python
def process_batch(records, existing_priority_lookup):
    recs = [canonicalize(r) for r in records]                # drop unmapped commodity → report
    recs = [flag_quality(r) for r in recs]                   # nonpositive / order_violation / missing_price
    recs = dedupe_by_key(recs, keep="highest_priority_then_latest")   # REQUIRED before RPC
    for chunk in chunks(recs, 1000):
        rpc("upsert_mandi_prices", chunk)                    # SQL enforces priority rule
    run_outlier_flagging(days=7)                             # SQL below
```
```sql
-- outlier flagging (run after ingest; only touches the last 7 days; band is deliberately loose: 5x)
update mandi_prices m set quality_flag = 'outlier'
from (select commodity, market, variety,
             percentile_cont(0.5) within group (order by modal_price) as med
      from mandi_prices
      where arrival_date >= current_date - 60 and quality_flag = 'ok'
      group by 1,2,3) s
where m.commodity=s.commodity and m.market=s.market and m.variety=s.variety
  and m.arrival_date >= current_date - 7 and m.quality_flag = 'ok'
  and (m.modal_price > s.med*5 or m.modal_price < s.med/5);
```
`canonicalize`: `casefold`, trim, collapse whitespace, strip punctuation noise; look up in alias index from `config/tracked_scope.yaml`.

**Date spine** (`series.py`): for `[today − days + 1, today]` (IST) emit every calendar date; join to `v_mandi_daily`; missing → nulls; return `gaps[]` and coverage.

### 9.2 Weather fusion
```python
PHASE = lambda d, today: "past" if d < today else ("today" if d == today else "future")

def fuse_day(grid_key, d, today, rows_by_source, cfg) -> FusedDay:
    phase = PHASE(d, today)
    order = cfg.primary_order[phase_key(d, today)]        # from the routing table in §4.2
    primary = first_available(order, rows_by_source)      # per source: archive > recent > forecast
    degraded = primary.source != order[0]
    validators = [rows_by_source[s] for s in cfg.validators[phase_key(d, today)]
                  if s in rows_by_source and s != primary.source]

    disagreement = {}
    for v in validators:
        for field in VALIDATED_FIELDS[v.source]:          # only like-with-like (see §4.2 map)
            a, b = getattr(primary, field), getattr(v, field)
            if a is None or b is None: continue
            if not within_tolerance(field, a, b, cfg.tolerances):
                disagreement.setdefault(field, {})[primary.source] = a
                disagreement[field][v.source] = b

    n_val = sum(1 for v in validators if any(getattr(v, f) is not None for f in VALIDATED_FIELDS[v.source]))
    spread_flag = phase == "future" and (
        (primary.models_rain_frac is not None and 0.34 <= primary.models_rain_frac <= 0.66)
        or (primary.spread_tmax_c or 0) > cfg.spread.tmax_c)

    if disagreement:            conf = "low"
    elif degraded:              conf = "medium"
    elif spread_flag:           conf = "medium"
    elif n_val >= 1:            conf = "high"
    else:                       conf = "medium"
    return FusedDay(..., confidence=conf, degraded=degraded, disagreement=disagreement or None)
```

```yaml
# config/fusion.yaml  (tune after ~2 weeks of logged disagreement rates)
primary_order:
  past_archive: [open_meteo, nasa_power]
  past_recent:  [open_meteo, nasa_power]
  today:        [open_meteo, openweather]
  future:       [open_meteo, openweather]
validators:
  past_archive: [nasa_power]
  past_recent:  [nasa_power]
  today:        [openweather]
  future:       [openweather]
tolerances:
  temp_c: 2.5
  rh_pct: 15
  radiation_rel: 0.20
  precip:
    abs_mm: 2.0
    rel: 0.30
    bucket_mismatch_is_disagreement: true
spread: { tmax_c: 3.0 }
# Rainfall buckets (mm / 24 h). Use IMD's published 24-hour classes — VERIFY the exact thresholds
# against IMD's official table before shipping; keep them here, never hard-coded.
rain_buckets_mm: [0.1, 2.5, 15.6, 64.5, 115.6, 204.5]
```
`within_tolerance` for precipitation: agree if buckets are equal **or** `abs(a−b) ≤ max(abs_mm, rel × max(a,b))`; otherwise disagree.

**Re-fusion:** `fuse_range(grid_keys, start, end)` is idempotent. It runs at the end of `ingest_weather`, `reconcile_recent`, and `power_validate`.

### 9.3 Agro metrics (computed on read from `weather_daily_fused`, not stored)
`rain_7d_mm`, `rain_30d_mm`, `rain_30d_vs_normal_pct` (vs `weather_normals_monthly`, prorated by days), `dry_spell_days` (consecutive days with precip < 1 mm ending today), `tmax_7d_anomaly_c`, `et0_7d_mm`. Metrics inherit the **lowest confidence** of the days they use.

### 9.4 Weather Tier B — on-demand path for any location (Explore)
This **is** Tier B for weather; no separate mechanism is needed. If a requested `lat/lon` snaps to an untracked grid:
1. One live **Open-Meteo-only** fetch (current + 7-day forecast; 8 s timeout) — no NASA POWER/OpenWeather call on this synchronous path, to keep the request fast and cheap.
2. Write through to `weather_daily` / `weather_current` with `source='open_meteo'`, and set the day's/current's `confidence='medium'` (single-source, unvalidated) regardless of what §9.2's rules would otherwise say — Tier B confidence is capped until a location graduates.
3. Upsert `locations` with `tracked=true` for that grid. From the **next scheduled `ingest_weather` run**, this grid is treated exactly like any Tier A grid — full multi-source fusion, real confidence scoring (§9.2).
4. New-grid cap: **300/day** (config `WEATHER_ONDEMAND_MAX_NEW_GRIDS`), not 50 — India's land area at the 0.1° ERA5-Land grid is roughly 25,000–30,000 cells total, Open-Meteo's free budget is ~10,000 calls/day, and every grid is cached and shared by anyone nearby, so this is generous without being risky. Beyond the daily cap, serve the nearest tracked grid and set `degraded=true`.

### 9.5 Mandi Tier B — watch list and graduation
Mirrors §9.4 for mandi prices, using the `mandi_watch` table (§5):
```python
def get_market_search(state, commodity, market=None):
    key = (state, district or "", market or "", commodity)
    row = mandi_prices.latest(state, commodity, market)          # today's cached/ingested rows, if any
    if row is None or row.arrival_date < today_ist():
        row = datagov_live.fetch_today(state, commodity, market)  # §8.1 Tier B lookup — one live call
        upsert_mandi_prices(row, source="datagov_live", priority=100)
    upsert_watch(key)                                             # bump last_requested_at / request_count
    return row

def upsert_watch(key):
    # insert or bump last_requested_at + request_count; set tracked=true
    ...
    if count_tracked() > MANDI_WATCH_MAX_TRACKED:                 # config, default 300
        evict_least_recently_requested(over_limit_count)          # tracked=false; row kept for stats
```
- `jobs/ingest_mandi_daily` (§11) pulls its scope from `tracked_scope.yaml` (Tier A) **union** `mandi_watch where tracked=true` (Tier B) — one job, one code path, per §2.1.
- Eviction only flips `tracked=false` (stops future daily pulls); it never deletes existing `mandi_prices` rows. Those age out via the normal retention rule (§13): non-advisory-crop rows older than 90 days are pruned regardless of `tracked` status.
- `MANDI_WATCH_MAX_TRACKED` default **300** — at Tier A's per-row storage estimate (§13) this is a small, predictable addition (low tens of MB/year even at full capacity), nowhere near the 500 MB cap.

---

## 9b. Margin and storage calculators, and market-level weather

Three additions prompted by competitor review (iti-h's Crop Margin Calculator, Storage Estimator, and per-market weather) — the first two need one small new reference table each; the third needs no new engine at all. All three are estimates from reference data, not the farmer's actual costs — say so in the UI, same honesty discipline as everywhere else in this project.

### 9b.1 Crop margin calculator

**Source:** the Directorate of Economics & Statistics' "Comprehensive Scheme for Studying the Cost of Cultivation of Principal Crops in India" — the same survey that feeds CACP's MSP recommendations. State × crop × year cost-of-cultivation and cost-of-production figures (the A2+FL and C2 cost categories — C2 is the fuller measure, including imputed land rental and interest on capital), plus a reference yield per hectare. Free, government-published, mirrored under an open license via indiadataportal.com. **Annual survey data, not real-time** — the latest available year will typically lag the current season by a year or more; state that plainly in the UI rather than implying it's current.

```sql
create table crop_cost_reference (
  crop            text not null,
  state           text not null,
  year            text not null,                    -- e.g. '2022-23' — use the latest year on file, don't average across years
  cost_a2fl_per_quintal numeric(10,2),
  cost_c2_per_quintal   numeric(10,2),
  reference_yield_qtl_per_hectare numeric(8,2),
  source          text not null default 'DES Cost of Cultivation Scheme',
  primary key (crop, state, year)
);
```
```python
def margin_estimate(crop, state, field_size_acres, recent_modal_price):
    cost_ref = crop_cost_reference.latest(crop, state)
    if not cost_ref:
        return None   # no cost data for this crop/state on file — say so, don't guess
    cost_per_qtl = cost_ref.cost_c2_per_quintal
    est_yield_qtl = cost_ref.reference_yield_qtl_per_hectare * (field_size_acres * 0.4047)   # acres -> hectares
    margin_per_qtl = recent_modal_price - cost_per_qtl
    return MarginEstimate(cost_per_qtl=cost_per_qtl, price_per_qtl=recent_modal_price,
                           margin_per_qtl=margin_per_qtl, est_total_margin=round(margin_per_qtl * est_yield_qtl, 0),
                           cost_year=cost_ref.year, source=cost_ref.source)
```
The response must carry `cost_year` and make clear the yield is a state reference average, not the farmer's actual yield — the same "computed and cited, never just asserted" rule from `Architecture_Advisory.md` §17 applies here too, outside the advisory layer.

### 9b.2 Storage estimator (hold-vs-sell)

Only meaningful for crops that actually store — tomato doesn't belong in this feature at all, which is worth encoding rather than leaving the UI to guess at:

```sql
create table crop_storage_reference (
  crop                        text primary key,
  storable                    boolean not null,
  max_storage_days            smallint,
  typical_loss_pct_per_month  numeric(4,1),
  source                      text not null
);
```
Keep the calculator honest about uncertainty, in the same hedge-forward register as MandiLens's own "outlook" language (`Architecture_Frontend.md` §3): take a storage-cost rate as the **farmer's own input** (local storage costs vary too much to default sensibly), apply `typical_loss_pct_per_month` above, and compare against this project's own historical prices for the same commodity/market in the equivalent week of past years — labeled plainly as "in the last N years, prices in the following month were typically X% higher/lower at this time," never as a prediction. Show the arithmetic; let the farmer decide.

### 9b.3 Market-level weather (distinct from the farm-level view)

No new engine — `locations.kind = 'mandi'` already exists in the schema (§5) for exactly this. Calling `weather.service.get_summary()` with a mandi's `location_id` instead of a farm's answers a different question than the farm-level call: not "is this good growing weather" but "will rain disrupt arrivals or transport at this market" — worth its own small panel on a market's page (`Implementationplan_Frontend.md` Phase 3), not just on the farmer's personal dashboard.

---

## 10. API contract

All dates are ISO `YYYY-MM-DD` in IST. Numbers are numbers (never strings). Missing = `null`. Every response has `as_of` (UTC ISO) and `stale` (bool).

### 10.1 Market
| Endpoint | Purpose |
|---|---|
| `GET /api/market/prices/latest?commodity=&state=&district=&market=&limit=` | Latest price rows (reuse/extend the existing endpoint; don't break its current contract) |
| `GET /api/market/trend?commodity=&market=&state=&days=30&variety=&include_flagged=false` | Chart series (7 / 30 / 90) |
| `GET /api/market/search?state=&commodity=&market=` | **Tier B (Explore) — §9.5.** Any crop, any state/market. Live-lookup-on-miss + graduation into daily tracking. Response adds `"tier": "advisory" \| "explore"` and, for `explore`, `"history_available": false` (or `true` once enough days have accumulated to show a short trend) so the UI can be honest about depth |
| `GET /api/market/margin?crop=&state=&field_size_acres=` | §9b.1 — returns `null` with a clear reason if no cost data exists for that crop/state, never a guessed number |
| `GET /api/market/storage-estimate?crop=&market=&storage_cost_per_qtl_per_month=` | §9b.2 — `storable: false` short-circuits with an explanation for non-storable crops rather than a number |

```json
{
  "commodity": "Onion", "market": "Lasalgaon", "state": "Maharashtra", "unit": "Rs/Quintal",
  "range": {"from": "2026-08-30", "to": "2026-09-28"},
  "coverage": {"expected_days": 30, "days_with_data": 25, "gaps": ["2026-09-06", "2026-09-13"]},
  "sources": {"datagov_live": 9, "agmarknet_pkg": 16},
  "as_of": "2026-09-28T10:05:00Z", "stale": false,
  "points": [
    {"date": "2026-08-30", "modal": 2150, "min": 1800, "max": 2400, "n_varieties": 2},
    {"date": "2026-08-31", "modal": null, "min": null, "max": null, "n_varieties": 0}
  ]
}
```
`days` allowed: 7, 30, 90, 180. `stale=true` if the newest data point is older than 36 h on a weekday.

### 10.2 Weather
Accept `location_id` **or** `lat`+`lon`.

| Endpoint | Purpose |
|---|---|
| `GET /api/weather/current` | Current conditions + cross-check |
| `GET /api/weather/forecast?days=7` | Fused future days |
| `GET /api/weather/history?days=30` | Fused past days |
| `GET /api/weather/summary` | current + 7 past + 7 future + agro metrics (one call for the UI and the advisory service) |

```json
{
  "location": {"id": 12, "name": "Nashik", "grid_key": "20.0,73.8"},
  "as_of": "2026-09-28T06:20:00Z", "stale": false, "degraded": false,
  "current": {"temp_c": 29.4, "rh_pct": 74, "wind_kmh": 11, "precip_mm_1h": 0.0,
              "source": "open_meteo", "confidence": "high",
              "cross_check": {"openweather": {"temp_c": 28.9}}},
  "days": [
    {"date": "2026-09-27", "phase": "past", "tmax_c": 31.2, "tmin_c": 22.4, "precip_mm": 8.1,
     "primary_source": "open_meteo", "validators": [], "confidence": "medium", "degraded": false, "disagreement": null},
    {"date": "2026-09-29", "phase": "future", "tmax_c": 30.1, "tmin_c": 22.0, "precip_mm": 14.2, "precip_prob_pct": 70,
     "primary_source": "open_meteo", "validators": ["openweather"], "confidence": "low",
     "disagreement": {"precip_mm": {"open_meteo": 14.2, "openweather": 1.0}}}
  ],
  "metrics": {"rain_7d_mm": 34.2, "rain_30d_mm": 151.0, "rain_30d_vs_normal_pct": 18,
              "dry_spell_days": 0, "confidence": "medium"}
}
```

### 10.3 Ops
`GET /api/health/data` → for each job: `last_success_at`, `age_hours`, `status`, `rows_upserted`; overall `ok|degraded`. Thresholds: mandi > 36 h, weather > 12 h, reconcile > 36 h → `degraded`.

### 10.4 Context (Phase 4)
`GET /api/context/market-weather?commodity=&market=&days=30` → price block (latest modal, 7d %, 30d %, volatility, coverage) + weather block for the market's district grid (metrics above) + `signals[]`.
Signals are **descriptive, rule-based, config-driven, max 3**, each with `rule`, `evidence` (the numbers), `strength`. Example: `heavy_recent_rain` when `rain_7d_mm` exceeds a configured threshold → text: "Heavy rain in the last 7 days in this district. Supply disruption can influence prices; no price effect is established." Never phrase as a prediction.

---

## 11. Scheduling and jobs

Runner: **GitHub Actions** (scheduled workflows run **only from the default branch** — so schedules go live after merging to `main`; until then use `workflow_dispatch`). All cron times are UTC. Scheduled workflows on public repos can be auto-disabled after 60 days without repo activity, and runs may be delayed by minutes — jobs must tolerate both.

| Job | IST | Cron (UTC) | Does |
|---|---|---|---|
| `ingest_mandi_daily` | 15:30 and 21:30 | `0 10 * * *`, `0 16 * * *` | data.gov.in → canonicalize → validate → upsert → outlier flag → `ingestion_runs` |
| `ingest_weather` | 05:45, 11:45, 17:45, 23:45 | `15 0,6,12,18 * * *` | For all tracked grids: Open-Meteo forecast (+recent) + spread, OpenWeather current/forecast, then `fuse_range(today−7 … today+7)` and update `weather_current` |
| `reconcile_recent` | 08:00 | `30 2 * * *` | Open-Meteo **archive** for `today−14 … today−6` → re-fuse |
| `power_validate` | 08:30 | `0 3 * * *` | NASA POWER for `today−14 … today−2` per tracked grid → re-fuse |
| `refresh_normals` | manual | `workflow_dispatch` | Normals for new grids (one-off) |
| `backfill_mandi` | manual | `workflow_dispatch` | Inputs: `days`, `source` (`agmarknet_pkg` \| `ceda_csv` \| `kaggle`) |
| `prune` | Sun 01:30 | `0 20 * * 6` | Retention (§13) |
| `ci` | on PR | — | Lint + unit tests (no network) |

```yaml
# .github/workflows/ingest-mandi.yml  (bump action versions to current majors)
name: ingest-mandi
on:
  schedule:
    - cron: "0 10 * * *"   # 15:30 IST
    - cron: "0 16 * * *"   # 21:30 IST
  workflow_dispatch: {}
concurrency: { group: ingest-mandi, cancel-in-progress: false }
jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip }   # match the backend's Python version
      - run: pip install -r backend/requirements.txt
      - run: python -m jobs.ingest_mandi_daily
        working-directory: backend
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DATA_GOV_IN_KEY: ${{ secrets.DATA_GOV_IN_KEY }}
```
Every job: open an `ingestion_runs` row at start, close it with `ok | partial | failed` and counts/notes at the end; exit non-zero on `failed` so GitHub emails the failure.

**Reachability check (Phase 1 acceptance):** run `ingest_mandi_daily` once via `workflow_dispatch` from a GitHub-hosted runner. Some `.gov.in` endpoints throttle or block non-Indian cloud IPs; this is unverified for data.gov.in. If the runner cannot reach it, fall back to a scheduled run on Jinay's Mac (`launchd`/cron) or a self-hosted runner — the job code does not change.

The daily ingestion also acts as a **keep-alive** against Supabase Free auto-pause.

---

## 12. Resilience, caching, rate budget

| Provider | Timeout | Retries | Concurrency | Notes |
|---|---|---|---|---|
| Open-Meteo | 10 s | 3 (0.5 s, 1 s, 2 s backoff) | 4 | Batch coordinates; stay ≪ 2,000 call-equivalents/day |
| NASA POWER | 30 s | 3 | 3 | One request per point; cache history |
| OpenWeather | 8 s | 2 | ≤ 30 req/min | Free tier 60/min |
| data.gov.in | 30 s | 3 | 2 | Personal key required |
| agmarknet pkg | package default | 2 outer | 1 | ≤ 31-day windows |
| CEDA | 30 s | 3 | 1 | — |

- **Circuit breaker (per run):** after 5 consecutive failures from a provider, stop calling it for the rest of that run; mark the run `partial`.
- **Fallback order** follows the routing table (§4.2). When a fallback supplies a value: `degraded=true`, confidence capped at `medium`.
- **API degradation ladder:** fresh → **stale** (serve last good data with `stale=true` and `as_of`) → error response only if that location/series has **never** had data.
- **Freshness thresholds** (for the `stale` flag): current > 3 h, forecast > 12 h, mandi latest > 36 h.
- **Call budget:** 30–60 tracked grids × 4 runs/day → 1–2 batched Open-Meteo calls per run (≪ limit) + ≤ 60 OpenWeather calls/run (OK) + ≤ 60 POWER calls/day (OK).

---

## 13. Storage budget, retention, security

**Estimates (verify after week 1 with the query below):**

| Component | Rows | Est. size/row (table+indexes) | Annual |
|---|---|---|---|
| Tier A mandi (6 crops × tracked states) | ~1–3k/day | ~300–400 B | ~150–450 MB/**year at full national retention** — see below, this is why Tier B is capped |
| Tier B mandi (`mandi_watch`, capped at 300 tracked pairs) | ≤ 300/day once at steady state | ~300–400 B | **≤ ~45 MB/year**, bounded regardless of usage growth |
| Weather (all sources, all tracked+graduated grids) | ~50–300 grids × 3 sources × 365 | ~150 B | **< 40 MB/year** even at the higher 300-grid cap |

**Why Tier B is a live+cache design and not a full national ingest:** the full daily Agmarknet feed is **~16,000 rows/day across all commodities and all of India**. Even keeping only a **90-day rolling window** of that — no long history, no deep backfill — is **~1.4M rows ≈ 450–550 MB**, which alone exceeds or exhausts the entire Supabase Free 500 MB cap before Tier A, weather, or the advisory tables get a single byte. That number is the actual reason §2.1 and §9.5 route Tier B through live pass-through + a bounded, LRU-evicted watch list instead of "just ingest everything" — it isn't caution for its own sake, it's the arithmetic. **Never remove the scope filter on the scheduled Tier A ingest job**, and never let `MANDI_WATCH_MAX_TRACKED` grow unbounded without re-checking this math.

```sql
select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_catalog.pg_statio_user_tables order by pg_total_relation_size(relid) desc;
select pg_size_pretty(pg_database_size(current_database()));
```

**Retention (`prune` job):** OpenWeather rows > 14 days; `weather_daily` forecast rows for dates older than 30 days; `ingestion_runs` > 90 days; **Tier A** mandi rows > 3 years (archive to CSV first if ever needed); **Tier B** mandi rows (commodity/market pairs not in `tracked_scope.yaml`) > 90 days regardless of `mandi_watch.tracked`; `mandi_watch` rows with `tracked=false` and `last_requested_at` > 180 days ago (stats no longer useful). Enforce `MANDI_WATCH_MAX_TRACKED` (default 300) by evicting the least-recently-requested row whenever a new one would exceed it (§9.5). Alert in `/api/health/data` if DB size > 400 MB.

**Security:** RLS deny-by-default on all new tables (§5). Service-role key exists only in backend env vars and GitHub Actions secrets — never in the frontend or logs. `upsert_mandi_prices` is executable by `service_role` only. Rate-limit public endpoints per IP (e.g., 60/min) to protect the on-demand weather path.

---

## 14. Frontend integration (Next.js)

Use whatever chart library the project already uses (found in Phase 0). Do not add a new one.

- `lib/api/market.ts`, `lib/api/weather.ts`: typed fetchers mirroring the Pydantic schemas (§10). Central error handling.
- **PriceTrendChart** — modal price as the main line; min/max as a light band; `null` days render as **gaps** (no interpolation); range toggle 7 / 30 / 90; tooltip shows date, modal/min/max, source. Empty state: "No price reports for this period."
- **PriceContextHeader** — latest modal price (₹/quintal), 7-day and 30-day % change, `coverage` ("25 of 30 days reported").
- **WeatherStrip** — 7 past + today + 7 future days; per-day **confidence badge** (high / medium / low) with tooltip explaining disagreement (from `disagreement`); footnote "area-average estimate (~10–25 km)".
- **DataFooter** — attribution (§19), `as_of` time, and a "showing last available data" notice when `stale` or `degraded`.
- **Advisory hook:** the advisory/RAG service imports `app.data.weather.service.get_summary(location)` directly (no HTTP hop) and **must** pass `confidence`, `primary_source`, and `metrics` into its prompt context, honoring the low-confidence rule in §4.2.
- Mobile-first layouts (farmers use phones); loading skeletons; no layout shift when data arrives.

---

## 15. Testing and observability

**Unit tests (no network; fixtures recorded from real responses on first run and committed under `tests/fixtures/<provider>/`):**
- Mandi: canonicalization (aliases, unmapped commodity dropped, unmapped market kept); quality flags; `dedupe_by_key`; priority rule (lower priority never overwrites higher; equal priority → latest wins) tested against a real Postgres (Supabase local or a test schema); date spine + gaps.
- Weather: NASA POWER fill value → `None`; OpenWeather 3-hour → daily aggregation across the IST date boundary; Open-Meteo batch response parsing (list of locations); forecast response split into `recent`/`forecast`; fusion cases: (a) all agree → `high`; (b) precip bucket mismatch → `low`; (c) primary missing → fallback + `degraded` + `medium`; (d) no validators → `medium`; (e) wide model spread → `medium`; (f) metrics inherit lowest confidence.
- API: contract tests validate responses against the Pydantic schemas; **provider-outage tests** (force each provider to raise) must produce `degraded`/`stale` responses, never a 500.

**Observability:** `ingestion_runs` + `/api/health/data`; log structured JSON (job, provider, duration, rows, status); each weather run writes disagreement rates per variable into `notes` (used to tune tolerances after ~2 weeks).

**CI:** on PR, run lint + unit tests; no live network calls in CI.

---

## 16. Risks and known limitations

| Risk / limitation | Impact | Mitigation |
|---|---|---|
| All mandi sources share one origin (Agmarknet) | No independent verification of prices | Sanity flags + provenance; be honest in UI |
| Mandis report irregularly | Gaps in charts | Date spine with nulls; coverage indicator |
| `agmarknet` package is new/unofficial | May break | Pin version; vendored fallback client (§8.2); CEDA for older data |
| data.gov.in historical queries unreliable; demo key caps at 10 rows | Missing/incomplete ingest | Personal key; demo-key detector; correct pagination |
| CEDA refreshes monthly | Recent window empty | Route recent window to `agmarknet` package |
| Market/commodity name mismatches across sources | Duplicate series | Config alias maps + unmapped-name report each run |
| Reanalysis/gridded rainfall is an area average and can be biased in monsoon convection | Farm-level rain can differ | "Area estimate" copy; confidence badges; Phase 6 IMD gridded comparison |
| NASA POWER is coarse and has 2–7 day latency | Weak as a primary | Validator/fallback only |
| Open-Meteo free tier is non-commercial | License change if monetized | Attribution now; revisit before any commercial use |
| OpenWeather data is share-alike (ODbL) | Republishing risk | Transient validator, 14-day retention |
| Supabase Free 500 MB + 7-day idle pause | Data cap / app outage | Scope filter, retention, daily keep-alive job, size alert |
| Tier B (`mandi_watch`) usage grows faster than expected, or the LRU cap is raised without re-checking §13's math | Storage creep toward the 500 MB cap | Cap is config, not code — raise it deliberately, not accidentally; `/api/health/data` DB-size alert catches drift either way |
| A popular Tier B search never "settles" (constant eviction/re-graduation churn) | Wasted live-lookup calls, slightly stale Tier B data | Not harmful — the live-lookup-on-miss path (§9.5) always serves *today's* price correctly even while churning; only the "recent trend" depth suffers |
| GitHub Actions: default-branch-only cron, delays, 60-day inactivity disable, possible geo/IP blocks | Missed runs | Idempotent jobs, `workflow_dispatch`, smoke test in Phase 1, Mac/self-hosted fallback |
| ERA5 preliminary values can be revised slightly months later | Tiny differences | Accepted; not worth a job |
| `crop_cost_reference` is annual survey data — can lag the current season by a year+ | Margin estimate uses a stale cost baseline | `cost_year` always shown in the response/UI; never silently implied as current |
| Storage estimator's "typical price change" is historical, not predictive | Could be misread as a forecast | Hedge-forward UI copy required (§9b.2) — same discipline as MandiLens's own outlook language |

---

## 17. Inputs needed from the user (ask once, at the end of Phase 0)

| # | Question | Default if not answered |
|---|---|---|
| 1 | The 6 advisory crops (exact names as used in the advisory module) | Read them from the existing advisory/RAG config; if not found, stop and ask |
| 2 | Tracked states (and any priority mandis) | The state(s) already used in the current market feature |
| 3 | Is a **personal** data.gov.in API key set (`DATA_GOV_IN_KEY`)? | Assume yes; run the demo-key detector |
| 4 | Where does FastAPI run (Vercel serverless / other)? | Assume stateless design (already the case) |
| 5 | Which chart library and market UI components already exist? | Found in Phase 0 |
| 6 | Ship Tier B (Explore — any crop, any state) in the same build as Tier A, or after Tier A is validated? | After — see Implementation Plan Phase 2B/3B, so the core advisory feature ships first |
| 7 | `MANDI_WATCH_MAX_TRACKED` — keep the default of 300? | 300 (re-check §13's math before raising) |

Persist the answers in `config/tracked_scope.yaml`:
```yaml
# EXAMPLE values — replace with the answers above
crops:
  - key: onion
    display: Onion
    aliases: ["Onion"]
  - key: tomato
    display: Tomato
    aliases: ["Tomato"]
states: ["Maharashtra"]
priority_markets:
  Maharashtra: ["Lasalgaon", "Pune"]
market_aliases:
  Maharashtra:
    Lasalgaon: ["Lasalgaon", "Lasalgaon(Niphad)"]   # discover real variants from the first unmapped-names report
```

---

## 18. Environment variables

| Variable | Used by | Required |
|---|---|---|
| `SUPABASE_URL` | API + jobs | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | API + jobs (server-side only) | yes |
| `DATA_GOV_IN_KEY` | mandi live + detector | yes (personal key) |
| `OPENWEATHER_API_KEY` | OpenWeather adapter | yes (existing key) |
| `CEDA_API_KEY` | CEDA adapter | optional (CSV path works without it) |
| `WEATHER_ONDEMAND_MAX_NEW_GRIDS` | on-demand cap | optional (default 50) |
| `LOG_LEVEL` | all | optional |

Provide `.env.example` with these names and no values. Mirror the secrets in GitHub Actions secrets and (for the API) in the hosting provider's env settings.

---

## 19. Attribution and licensing (must appear in the UI footer / docs)

- **Prices:** "Source: Agmarknet, Directorate of Marketing & Inspection, Government of India (agmarknet.gov.in), via data.gov.in. Prices are reported by APMC mandis and are indicative only." Agmarknet permits free reuse if reproduced accurately, not in a misleading context, and with the source acknowledged; do not present it as legally authoritative.
- **CEDA data:** acknowledge CEDA, Ashoka University, when historical series derived from it are shown.
- **Open-Meteo:** attribution required (CC BY 4.0) — confirm wording on open-meteo.com/en/licence.
- **NASA POWER:** CC BY 4.0 — cite per power.larc.nasa.gov/docs/referencing/.
- **OpenWeather:** used only as a transient cross-check; do not republish its data.

---

## 20. References
- data.gov.in Agmarknet resource id and pagination/demo-key behavior — github.com/herrrickshaw/agri-commodity-tracker (README, provenance notes)
- `agmarknet` package — pypi.org/project/agmarknet/
- CEDA — agmarknet.ceda.ashoka.edu.in (README for field schema), api.ceda.ashoka.edu.in, ceda.ashoka.edu.in/data-portal
- Open-Meteo — open-meteo.com/en/docs (forecast API, `past_days` 0–92, `models`, ET₀ and soil variables), open-meteo.com/en/docs/historical-weather-api, open-meteo.com/en/features
- ERA5-Land — essd.copernicus.org/articles/13/4349/2021/
- NASA POWER — power.larc.nasa.gov/llms.txt (endpoints, latency 2–7 days, coverage, CC BY 4.0), power.larc.nasa.gov/parameters/
- OpenWeather — openweathermap.org/price, docs.openweather.co.uk/our-initiatives/student-initiative
- Vercel cron limits — vercel.com/docs/cron-jobs/usage-and-pricing
- Supabase Free-tier limits (500 MB DB, 7-day idle pause) — supabase.com/pricing
- IMD gridded data via `imdlib` — imdlib.readthedocs.io; IMD API access — mausam.imd.gov.in/responsive/apis.php
- ERA5-Land vs MERRA2 (NASA POWER's meteorology base) precipitation accuracy, Tamil Nadu 2003–2014 — egusphere.copernicus.org/preprints/2024/egusphere-2024-2369 (ERA5-Land best-performing; MERRA2 worst, across the districts tested)
- ERA5 vs NASA POWER vs IMD Gridded rainfall for paddy-yield prediction, middle Gujarat — plantarchives.org (mixed results by district — informed the "no universal winner" framing in §3.3)
- DES Cost of Cultivation Scheme (§9b.1) — desagri.gov.in/document-report-category/cost-of-cultivation-production-estimates/, mirrored under an open license via indiadataportal.com
- Competitor review informing §9b — mandilens.vercel.app (and its `/compare` tool, see `Architecture_Frontend.md` §2) and iti-h.com/services/price-discovery/mandi-prices-india (margin/storage calculators, market-level weather, no visible sourcing on their mandi dashboard)

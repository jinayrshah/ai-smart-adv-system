# Implementation Plan — Mandi Price + Weather Data Layer (v2)

**Project:** Smart Crop Advisory System · **Stack:** Next.js + FastAPI + Supabase · **Date:** 2026-09-28
**Companion file:** `Architecture_MarketData_Weather.md` — the source of truth for design. This file is the task runbook. **If the two disagree, the architecture file wins.**
Put both files in the repo under `docs/data-layer/`.

---

## Kickoff prompt (paste this into Antigravity once)

```
You are implementing the mandi-price + weather data layer for my Smart Crop Advisory System.

1. Read docs/data-layer/Architecture_MarketData_Weather.md and docs/data-layer/Implementationplan_MarketData_Weather.md completely.
2. Follow the operating rules in Architecture §0 (free-only, no invented endpoints, no fake data, branch from dev, one PR per phase).
3. Start with Phase 0 (recon only, NO code changes). When done, show me docs/data-layer/recon.md and the questions from Architecture §17, then STOP and wait.
4. Do not start a phase until I say "go phase N". Each phase = branch feature/data-layer-phase-N from dev, small commits, one PR into dev, and every acceptance check in that phase must pass before you report done.
5. Never ask me anything that is answered in these two files.
```

---

## What changed from v1 (so nothing is applied twice)

| v1 said | v2 says | Why |
|---|---|---|
| Unique key `(market, commodity, variety, arrival_date)` | Unique key `(state, district, market, commodity, variety, grade, arrival_date)`, all `NOT NULL` | Market names repeat across states and grades differ; nullable keys don't dedupe in Postgres |
| CEDA is the primary backfill | `agmarknet` package is primary for the **last 0–60 days**; CEDA is for **older history** | CEDA refreshes monthly, so it lags exactly the window you need first |
| data.gov.in can query past dates | Do **not** rely on it for history | Public reports conflict; the demo key also caps at 10 rows |
| `openmeteo-requests` SDK | Plain `httpx` + JSON | Async, batchable, simple fixtures |
| NASA POWER optional | Included as validator + baselines + fallback | Your decision |
| A phrase about a "cowork-plugin-style Next.js pattern" and Recharts | Removed. Use the chart library already in the repo | That phrase was wrong; the chart library is unknown until Phase 0 |
| `api.report(start=Timestamp…)` | `api.report(from_date="YYYY-MM-DD", to_date="YYYY-MM-DD", …)` strings | Matches the package docs |
| No scheduler design | GitHub Actions cron | Vercel Hobby cron is once/day and imprecise |

---

## Manual steps for Jinay (Antigravity cannot do these)

- [ ] Register a **personal** data.gov.in API key (the demo key caps at 10 rows/request). Set `DATA_GOV_IN_KEY`.
- [ ] Add GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_GOV_IN_KEY`, `OPENWEATHER_API_KEY` (and `CEDA_API_KEY` if you get one).
- [ ] Register for a CEDA API key at `api.ceda.ashoka.edu.in` (optional — the CSV path works without it).
- [ ] Apply to OpenWeather's **Student Initiative** (college email + student ID). Not required for this build; unlocks 1-year OpenWeather history later.
- [ ] Start the **IMD API** access request (institutional approval, takes time). Not blocking.
- [ ] After Phase 3, spend ~10 minutes checking `locations_review.csv` (30–60 rows) and flip `verified=true`.

---

## Phase 0 — Reconnaissance (NO code changes)

**Do**
1. Inspect the repo and record in `docs/data-layer/recon.md`:
   - The existing data.gov.in fetcher (file, function, filter-key syntax, field names, env var name, page size used).
   - Existing DB table(s)/columns holding accumulated market history, and row counts.
   - The OpenWeatherMap service (file, endpoints used, env var).
   - The market-analysis API route(s) and frontend components; the chart library in use.
   - How FastAPI is deployed (`vercel.json`, Dockerfile, `render.yaml`, etc.), Python version, package manager, test setup.
   - Whether the frontend queries Supabase directly for market data.
2. Produce an **Existing → Target mapping table** (existing file → module in Architecture §7) and a **Deviations** list.
3. Ask the user the questions in Architecture §17 (once).

**Acceptance**
- [ ] `recon.md` exists with the mapping table and deviations.
- [ ] User answered §17; answers saved to `config/tracked_scope.yaml`.
- [ ] `git diff` shows no code changes.

---

## Phase 1 — Foundation + live mandi ingest

**Tasks**
- [ ] Migration `supabase/migrations/<ts>_data_layer.sql` from Architecture §5 (tables, view, `upsert_mandi_prices` RPC, RLS, grants).
- [ ] If an old market-history table exists: one-off data migration into `mandi_prices` (`source='datagov_live'`, priority 100). Keep the old table until Phase 2 is accepted.
- [ ] Core: `core/config.py`, `core/http.py`, `core/timeutil.py` (`today_ist()`), types (§6).
- [ ] `config/tracked_scope.yaml` loader; `canonical.py` (aliases, unmapped reporting).
- [ ] Wrap the **existing** data.gov.in fetcher as `sources/datagov_live.py` per Architecture §8.1 (scope loop, offset-by-returned-length pagination, demo-key detector).
- [ ] `validate.py` (quality flags), `reconcile.py` (dedupe within batch), `repository.py` (RPC in chunks of 1000), outlier-flag SQL.
- [ ] `jobs/ingest_mandi_daily.py` writing `ingestion_runs`.
- [ ] Workflow `ingest-mandi.yml` with **`workflow_dispatch` only** for now (add the cron lines in Phase 2 once the workflow is on `main`).

**Acceptance**
- [ ] Running the job twice in a row leaves the row count unchanged (idempotent).
- [ ] The job's `ingestion_runs.notes` contains an **unmapped-names report**; Antigravity shows it to the user and updates the alias maps after review.
- [ ] Demo-key detector triggers if the key is swapped for the public demo key (test with a mock).
- [ ] A `workflow_dispatch` run **from a GitHub-hosted runner** successfully reaches data.gov.in (reachability smoke test). If it can't, stop and report (fallback options in Architecture §11).
- [ ] Unit tests for canonicalization, flags, dedupe, and the priority rule (against a real Postgres).

---

## Phase 2 — Backfill + trend API + chart wiring

**Tasks**
- [ ] `sources/agmarknet_pkg.py` (`agmarknet==0.2.2`, ≤ 31-day windows, runtime column assertions, vendored-client fallback if the package breaks) — Architecture §8.2.
- [ ] `jobs/load_ceda_csv.py` and `jobs/load_kaggle_seed.py` (`sources/ceda.py` only after the user has a CEDA key and docs) — §8.3–8.4.
- [ ] `jobs/backfill_mandi.py --days N --source agmarknet_pkg|ceda_csv|kaggle`; run for **90 days** on tracked crops × tracked states via `agmarknet_pkg` first.
- [ ] **Coverage report** saved to `docs/data-layer/backfill_coverage.md`: for each tracked crop × top markets, days available in the last 30/90 days; list markets with < 50% coverage.
- [ ] `series.py` (date spine + gaps) and `GET /api/market/trend` (Architecture §10.1). Keep the existing latest-prices endpoint's contract unchanged.
- [ ] Frontend: `lib/api/market.ts`, PriceTrendChart, PriceContextHeader, DataFooter (Architecture §14) using the **existing** chart library; gaps render as gaps; range toggle 7/30/90.
- [ ] Add the `schedule:` cron lines to `ingest-mandi.yml` (takes effect after merge to `main`).
- [ ] Remove any remaining fake/dummy history code paths if the recon found leftovers.

**Acceptance**
- [ ] For each tracked crop, the 30-day chart for at least one major mandi shows **real** data with source mix visible in the API response.
- [ ] Backfill is idempotent (re-run changes nothing) and lower-priority sources never overwrite higher-priority rows (test).
- [ ] Coverage report committed; gaps show as gaps in the chart.
- [ ] After the PR merges to `main`, the scheduled workflow runs once successfully.
- [ ] Old history table (if any) is now redundant; propose dropping it in a **separate** PR.

---

## Phase 2B — Mandi Explore tier (any crop, anywhere in India)

Do this only after Phase 2's acceptance checks pass — it reuses that code, don't start it in parallel.

**Tasks**
- [ ] Add `mandi_watch` table (Architecture §5) via a new migration.
- [ ] `service.py`: `get_market_search()` — live-lookup-on-miss via the existing `sources/datagov_live.py` adapter (no new provider client), watch-list upsert, LRU eviction at `MANDI_WATCH_MAX_TRACKED` (default 300) — Architecture §9.5.
- [ ] `GET /api/market/search?state=&commodity=&market=` (Architecture §10.1) — response includes `tier` and `history_available`.
- [ ] Extend `jobs/ingest_mandi_daily.py`'s scope to `tracked_scope.yaml` **union** `mandi_watch where tracked=true`, so graduated pairs get pulled daily without code changes.
- [ ] Extend `prune.py`: 90-day retention for non-advisory-crop rows regardless of watch status; stale untracked `mandi_watch` rows > 180 days.
- [ ] Frontend: a simple "search any crop/market" UI, clearly labeled as showing today's price (+ a short trend once one has accumulated), separate from the deep 6-crop advisory pages.

**Acceptance**
- [ ] Searching an untracked crop/state returns today's price within a few seconds (live call) and the pair appears in `mandi_watch` afterward.
- [ ] Searching the same pair again same day is fast (served from `mandi_prices`, no repeat live call).
- [ ] After the LRU cap is exceeded (test with a lowered cap, e.g. 5), the least-recently-searched pair flips to `tracked=false` and stops appearing in the next `ingest_mandi_daily` run.
- [ ] Storage check (§13 query) confirms Tier B's actual footprint is in the tens-of-MB range, not hundreds.

---

## Phase 3 — Weather

**Tasks**
- [ ] `locations` seeding: `jobs/build_locations.py` (geocode via Open-Meteo, `verified=false`), output `locations_review.csv`; `grid.py` (`snap_to_grid`).
- [ ] Providers per Architecture §8.5–8.7: `open_meteo.py` (forecast+recent, spread, archive, normals), `nasa_power.py`, `openweather.py` (free endpoints only; 3-hour → daily aggregation).
- [ ] `repository.py` for `weather_daily`, `weather_daily_fused`, `weather_current`, `weather_normals_monthly`.
- [ ] `config/fusion.yaml` + `fusion.py` (routing, tolerances, confidence, re-fusion) — Architecture §4.2 and §9.2. Pure functions, fully unit-tested.
- [ ] `agro.py` metrics (§9.3).
- [ ] Jobs: `ingest_weather.py`, `reconcile_recent.py`, `power_validate.py`, `refresh_normals.py`; workflows with `workflow_dispatch` first, then cron per Architecture §11.
- [ ] `service.py` (`get_current/get_forecast/get_history/get_summary`) and routes `/api/weather/*` (§10.2), incl. the on-demand path with the 50-new-grids/day cap.
- [ ] Replace the existing OpenWeather-only calls in the advisory flow with `get_summary()`; pass `confidence`, `primary_source`, `metrics` into the advisory prompt context and enforce the low-confidence rule (Architecture §4.2).
- [ ] Frontend: `lib/api/weather.ts`, WeatherStrip with confidence badges and "area estimate" copy.

**Acceptance**
- [ ] For 3 sample locations, `/api/weather/summary` returns 7 past + today + 7 future days with `confidence`, `primary_source`, `validators` populated.
- [ ] Fusion unit tests cover all six cases in Architecture §15 and pass.
- [ ] Fixtures recorded from real responses for all three providers; parsing tests pass offline.
- [ ] **Outage test:** forcing Open-Meteo to fail yields a `degraded`/`stale` response (fallback to OpenWeather/POWER), never a 500.
- [ ] NASA POWER fill values never reach the DB as numbers.
- [ ] `reconcile_recent` replaces `recent` rows with `archive` rows for dates older than 6 days and re-fuses (test with fixtures).
- [ ] Normals exist for every tracked grid; `rain_30d_vs_normal_pct` computes without error.
- [ ] Two weeks after go-live: disagreement rates per variable from `ingestion_runs.notes` reviewed with the user; tolerances in `fusion.yaml` tuned.

---

## Phase 3B — Weather Explore tier (any location in India)

Phase 3's on-demand path (Architecture §9.4) already does most of this — this phase formalizes it as a first-class feature rather than an edge case.

**Tasks**
- [ ] Confirm the on-demand path skips NASA POWER/OpenWeather on the synchronous request (Open-Meteo only) and writes `confidence='medium'` regardless of §9.2's normal rules, per §9.4.
- [ ] Raise `WEATHER_ONDEMAND_MAX_NEW_GRIDS` from any Phase-3 placeholder to **300/day**.
- [ ] Confirm a newly-graduated grid (`locations.tracked=true`) is picked up by the very next scheduled `ingest_weather` run and gets full fusion treatment from then on.
- [ ] Frontend: "Explore" weather entry point (search any place in India) reusing the WeatherStrip component; show the `medium`-confidence badge honestly on a just-graduated location's first day.

**Acceptance**
- [ ] Requesting weather for a fresh, untracked location returns within the 8 s timeout, single-source, `confidence=medium`.
- [ ] The same location, queried again the next day (after a scheduled run), shows full fusion (`confidence` reflecting real validator agreement, `validators` populated).
- [ ] Exceeding the daily new-grid cap in a test serves the nearest tracked grid with `degraded=true` instead of failing.

---

## Phase 4 — Context layer (price ↔ weather)

**Tasks**
- [x] `GET /api/context/market-weather` (Architecture §10.4): price block + weather block for the market's district grid + ≤ 3 rule-based `signals[]` from config.
- [x] UI: a compact "Context" card on the market page. Signals are descriptive only — never phrased as predictions.

**Acceptance**
- [x] Endpoint returns coherent price and weather blocks for a tracked market; `signals` carry their evidence numbers.
- [x] Copy reviewed: no wording implies a price forecast.

---

## Phase 4B — Margin & storage calculators, market-level weather

**Tasks**
- [x] Migration: `crop_cost_reference`, `crop_storage_reference` (Architecture §9b).
- [x] One-time load job for `crop_cost_reference` from the DES Cost of Cultivation dataset, scoped to tracked crops × tracked states — this is manual sourcing/verification work (which year, which exact DES release), not a live API pull.
- [x] Populate `crop_storage_reference` by hand for the 6 tracked crops (`storable`, `max_storage_days`, loss rate) — sourced from the same PoP documents already in use for the advisory layer, not invented.
- [x] `GET /api/market/margin` and `GET /api/market/storage-estimate` (Architecture §9b, §10.1).
- [x] Wire `locations.kind='mandi'` through to `weather.service.get_summary()` for a market-level weather panel (§9b.3) — no new backend code, just a new call site.

**Acceptance**
- [x] Margin endpoint returns `null` with a clear reason for a crop/state combo with no cost data on file, never a fabricated number.
- [x] Storage endpoint correctly refuses non-storable crops rather than estimating something meaningless.
- [x] `cost_year` is present and surfaced in every margin response.

---

## Phase 5 — Hardening

**Tasks**
- [ ] `/api/health/data` (Architecture §10.3) and staleness flags on all endpoints.
- [ ] `prune.py` + weekly workflow (retention in Architecture §13); DB-size alert at 400 MB.
- [ ] `ci.yml`: lint + unit tests on PRs, no live network.
- [ ] Per-IP rate limit on public endpoints.
- [ ] RLS verified: anon key cannot read or write any new table.
- [ ] Docs: update `README` with the job list, secrets, and how to run each job locally.

**Acceptance**
- [ ] Health endpoint flips to `degraded` when a job is artificially stale.
- [ ] Storage check query run; size recorded in `recon.md`.
- [ ] A fresh clone can run `python -m jobs.ingest_mandi_daily` locally with only `.env` filled from `.env.example`.

---

## Phase 6 — Optional accuracy upgrades (do only if asked)

- IMD gridded rainfall (`imdlib`, yearly `.grd` files) as an **offline** comparison to measure rainfall bias of Open-Meteo/POWER for your grids; results inform `fusion.yaml` tolerances. Not in the live path (yearly release lag; the IMD portal has been unstable).
- IMD official API once access is approved (add as an adapter + validator with its own priority).
- OpenWeather Student Initiative historical data as an additional validator.
- NASA POWER soil-wetness parameters (confirm names in the Parameter Dictionary first).
- A new data source later (for example, a field sensor) = one adapter + one priority row; no schema redesign.

---

## Definition of done (whole project)

- [ ] Trend charts show real history for every tracked crop; new days appear automatically.
- [ ] Weather shows current, 7-day forecast, and 30-day history with confidence, from Open-Meteo, validated by NASA POWER and OpenWeather.
- [ ] Any single provider outage degrades the response instead of breaking it.
- [ ] Nothing synthetic anywhere; every value has a source.
- [ ] All jobs idempotent and visible in `ingestion_runs` / `/api/health/data`.
- [ ] DB stays well under the Supabase Free 500 MB cap.
- [ ] A farmer can look up **any crop, any market in India** for today's price, and **weather for any location in India**, without leaving the app — both clearly labeled as lighter-depth (Explore) versus the 6 deep-advisory crops.
- [ ] Tier B never risks the storage budget: `mandi_watch` stays capped, non-advisory-crop history stays short-retention, and this is verified against real numbers, not assumed.

# 🌾 AI Smart Agriculture Advisory System

An intelligent agricultural platform providing multi-source weather fusion, real-time and historical mandi market price discovery across India, rule-based crop-weather contextual intelligence, and crop margin & hold-vs-sell storage calculators.

---

## 🏗️ Architecture & Data Layer Overview

The system combines a **React + Vite** frontend (proxied via Node/Express) and a high-performance **FastAPI** backend backed by **Supabase (PostgreSQL)**.

1. **Market Data Layer:**
   - **Tier A (Advisory):** 6 key crops (Wheat, Rice, Maize, Sugarcane, Potato, Cotton) across 7 tracked states (Gujarat, Maharashtra, UP, Punjab, MP, Karnataka, Rajasthan) with continuous date-spine history.
   - **Tier B (Explore):** Any commodity at any mandi in India with live lookups, automatic graduation into daily tracking, and LRU eviction at a 300-pair cap.
2. **Weather Fusion Layer:**
   - Multi-source fused forecast and archive (Open-Meteo as primary, cross-checked against NASA POWER and OpenWeather).
   - Real-time agreement metrics, sensor confidence ratings (`high`, `medium`, `low`), and 0.1° (~10 km) geographic grid snapping.
3. **Context Layer:**
   - Synthesizes market price volatility, coverage, and recent rainfall/heat anomalies to generate factual, non-predictive operational advisories.
4. **Economic Calculators:**
   - **Crop Margin Calculator:** Uses official DES Cost of Cultivation benchmarks (C2 and A2+FL).
   - **Storage Estimator:** Models monthly warehouse holding fees vs. moisture shrinkage weight loss, and explicitly refuses non-storable crops (Sugarcane, Tomato).

---

## 🛠️ Background Jobs & Pipelines

| Job Script | Schedule (UTC) | IST Time | Purpose |
|---|---|---|---|
| `python -m jobs.ingest_mandi_daily` | `0 10 * * *`<br>`0 16 * * *` | 15:30<br>21:30 | Fetches data.gov.in mandi arrivals, canonicalizes, validates, and upserts. |
| `python -m jobs.ingest_weather` | `15 0,6,12,18 * * *` | 05:45, 11:45,<br>17:45, 23:45 | Daily weather forecast + recent observations fusion across all tracked grids. |
| `python -m jobs.reconcile_recent` | `30 2 * * *` | 08:00 | Reconciles recent 14-day weather with Open-Meteo ERA5 archive. |
| `python -m jobs.power_validate` | `0 3 * * *` | 08:30 | Fetches NASA POWER solar radiation and rainfall to validate fusion data. |
| `python -m jobs.prune` | `0 20 * * 6` | Sun 01:30 | Enforces retention (14d OpenWeather, 30d forecast, 90d explore, 3y Tier A, 90d runs) and audits 400 MB storage cap. |
| `python -m jobs.load_reference_data` | Manual / One-time | — | Loads and seeds DES Cost of Cultivation and WDRA storage parameters into Supabase. |
| `python -m jobs.refresh_normals` | Manual | — | Recomputes 30-year monthly normals for newly enrolled weather grids. |

---

## 🔐 Environment Variables & Secrets

Copy `.env.example` to `.env` in the repository root:

```ini
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Market Data
DATA_GOV_IN_KEY=your-personal-datagov-api-key
CEDA_API_KEY=your-ceda-api-key

# Weather
OPENWEATHER_API_KEY=your-openweather-api-key
WEATHER_ONDEMAND_MAX_NEW_GRIDS=300

# AI / Gemini
GEMINI_API_KEY=your-gemini-api-key

# Logging
LOG_LEVEL=INFO
```

---

## 🚀 How to Run Locally

### 1. Start the FastAPI Backend (Port 8000)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the Frontend & Express Proxy (Port 3000)
```bash
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

For quick reference to all browser links, ports, and curl examples, see [**`LOCAL_DEV_GUIDE.md`**](LOCAL_DEV_GUIDE.md).

---

## 🧪 Testing

```bash
# Backend test suite (74 tests covering API contracts, calculators, and ops):
cd backend && .venv/bin/pytest tests/ -v

# Frontend TypeScript check and production build:
npx tsc --noEmit
npm run build
```

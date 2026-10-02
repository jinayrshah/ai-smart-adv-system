# Phase 0 — Reconnaissance Report: Mandi Price + Weather Data Layer

**Project:** Smart Crop Advisory System  
**Date:** 2026-10-02  
**Branch:** `dev`  
**Status:** Accepted & Ready for Phase 1  

---

## 1. Existing System Inspection

### 1.1 data.gov.in Fetcher
- **File:** [`server.ts`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/server.ts) (lines 1101–1189)
- **Functions:** Express handler `app.get('/api/market')`, `fetchMarketWithRetry(url, retries)`
- **Resource ID:** `9ef84268-d588-465a-a308-a864a43d0070`
- **Filter-key syntax:** `filters[state]`, `filters[district]`, `filters[commodity]`
- **Record field names:** `state`, `district`, `market`, `commodity`, `variety`, `grade`, `arrival_date` (format: `DD/MM/YYYY`), `min_price`, `max_price`, `modal_price`
- **Environment variable:** `MARKET_API_KEY` (mapped to `DATA_GOV_IN_KEY` in target)
- **Page size used:** `limit=100` (in `/api/market`) and `limit=10` (in `/api/market/insight`)
- **Pagination issue in existing code:** Offset is hardcoded to `0` without paginating past page 1. Target architecture (§8.1) advances offset by `len(records)` returned until complete.

### 1.2 Existing DB / Storage for Accumulated Market History
- **Storage medium:** Local disk JSON file [`data/market_price_history.json`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/data/market_price_history.json)
- **Row count:** 1,796 records
- **Data schema:** Exact match with target `MandiRecord`:
  - `state`, `district`, `market`, `commodity`, `variety`, `grade`, `arrival_date`, `min_price`, `max_price`, `modal_price`
- **Target migration:** Phase 1 includes `jobs/migrate_legacy_history.py` to ingest all 1,796 rows into Supabase `mandi_prices` table with `source='datagov_live'`, `source_priority=100`.

### 1.3 OpenWeatherMap Service
- **Files:** [`src/hooks/useAgricultureDashboard.ts`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/src/hooks/useAgricultureDashboard.ts), [`src/hooks/useLocation.ts`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/src/hooks/useLocation.ts), [`src/components/ChatWidget.tsx`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/src/components/ChatWidget.tsx), [`server.ts`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/server.ts) (lines 1018–1023)
- **Endpoints used:**
  - `api.openweathermap.org/data/2.5/weather` (current)
  - `api.openweathermap.org/data/2.5/forecast` (5-day / 3-hour forecast)
  - `api.openweathermap.org/geo/1.0/reverse` (reverse geocoding)
- **Environment variables:** `VITE_WEATHER_API_KEY`, `OPENWEATHER_API_KEY`
- **Target role:** Used as a transient cross-check validator for current + 5-day forecast. Primary weather shifts to Open-Meteo with NASA POWER independent validation.

### 1.4 Market Analysis API Routes, Frontend Components & Chart Library
- **Backend routes:** `GET /api/market` (data proxy), `GET /api/market/insight` (combines market data with Gemini AI summary)
- **Frontend components:** [`src/App.tsx`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/src/App.tsx) (Market Analysis view), [`src/services/marketService.ts`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/src/services/marketService.ts)
- **Chart library in use:** **Recharts** (`recharts@^3.8.0` in `package.json`, using `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`).
- **Verdict:** Keep Recharts for the Next.js target frontend (Architecture §14).

### 1.5 Backend & Deployment Environment
- **Runtime:** Python 3.12 / 3.14 (system has Python 3.14 installed; virtualenv configured at `backend/.venv`).
- **Framework:** FastAPI with Uvicorn and Pydantic v2.
- **Hosting target:** Railway (persistent server) for FastAPI backend; Vercel for Next.js frontend.
- **Package management:** `pip` + `backend/requirements.txt`.
- **Testing setup:** `pytest` + `pytest-asyncio`.

### 1.6 Frontend & Supabase Querying
- **Current state:** Frontend does **not** query Supabase directly for market data. All market data requests flow through the API.
- **Security adherence:** RLS deny-by-default on all Supabase tables. Only the FastAPI backend (using `SUPABASE_SERVICE_ROLE_KEY`) reads/writes data layer tables.

---

## 2. Existing → Target Mapping Table

| Existing File / Component | Target Module (Architecture §7) | Migration & Reuse Strategy |
|---|---|---|
| `server.ts` (lines 1101–1189) | `backend/app/data/mandi/sources/datagov_live.py` | Port data.gov.in fetch logic to Python `httpx`, implement offset pagination and demo-key detector. |
| `data/market_price_history.json` | `backend/jobs/migrate_legacy_history.py` → `mandi_prices` | One-off script in Phase 1 to seed 1,796 records into Supabase `mandi_prices`. |
| `server.ts` (weather proxy) & client hooks | `backend/app/data/weather/providers/openweather.py` | Server-side adapter aggregating 3-hour slots into IST daily values. |
| (None — new) | `backend/app/data/weather/providers/open_meteo.py` | Primary weather provider (current, 16-day forecast, 92-day past, ERA5-Land archive). |
| (None — new) | `backend/app/data/weather/providers/nasa_power.py` | Validator provider (agrometeorology parameters, fill value handling). |
| (None — new) | `backend/app/data/weather/fusion.py` | Pure-function fusion engine calculating consensus, disagreement, and confidence. |
| `server.ts` `/api/market` & `/api/market/insight` | `backend/app/api/routes/market.py` | FastAPI endpoints: `/api/market/prices/latest`, `/api/market/trend`, `/api/market/search`. |
| (None — new) | `backend/app/api/routes/weather.py` | FastAPI endpoints: `/api/weather/current`, `/api/weather/forecast`, `/api/weather/history`, `/api/weather/summary`. |
| `src/services/marketService.ts` | `frontend/lib/api/market.ts` | Typed fetcher client mirroring backend schemas. |
| Recharts in `src/App.tsx` | `frontend/components/market/PriceTrendChart.tsx` | Reusable chart rendering modal price line, min/max range band, and gaps. |

---

## 3. Deviations & Resolutions

| # | Item | Deviation from Original Design | Resolution |
|---|---|---|---|
| 1 | Python Version | System runs Python 3.14.3; GitHub Actions runs Python 3.12 | Standard Python library and FastAPI/Pydantic packages are 100% compatible. `backend/requirements.txt` specifies tested version pins. |
| 2 | Legacy History Table vs File | Old history is stored in `data/market_price_history.json` rather than a Postgres table | `jobs/migrate_legacy_history.py` will read the JSON file directly and bulk upsert to Supabase via `upsert_mandi_prices` RPC. |
| 3 | data.gov.in Field Cases | Some responses return capitalized `State`, others `state` | Canonicalizer and adapter use case-insensitive dict access (`dict.get` with lowercased keys). |
| 4 | OpenWeather API Key | Key in `.env` is `4e5179f6c9c7554a1783e03e3403136e` | Configured as `OPENWEATHER_API_KEY` across `.env` and backend configs. |

---

## 4. §17 User Confirmations Summary

1. **6 Advisory Crops:** Wheat, Rice, Maize, Sugarcane, Potato, Cotton.
2. **Tracked States:** Gujarat, Maharashtra, Uttar Pradesh, Punjab, Madhya Pradesh, Karnataka, Rajasthan.
3. **Personal data.gov.in key:** Verified (`579b464db66ec23bdd00000169c8a6ecdbc442536f19d90506bd2ee5`).
4. **FastAPI host:** Railway (stateless persistent server).
5. **Chart library:** Recharts.
6. **Tier B rollout:** After Tier A core validation (Phase 2B / 3B).
7. **`MANDI_WATCH_MAX_TRACKED`:** 300.
8. **Supabase project:** Live and verified (`https://efpmgxokqcrzhnlgdptl.supabase.co`).

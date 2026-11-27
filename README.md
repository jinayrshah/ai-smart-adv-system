# Smart Agriculture Advisory System

Farm advice for Indian smallholders, grounded in their own field: crop stage, water need, which crops suit the field, local weather, mandi prices, official IMD bulletins and leaf checks. When data is missing the app says so instead of guessing.

## What a farmer gets

| Screen | What it does |
|---|---|
| **Today** | Crop stage on a season line (heat units / GDD), water advice (FAO-56 water balance), 3-day rain, nearest mandi price, soil notes, this week's IMD agromet advice for the district |
| **Advisor** | One chat that knows the farm. Answers are grounded in ICAR packages of practice, IMD bulletins and Kisan Call Centre Q&A; a camera button checks a leaf photo; a Schemes view covers PM-KISAN, PMFBY, KCC and more |
| **Prices** | Mandi price trend (rolling average of reports), market comparison, margin and hold-vs-sell calculators, any crop at any mandi |
| **Weather** | Fused 7-day past + 7-day forecast (Open-Meteo, cross-checked with NASA POWER and OpenWeather) with field-work insights |
| **Farm** | Field, crop, soil and account; farm setup shows **which crops suit this field** for each season, with reasons, and warns when the chosen crop is a poor fit |

Supported crops: wheat, rice, cotton, soybean, maize, tomato.

## Architecture

- **Frontend:** React + Vite + Tailwind (`src/`), served by an Express server (`server.ts`) that handles login and proxies `/api/*` to FastAPI.
- **Backend:** FastAPI (`backend/app`) with agronomy engines (growth stage, water balance, soil, climate, crop suitability), RAG retrieval (hybrid vector + keyword), and data layers for mandi prices and weather.
- **AI:** Groq (free tier) first, Gemini as fallback; every number in an answer is audited against the farm's data and sources. If no AI is reachable, answers are built from computed farm data and labelled.
- **Database:** Supabase Postgres with pgvector (`supabase/migrations/`).
- **Data sources:** Agmarknet / data.gov.in prices, Open-Meteo, NASA POWER, OpenWeather, IMD district agromet bulletins, ISRIC SoilGrids, Kisan Call Centre Q&A, ICAR packages of practice.

## Run locally

1. Copy `.env.example` to `.env` and fill in at least `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_GOV_IN_KEY`, `GROQ_API_KEYS` and `JWT_SECRET`.
2. Run every file in `supabase/migrations/` in the Supabase SQL editor (in name order).
3. Backend (port 8000):
   ```bash
   cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ..
   npm run dev:backend
   ```
4. Frontend (port 3000), in a second terminal:
   ```bash
   npm install
   npm run dev
   ```
5. Open http://localhost:3000 and create an account.

Check that the AI works: `PYTHONPATH=backend backend/.venv/bin/python -m jobs.check_ai`

## Scheduled data jobs (GitHub Actions)

Repository secrets needed: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_GOV_IN_KEY`, `OPENWEATHER_API_KEY`.

| Workflow | When (IST) | Job |
|---|---|---|
| `ingest-mandi` | 15:30, 21:30 daily | New mandi prices from data.gov.in |
| `ingest-weather` | 4x daily + morning reconcile | Weather fusion, archive reconcile, NASA POWER check, crop stage recompute |
| `ingest-agromet` | Tue and Fri 16:43 | IMD district agromet bulletins for every farm district |
| `prune` | Weekly | Retention limits |

Manual jobs: `jobs.load_ceda_csv` (load an Agmarknet / CEDA price export), `jobs.ingest_kcc` (Kisan Call Centre Q&A CSV), `jobs.ingest_document` (ICAR PDF), `jobs.load_advisory_reference`, `jobs.refresh_normals`.

## Tests

```bash
cd backend && .venv/bin/python -m pytest -q
npx tsc --noEmit && npm run build
```

## More

- [`docs/DEPLOY.md`](docs/DEPLOY.md): deploying to Vercel (frontend), Render (backend) and Supabase
- [`LOCAL_DEV_GUIDE.md`](LOCAL_DEV_GUIDE.md): every endpoint, port and curl example
- [`docs/ROADMAP_data_integrations.md`](docs/ROADMAP_data_integrations.md): next data sources (WhatsApp + voice, satellite crop health, groundwater, eNAM)
- Adding a crop: add its stages, Kc, soil, climate, seasons and water need to `backend/app/data/advisory/fixtures/crop_catalog.json` (with sources), then ingest its ICAR guide with `jobs.ingest_document`.

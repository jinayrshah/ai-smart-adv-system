# 🚀 Local Development & Quick Links Guide

Keep this file handy to quickly launch and test the application without searching through chat history.

---

## 🔗 Quick Links (Browser)

| Service | URL | Description |
|---|---|---|
| **Web UI (Frontend App)** | **[http://localhost:3000](http://localhost:3000)** | Full Web Application (Vite + React + Express proxy) |
| **FastAPI Backend Root** | **[http://localhost:8000](http://localhost:8000)** | Backend API root / health check |
| **Data Layer Health & Ops** | **[http://localhost:8000/api/health/data](http://localhost:8000/api/health/data)** | Live pipeline job statuses, age, and 400 MB storage telemetry |
| **Interactive API Docs (Swagger)** | **[http://localhost:8000/docs](http://localhost:8000/docs)** | Test all endpoints directly in the browser |
| **API Reference (ReDoc)** | **[http://localhost:8000/redoc](http://localhost:8000/redoc)** | Clean technical schema documentation |

---

## 🖥️ How to Run the App Locally

### Terminal 1: Start the Backend (FastAPI on Port 8000)
```bash
npm run dev:backend
```
*(Or directly: `cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`)*

### Terminal 2: Start the Web UI (Express + Vite on Port 3000)
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

*(Note: If you ever make edits to `server.ts` or experience a proxy issue, press `Ctrl+C` in Terminal 2 and re-run `npm run dev` to reload the Express routes).*

---

## 🧪 Quick Test Commands (Terminal)

### 1. Market Price Trend (7d / 30d / 90d)
```bash
curl -s "http://127.0.0.1:8000/api/market/trend?commodity=Wheat&market=Malegaon&state=Maharashtra&days=30"
```

### 1b. Grounded AI Market Insight (Gemini 2.5 Flash Synthesis)
```bash
curl -s "http://127.0.0.1:8000/api/market/insight?commodity=Wheat&market=Malegaon&state=Maharashtra&days=30"
```

### 1c. Latest Mandi Prices (with Outlier Quality Flag Filtering)
```bash
# Standard clean prices:
curl -s "http://127.0.0.1:8000/api/market/prices/latest?commodity=Wheat&state=Maharashtra&limit=5"

# Include statistical IQR outliers for audit:
curl -s "http://127.0.0.1:8000/api/market/prices/latest?commodity=Wheat&state=Maharashtra&limit=5&include_flagged=true"
```

### 2. Mandi Explore Tier (Any Crop, Anywhere in India)
```bash
curl -s "http://127.0.0.1:8000/api/market/search?commodity=Soyabean&state=Madhya%20Pradesh&market=Indore"
```

### 3. Unified Weather Summary (Current + 7d Past + 7d Future + Agro Metrics)
```bash
curl -s "http://127.0.0.1:8000/api/weather/summary?lat=20.0&lon=73.8"
```

### 4. Weather Explore Search (Any Village / Town in India)
```bash
curl -s "http://127.0.0.1:8000/api/weather/search?query=Nagpur"
```

### 5. Context Layer (Market Price ↔ Weather Signals)
```bash
curl -s "http://127.0.0.1:8000/api/context/market-weather?commodity=Wheat&market=Malegaon&days=30"
```

### 6. Phase 4B Crop Margin Calculator (DES Benchmark)
```bash
curl -s "http://127.0.0.1:8000/api/market/margin?crop=Wheat&state=Punjab&field_size_acres=2.5&price_per_qtl=2400"
```

### 7. Phase 4B Storage Estimator (Hold vs Sell & Non-Storable Refusal)
```bash
# Storable crop (Wheat):
curl -s "http://127.0.0.1:8000/api/market/storage-estimate?crop=Wheat&market=Khanna&state=Punjab&storage_cost_per_qtl_per_month=30&months=3&current_price=2200"

# Non-storable crop refusal (Sugarcane):
curl -s "http://127.0.0.1:8000/api/market/storage-estimate?crop=Sugarcane&market=Kolhapur&state=Maharashtra"
```

### 8. Phase 4B Mandi Logistics Weather (Market Arrival Disruption)
```bash
curl -s "http://127.0.0.1:8000/api/weather/summary?mandi=Malegaon&state=Maharashtra"
```

### 9. Load / Seed Reference Datasets (DES & WDRA)
```bash
cd backend && .venv/bin/python -m jobs.load_reference_data
```

### 10. Phase 5 Data Layer Health & Storage Telemetry
```bash
curl -s "http://127.0.0.1:8000/api/health/data"
```

### 11. Phase 5 Retention Prune & Storage Audit Job
```bash
cd backend && .venv/bin/python -m jobs.prune
```

### 12. Phase 1 Farmer Onboarding & Precision Agronomy (Advisory Layer)
```bash
# Complete multi-step onboarding (Profile + Farm with GPS & Soil Health Card + Deep Advisory Crop):
curl -s -X POST "http://127.0.0.1:8000/api/farmer/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Ramesh Patel",
    "preferred_language": "hi",
    "phone": "9876543210",
    "farm_name": "Kisan Farm 1",
    "lat": 20.02,
    "lon": 73.81,
    "soil_type": "Black Cotton (काली मिट्टी)",
    "shc_n": 180.0,
    "shc_p": 25.0,
    "shc_k": 150.0,
    "shc_ph": 7.2,
    "crop_name": "Wheat",
    "variety": "HD-2967",
    "sowing_date": "2026-11-15",
    "acres": 3.5
  }'

# Query farmer farms:
curl -s "http://127.0.0.1:8000/api/farmer/farms"
```

### 12b. Farmer Irrigation Log & FAO-56 Water Balance Tracking
```bash
# 1. Log an irrigation event (feeds the daily FAO-56 root-zone water balance):
curl -s -X POST "http://127.0.0.1:8000/api/farmer/farms/1/irrigation" \
  -H "Content-Type: application/json" \
  -d '{
    "irrigated_on": "2026-10-10",
    "amount_mm": 45.0,
    "method": "drip",
    "note": "Regular scheduled irrigation"
  }'

# 2. Retrieve irrigation history for a farm:
curl -s "http://127.0.0.1:8000/api/farmer/farms/1/irrigation"
```

### 13. Phase 2 Agronomy Engines (GDD Stages, ETc Deficit, Soil & Climate)
```bash
# 1. Supported crops & stage norms:
curl -s "http://127.0.0.1:8000/api/advisory/crops"
curl -s "http://127.0.0.1:8000/api/advisory/crops/Wheat/stages"

# 2. Cumulative GDD physiological growth stage (Thermal Time):
curl -s "http://127.0.0.1:8000/api/advisory/stage?crop=Wheat&sowing_date=2026-10-01&lat=20.0&lon=73.8"

# 3. Water requirement (ETc = Kc * ET0) and 7-day irrigation deficit:
curl -s "http://127.0.0.1:8000/api/advisory/water?crop=Wheat&stage_name=Tillering&lat=20.0&lon=73.8"

# 4. Soil texture & Soil Health Card suitability check:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/soil" \
  -H "Content-Type: application/json" \
  -d '{"crop": "Wheat", "soil_type": "Loamy (दोमट)", "shc_n": 180, "shc_p": 22, "shc_k": 160, "shc_ph": 6.8}'

# 5. Climate thermal tolerance check:
curl -s "http://127.0.0.1:8000/api/advisory/climate?crop=Wheat&temp_c=22.0&humidity_pct=60.0"

# 6. Farm Agronomic Diagnostic (Comprehensive GDD stage + ETc deficit + Soil & Climate flags):
curl -s "http://127.0.0.1:8000/api/advisory/diagnostic?farm_id=41"

# 7. Seed agronomic reference norms to Supabase:
cd backend && .venv/bin/python -m jobs.load_advisory_reference
```

### 14. Phase 3 RAG Knowledge Pipeline (ICAR & Agronomy Semantic Search)
```bash
# 1. Semantic retrieval matching:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query": "Wheat crown root initiation irrigation schedule", "crop": "Wheat", "top_k": 3}'

# 2. National Government Schemes query:
curl -s "http://127.0.0.1:8000/api/advisory/schemes?query=KCC%20loan%20interest%20rate%20subvention"

# 3. Ingest documents into RAG store (ICAR Kharif Guide, PoPs):
PYTHONPATH=backend cd backend && .venv/bin/python -m jobs.ingest_document --max-pages 50
```

### 15. Phase 4 Personalized Advisory Generation (Grounded Q&A & Audit)
```bash
# 1. Ask crop advisory with personalized agronomic context (in-scope question):
curl -s -X POST "http://127.0.0.1:8000/api/advisory/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "crop": "Wheat",
    "query": "Should I irrigate my wheat field today?",
    "sowing_date": "2026-10-01",
    "soil_type": "Loamy (दोमट)",
    "lat": 20.0,
    "lon": 73.8
  }'

# 2. Out-of-scope question triggering safety refusal template:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "crop": "Wheat",
    "query": "What is the best investment portfolio in cryptocurrency?"
  }'

# 3. Record farmer thumbs-up (+1) or thumbs-down (-1) feedback:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/queries/1001/feedback" \
  -H "Content-Type: application/json" \
  -d '{"feedback": 1}'
```

### 16. Phase 5 Crop Disease Detection & RAG Treatment Linking
```bash
# 1. Analyze crop leaf photo (multipart upload with verified ICAR treatment extracts):
# Note: Returns {"status": "unavailable"} safely if no trained .keras model exists in models/
curl -s -X POST "http://127.0.0.1:8000/api/advisory/disease-check" \
  -F "file=@path/to/leaf_photo.jpg" \
  -F "crop=Tomato"

# 2. Train / fine-tune MobileNetV2 with held-out test split and temperature calibration:
python training/train_disease_model.py \
  --data-dir path/to/dataset \
  --holdout-test-dir path/to/field_test \
  --epochs 10 \
  --calibrate
```

### 17. Phase 6 Government Schemes Catalog & Grounded Q&A
```bash
# 1. Retrieve static curated catalog of 6 national schemes (with optional search/category filter):
curl -s "http://127.0.0.1:8000/api/advisory/schemes/catalog"
curl -s "http://127.0.0.1:8000/api/advisory/schemes/catalog?category=credit_finance"
curl -s "http://127.0.0.1:8000/api/advisory/schemes/catalog?query=fertilizer%20organic"

# 2. Ask scheme-specific question grounded in verified government scheme guidelines:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/schemes/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How much financial assistance is provided under PM-KISAN per year and what is the installment structure?",
    "scheme_code": "PM-KISAN"
  }'

# 3. KCC interest subvention grounded Q&A:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/schemes/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the net subsidized interest rate for prompt repayment on a Kisan Credit Card?",
    "scheme_code": "KCC"
  }'
```

### 18. Phase 7 Hardening, Scheduled Jobs & Feedback Audits
```bash
# 1. Daily Growth Stage & Agronomic Status Recomputation (CLI / GitHub Action):
PYTHONPATH=backend cd backend && .venv/bin/python -m jobs.recompute_growth_stages --dry-run
PYTHONPATH=backend cd backend && .venv/bin/python -m jobs.recompute_growth_stages --farm-id 1

# 2. Weekly Advisory Feedback Agronomic Audit (Pulls downvoted queries where feedback = -1):
PYTHONPATH=backend cd backend && .venv/bin/python -m jobs.review_advisory_feedback --limit 20
PYTHONPATH=backend cd backend && .venv/bin/python -m jobs.review_advisory_feedback --format json --output audit_report.json

# 3. Rate limiting test (returns HTTP 429 after 20 queries/min):
for i in {1..22}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8000/api/advisory/ask" \
    -H "Content-Type: application/json" \
    -d '{"crop": "Wheat", "query": "Test rate limit", "farmer_id": "test_rate_farmer"}'
done
```

### 19. Run All Automated Tests
```bash
cd backend && .venv/bin/pytest tests/ -v
npx tsc --noEmit
npm run build
```

---

### 20. Farmer Ownership & Authentication Verification
```bash
# When SUPABASE_JWT_SECRET is set, requests without Authorization header or with mismatched sub return 401/403.
# In dev/CI (when SUPABASE_JWT_SECRET is empty), routes operate in open mode for backward compatibility.
curl -s -X GET "http://127.0.0.1:8000/api/farmer/profile/00000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer <SUPABASE_JWT_TOKEN>"
```

---

### 21. Frontend Architecture & Design System (Universal Arva Design System Rollout)
- **Design Tokens**: Forest Ink (`#07503f`), Dark Card Canvas (`#111827`), Canvas Ground (`#0b0f19`), Vivid Lime (`#e8fe85`), and Pastel Quilt cards (Sky `#d0e6f6`, Peach `#f8d4c8`, Sage `#d9e2d5`, Ash `#d5d8db`).
- **Typography**: Cormorant Garamond display serif headers (`font-serif`) paired with Inter sans-serif and monospace technical metadata (`font-mono`) plus Noto Sans Devanagari / Gujarati scripts for Indic multilingual rendering.
- **Shape Language**: 100px pill action buttons (`rounded-full`), 24px-36px card radii (`rounded-3xl`), and 33px rounded input fields (`rounded-full px-4 py-2 bg-stone-900 border border-stone-800 text-stone-200 text-xs font-mono`).
- **Universal View Rollout**:
  - **Cinematic Home Page (`src/components/home/CinematicHome.tsx`)**: Kinetic typography with staggered word/character reveal springs, 3D perspective stage with mouse parallax, 3 virtual camera sequences (Subsurface, Canopy, Phenology), MandiLens live dataset integrity telemetry, and task-first command launchpad.
  - **Mandi Price Trends & Intelligence (`src/components/market/`)**:
    - `MandiAutocomplete.tsx`: 33px rounded search input, dark container popovers, and pill badge chips for tracked mandis.
    - `MarketDataView.tsx`: `#111827` rounded-3xl control container, 33px select dropdowns, and Forest/Lime pill action buttons.
    - `PriceTrendChart.tsx`: `#111827` card, Cormorant Garamond title, segmented pill range switcher, Vivid Lime `#e8fe85` SVG line, and `#07503f` gradient band.
    - `MarketInsightCard.tsx`: `#111827` container, Cormorant Garamond header, Gemini 2.5 Flash pill chip, and verified confidence badge.
    - `MarketContextCard.tsx`: Metric tiles with Cormorant Garamond serif numbers and pill strength badges.
    - `MarketCalculators.tsx`: Crop Margin Calculator (DES benchmark), Storage Estimator (WDRA benchmark with non-storable refusal), and Mandi Logistics 7-day arrival weather disruption strip in rotating Pastel Quilt cards with 33px rounded inputs and Forest/Lime net profit displays.
    - `MandiRecentReportsTable.tsx`: `#111827` rounded-3xl container, Cormorant Garamond header, font-mono dark table with `#e8fe85` verified badges.
    - `MandiExplore.tsx`: Search controls container in `#111827`, 33px rounded input, Pastel Quilt rotating market cards with bold serif prices and Vivid Lime pill badges.
  - **Weather Intelligence (`src/components/weather/WeatherStrip.tsx`)**: Rotating Pastel Quilt tiles (Sky, Peach, Sage, Ash), 33px search bar, multi-source weather fusion with confidence badges, and responsive layout.
  - **Precision Agronomic Advisor (`src/components/farmer/`)**: `FarmDiagnosticCard` (GDD phenology & FAO-56 root-zone water balance in Pastel Quilt tiles), `AdvisoryChatCard` (ICAR grounded Q&A with 33px input and Forest/Lime pill submit button), and `GovernmentSchemesCard` (central welfare schemes with 33px search and category pills).
  - **Sign-In & Farmer Portal (`src/components/auth/AuthPortal.tsx`)**: 6 Indic languages, credentials authentication, comprehensive farm parameter onboarding, and 1-click instant demo profiles.
  - **Farmer Onboarding & Settings (`src/components/farmer/FarmerOnboardingModal.tsx`, `ProfileSettings.tsx`, `ProfileSetup.tsx`)**: Cormorant Garamond serif headers, 33px rounded inputs, Forest Ink pill save actions, and clean profile administration.
  - **Farmer AI Assistant Widget (`src/components/ChatWidget.tsx`)**: Floating `#07503f` circular launcher button with `#e8fe85` accent icon, `#111827` rounded-3xl chat window, and 33px rounded chat input.
  - **Streamlined Navigation**: 5-tab pill shell (`Home`, `Advisor`, `Prices`, `Weather`, and `Profile`). Legacy removed tabs (`fertilizer`, `marketplace`, `disease`, `learn`, `history`) remain completely omitted from active navigation.

---

## 📁 Key Source Directories
- `src/components/home/CinematicHome.tsx` — Cinematic 3D motion graphics sequence, kinetic typography & MandiLens telemetry
- `src/components/auth/AuthPortal.tsx` — Comprehensive sign-in portal & farmer farm parameters registration
- `backend/app/core/auth.py` — Supabase HS256 JWT authorization & farmer ownership verification dependency (`require_self_or_dev`)
- `src/components/farmer/` — `FarmerOnboardingModal`, `FarmDiagnosticCard`, and `GovernmentSchemesCard` UI
- `src/components/weather/` — WeatherStrip with multi-source fusion, confidence badges, responsive layout collision fixes
- `backend/app/api/routes/` — FastAPI endpoints (`market.py`, `weather.py`, `context.py`, `farmer.py`, `advisory.py`)
- `backend/app/domain/advisory/` — Computation engines, RAG & schemes (`growth_stage_engine.py`, `water_requirement_engine.py`, `soil_suitability_engine.py`, `climate_suitability_engine.py`, `retrieve.py`, `generator.py`, `disease_detector.py`, `schemes.py`, `context.py`, `audit.py`, `translation.py`)
- `training/` — Offline model training pipelines (`train_disease_model.py` MobileNetV2 fine-tuning)
- `backend/app/data/advisory/` — Agronomic reference repository, RAG repository (`rag_repo.py`), query repository (`query_repo.py`), and fixtures
- `backend/app/schemas/` — Pydantic models for advisory (`advisory.py`, `rag.py`)
- `backend/jobs/` — Scheduled pipelines & ingest jobs (`load_advisory_reference.py`, `ingest_document.py`, `prune.py`)
- `supabase/migrations/`:
  - `20261006000000_advisory_phase1.sql` — Farmer profile & farm crop schema
  - `20261006000001_advisory_phase2_engines.sql` — Crop stages and agronomic benchmarks
  - `20261006000002_advisory_phase3_rag.sql` — RAG vector embeddings & pgvector store
  - `20261006000003_advisory_phase4_ask.sql` — Advisory queries & farmer feedback tracking
  - `20261010000000_rag_hybrid_search.sql` — Full-text search (FTS) index & `search_rag_chunks_fts` RPC
  - `20261011000000_irrigation_events.sql` — Irrigation log table & RLS policies
  - `20261011000001_farm_crop_status.sql` — Daily growth stage & water balance cache
  - `20261011000002_mandi_market_name_cleanup.sql` — APMC market duplicate cleanup migration

---

## 🔐 Environment Variables Reference

| Variable | Required In | Description |
|---|---|---|
| `JWT_SECRET` | **Production (Mandatory)** | HMAC secret for session authentication tokens. Express server refuses to start in production without it. |
| `SUPABASE_JWT_SECRET` | Optional (Production recommended) | Supabase Project JWT secret. When set, `/api/farmer/*` routes enforce caller ownership on profile and farm resources. |
| `GEMINI_API_KEY` | Development & Production | Google Gemini API key for grounded market insights and agronomic advisory. |
| `GEMINI_MODEL` | Optional (default: `gemini-2.5-flash`) | Primary LLM model for generation; fallbacks to `gemini-2.5-flash-lite`. |
| `BHASHINI_USER_ID` | Optional | MeitY Bhashini User ID for Indic language translations (hi, mr, gu, etc.). |
| `BHASHINI_API_KEY` | Optional | MeitY Bhashini ULCA API key. |
| `SUPABASE_URL` | Recommended | Supabase database instance URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Supabase backend service key for migrations, RAG vectors, and farm persistence. |
| `FASTAPI_URL` | Optional (default: `http://127.0.0.1:8000`) | Backend URL used by Express proxy routes. |
| `CORS_ALLOW_ORIGINS` | Optional | Comma-separated allowed origins for FastAPI backend. |

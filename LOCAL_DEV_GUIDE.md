# 🚀 Local Development & Quick Links Guide

Keep this file handy to quickly launch and test the application without searching through chat history.

---

## 🔗 Quick Links (Browser)

| Service | URL | Description |
|---|---|---|
| **Web UI (Frontend App)** | **[http://localhost:3000](http://localhost:3000)** | Full Web Application (Vite + React + Express proxy) |
| **FastAPI Backend Root** | **[http://localhost:8000](http://localhost:8000)** | Backend API root / health check |
| **Data Layer Health & Ops** | **[http://localhost:8000/api/health/data](http://localhost:8000/api/health/data)** | Live pipeline job statuses, age, and 400 MB storage telemetry |
| **Master Project Details** | **[`PROJECT_DETAILS.md`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/PROJECT_DETAILS.md)** | Complete technical blueprint & architecture specification |
| **Market Coverage Reference** | **[`MARKET_COVERAGE.md`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/MARKET_COVERAGE.md)** | Verified directory of working crops, states & mandis with multi-report history |
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
# 3-report mandi (Gorakhpur MP — renders active 3-point trend):
curl -s "http://127.0.0.1:8000/api/market/trend?commodity=Wheat&market=Gorakhpur&state=Madhya%20Pradesh&days=30"

# 3-report mandi (Sidhi MP):
curl -s "http://127.0.0.1:8000/api/market/trend?commodity=Wheat&market=Sidhi&state=Madhya%20Pradesh&days=30"

# 2-report mandi (Malegaon MH):
curl -s "http://127.0.0.1:8000/api/market/trend?commodity=Wheat&market=Malegaon&state=Maharashtra&days=30"
```

### 1b. Grounded AI Market Insight (Gemini Synthesis)
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

### 1d. Dynamic Mandi List for Autocomplete (/api/market/list-markets)
```bash
# List all APMC mandis in a state for a specific commodity (returns market, district, records):
curl -s "http://127.0.0.1:8000/api/market/list-markets?state=Madhya%20Pradesh&commodity=Wheat"

# List all APMC mandis in a state across all crops:
curl -s "http://127.0.0.1:8000/api/market/list-markets?state=Madhya%20Pradesh"

# Via Express proxy (port 3000):
curl -s "http://127.0.0.1:3000/api/market/list-markets?state=Madhya%20Pradesh&commodity=Wheat"
```

### 1e. Bulk MandiLens Agmarknet Snapshot Ingestion (88,852 records / 121 markets / 14 crops)
Ingests the comprehensive Agmarknet snapshot spanning 2024–2026 into Supabase `mandi_prices`:
```bash
# Run bulk snapshot ingestion (~16s for 88,852 rows at 5,300+ rows/sec):
PYTHONPATH=backend cd backend && .venv/bin/python jobs/load_mandilens_snapshot.py

# Dry-run parse and check:
PYTHONPATH=backend cd backend && .venv/bin/python jobs/load_mandilens_snapshot.py --dry-run
```

**Verify 180-Day Rich History & Multi-Market Comparison Overlap:**
```bash
# 1. 180-day trend for Groundnut at Malegaon APMC (84 active reports, not thin):
curl -s "http://127.0.0.1:8000/api/market/trend?commodity=Groundnut&market=Malegaon%20APMC&state=Maharashtra&days=180"

# 2. 180-day trend for Shirpur APMC Groundnut (63 reports, 45 common dates with Malegaon for side-by-side comparison):
curl -s "http://127.0.0.1:8000/api/market/trend?commodity=Groundnut&market=Shirpur%20APMC&state=Maharashtra&days=180"

# 3. State alias tolerance (e.g. 'Kerala' automatically normalizes to 'Keralam'):
curl -s "http://127.0.0.1:8000/api/market/trend?commodity=Banana&market=Mookkannur%20VFPCK%20Market&state=Kerala&days=180"
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
curl -s "http://127.0.0.1:8000/api/farmer/farms?farmer_id=00000000-0000-0000-0000-000000000001"

# Update farm details (location, soil, irrigation):
curl -s -X PATCH "http://127.0.0.1:8000/api/farmer/farms/1" \
  -H "Content-Type: application/json" \
  -d '{"field_size_acres": 4.0, "soil_type": "Clay Loam", "irrigation_type": "drip"}'

# Update crop details:
curl -s -X PATCH "http://127.0.0.1:8000/api/farmer/crops/1" \
  -H "Content-Type: application/json" \
  -d '{"crop": "Wheat", "variety": "HD-2967", "sowing_date": "2026-11-20"}'
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
> **Model & Generation Specs**: Uses pooled multi-key rotation with `gemini-flash-lite-latest` (primary, 1.1s–2.5s fast generation) and `gemini-3-flash-preview` (fallback). Generation limits are set to `max_output_tokens=3500` with a `25.0s` client timeout to guarantee complete, unabridged agronomic schedules and government scheme details without mid-sentence truncations.
> **Advisory UI Components (`AdvisoryChatCard.tsx`, `GovernmentSchemesCard.tsx`, `ChatWidget.tsx`)**: Input boxes use client-controlled keyboard (`Enter` key interception) and click dispatching with explicit `type="button"` handlers, completely eliminating browser `<form>` native GET submissions so typing questions never triggers a page reload or state reset.
> **General Advisory Chat Widget (`ChatWidget.tsx`)**: The floating circular assistant widget at the bottom-right supports direct agricultural queries, disease troubleshooting, and government scheme routing (`/api/advisory/schemes/ask`). It safely validates crops against the GDD engine and offers quick inquiry chips.

```bash
# 1. Ask crop advisory with personalized agronomic context (via Express port 3000 or FastAPI port 8000):
curl -s -X POST "http://127.0.0.1:3000/api/advisory/ask" \
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
curl -s -X POST "http://127.0.0.1:3000/api/advisory/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "crop": "Wheat",
    "query": "What is the best investment portfolio in cryptocurrency?"
  }'

# 3. Ask general crop advisory (fertilizer, disease identification, yellow leaves) with ICAR GAP synthesis:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "crop": "Wheat",
    "query": "My wheat crop leaves are turning yellow at the tips, what fertilizer or spray should I apply?",
    "district": "Ludhiana",
    "state": "Punjab"
  }'

# 4. Record farmer thumbs-up (+1) or thumbs-down (-1) feedback:
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

# 2. Ask general welfare & subsidy query (e.g. drip irrigation under PMKSY or solar pump under PM-KUSUM):
curl -s -X POST "http://127.0.0.1:8000/api/advisory/schemes/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How can I get a subsidy for drip irrigation or solar pump?"
  }'

# 3. Ask scheme-specific question grounded in verified government scheme guidelines:
curl -s -X POST "http://127.0.0.1:8000/api/advisory/schemes/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How much financial assistance is provided under PM-KISAN per year and what is the installment structure?",
    "scheme_code": "PM-KISAN"
  }'

# 4. KCC interest subvention grounded Q&A:
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
    - `MandiAutocomplete.tsx`: 33px rounded bone input, white container dropdowns, and high-contrast chips for tracked mandis.
    - `MarketDataView.tsx`: Pure white rounded-3xl control container, 33px bone select dropdowns, and Forest/Lime pill action buttons.
    - `PriceTrendChart.tsx`: Pure white card, Cormorant Garamond title, segmented pill range switcher, high-contrast Forest Ink `#07503f` price line with lime active dots and custom white tooltip.
    - `MarketInsightCard.tsx`: Pure white container, Cormorant Garamond header, Forest Ink badges, and grounded AI Gemini synthesis tag.
    - `MarketContextCard.tsx`: Pure white card with 4 Quilted Pastel metric tiles (Sky `#b2cee7`, Peach `#fceace`, Sage `#e6ecd5`, Ash `#efefef`), Cormorant Garamond serif numbers, and high-contrast charcoal signals.
    - `MarketCalculators.tsx`: Crop Margin Calculator (DES benchmark), Storage Estimator (WDRA benchmark with honest non-storable refusal), and Mandi Logistics arrival strip in clean white cards, 33px bone inputs, and Forest Ink `#07503f` / Lime `#e8fe85` summary banners.
    - `MandiRecentReportsTable.tsx`: Pure white rounded-3xl container, Cormorant Garamond header, bone table header with high-contrast `#212529` rows and Forest Ink verified badges.
    - `MandiExplore.tsx`: Search controls in white card, 33px rounded bone inputs, and rotating Quilted Pastel market cards with Cormorant Garamond prices and high-contrast badges.
    - `MandiCompareView.tsx`: Side-by-side multi-mandi comparison in a pure white container, bone inputs, Forest Ink, Blue, and Amber high-contrast Recharts lines, and clear delta tables.
  - **Weather Intelligence (`src/components/weather/WeatherStrip.tsx`)**: Pure white container, 3 pastel observation chips, 4 Quilted Pastel agro-climatology tiles, 7-day forecast strip, Forest Ink biological inspection card, and **Agrometeorological Summary & Field Insights** (7-day rain expectation, FAO-56 cumulative ET₀ vs rain deficit, thermal envelope, spray window check, root-zone irrigation guidance, foliar disease index, and weekly action takeaway). Zero text overlaps.
  - **Precision Agronomic Advisor (`src/components/farmer/`)**: `FarmDiagnosticCard` (GDD phenology & FAO-56 root-zone water balance in Quilted Pastel tiles), `AdvisoryChatCard` (ICAR grounded Q&A with 33px bone input and Forest/Lime pill submit button), and `GovernmentSchemesCard` (central welfare schemes with 33px search and category pills).
  - **Sign-In & Farmer Portal (`src/components/auth/AuthPortal.tsx`)**: 6 Indic languages, credentials authentication, comprehensive farm parameter onboarding, and 1-click instant demo profiles in a pastoral editorial shell (Forest Ink `#07503f` brand side, pure white interaction side).
  - **Farmer Onboarding & Settings (`src/components/farmer/FarmerOnboardingModal.tsx`, `ProfileSettings.tsx`, `ProfileSetup.tsx`)**: Cormorant Garamond serif headers, 33px rounded bone inputs, Forest Ink `#07503f` pill save actions, and clean profile administration on white/bone cards.
  - **Farmer AI Assistant Widget (`src/components/ChatWidget.tsx` & `CinematicHome.tsx`)**: Floating `#07503f` circular launcher with `#e8fe85` icon, direct hero action button on Home (`Ask General Agri Questions` with `open-general-chat` event dispatcher), pure white rounded-3xl chat window, bone user/bot speech bubbles, and 33px rounded chat input.
  - **Design Foundation (`tokens.json`, `theme.css`, `src/index.css`)**: Arva Pastoral Editorial Magazine design system — Bone `#f1efdf` canvas, Forest Ink `#07503f` text/headers, Vivid Lime `#e8fe85` accents, and Quilted Pastel surfaces (`#b2cee7`, `#fceace`, `#e6ecd5`, `#efefef`). Zero text overlapping or clashing dark/white elements.
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
| `GEMINI_API_KEYS` | Optional (Recommended) | Comma-separated list of Gemini API keys for the backend multi-key pool. Automatically rotates keys round-robin with auto-cooldown on rate limits (429). |
| `VITE_GEMINI_API_KEYS` | Optional (Recommended) | Comma-separated list of Gemini API keys for frontend direct calls (`aiService`, `ragService`) with automatic quota failover. |
| `GEMINI_MODEL` | Optional (default: `gemini-3.8-flash`) | Primary LLM model for generation; fallbacks automatically cascade through `gemini-3.5-flash`, `gemini-3.1-flash-lite`, and `gemini-flash-latest`. |
| `BHASHINI_USER_ID` | Optional | MeitY Bhashini User ID for Indic language translations (hi, mr, gu, etc.). |
| `BHASHINI_API_KEY` | Optional | MeitY Bhashini ULCA API key. |
| `SUPABASE_URL` | Recommended | Supabase database instance URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Supabase backend service key for migrations, RAG vectors, and farm persistence. |
| `FASTAPI_URL` | Optional (default: `http://127.0.0.1:8000`) | Backend URL used by Express proxy routes. |
| `CORS_ALLOW_ORIGINS` | Optional | Comma-separated allowed origins for FastAPI backend. |

---

## 📋 Recent Changes (Oct 19 2026)

### 1. Profile Page — Full Redesign (`ProfileSettings.tsx`)
The profile page was completely rebuilt as a structured, multi-section layout:
- **Hero card** — Avatar initials, name, account type badge, sign-out button, and 4-stat grid (Active Crop, Location, Field Size, Irrigation)
- **Farm Overview section** — Displays all onboarded farm data (name, state, district, soil type, irrigation, field size, NPK/pH) loaded from `localStorage`
- **Active Crop section** — Displays crop name, variety, sowing date, and season with active status badge
- **Account Settings** — View mode with inline edit toggle (name, location, farm type) and Save/Cancel actions
- **Security section** — Password change form with show/hide toggle
- **Edit Farm & Crop button** — Opens the FarmerOnboardingModal directly from the profile page

### 2. Edit Farm Control Moved to Profile
The "Edit Farm" button was **removed from the Advisor tab** and relocated to the Profile page's Farm Overview card. A subtle "Edit farm & crop details in Profile Settings →" text link remains in the Advisor tab for quick navigation.

### 3. Advisory Response Truncation Fix (`generator.py`)
- `max_output_tokens` increased: `3500 → 6000`
- Timeout increased: `25s → 45s`
- Prevents advisory answers from being cut off mid-sentence for complex multi-part questions

### 4. Advisory Error Handling (`advisory.py`)
Added `try/except` around `generate_advisory_response()` and `query_repo.log_query()`:
- Gemini API failures (timeout, 429, network error) now return a proper HTTP 503 with a user-friendly message instead of a raw 500 crash
- Query log failures are non-fatal — the user still receives the advisory response

### 5. Chart Line Gaps Fixed (`PriceTrendChart.tsx`)
Changed `connectNulls={false}` → `connectNulls={true}` on both the Area band and the Modal Price Line in the Recharts chart. This ensures the price trend line connects across days with no APMC mandi reports, eliminating disconnected dots.

### 6. MandiCompareView Chart (already `connectNulls={true}`)
Verified that the multi-mandi comparison chart already had `connectNulls={true}` in a previous session. No change needed.

### 7. Intermittent Page Reload Fix & Watcher Isolation (`vite.config.ts`)
- **Root Cause Identified**: The backend embedding cache writes to `backend/app/data/advisory/fixtures/query_embeddings_cache.json` on new queries. Because Vite's file watcher was watching the entire repository directory, every new query triggered an automatic full-page reload in the browser, aborting in-flight responses and making queries appear intermittent. Queries only answered on repeated tries because they hit in-memory cache without triggering file writes.
- **Fix**: Expanded Vite's `server.watch.ignored` in `vite.config.ts` to ignore `**/backend/**`, `**/data/**`, `**/fixtures/**`, `**/.venv/**`, and `**/*.json`. This permanently eliminates inadvertent dev-server browser reloads.

### 8. Chat Widget Visibility Restricted to Home Tab (`App.tsx`)
- Updated `App.tsx` to conditionally render `<ChatWidget />` only when `activeTab === 'home'`.
- The floating assistant button no longer clutters other focused feature tabs (Advisor, Price Trends, Weather, Profile).

### 9. Chat Widget Maximize Mode & Storage (`ChatWidget.tsx`)
- Added true window maximize/restore capability (`isMaximized` state with `<Maximize2>` and `<Minimize2>` controls).
- Standard size: `380px × 520px`.
- Maximized size: expanded view `min(860px, 92vw) × min(760px, 85vh)` with responsive layout, large conversation viewport, and clear conversation action (`<RotateCcw>`).
- Persisted conversation messages into browser storage (`sessionStorage` & `localStorage`) so interactions are retained across widget toggling and tab switching.

### 10. Personalized Advisor Chat Persistence Across Tab Switches (`App.tsx`, `AdvisoryChatCard.tsx`)
- Fixed tab unmounting: Updated `TabPanel` in `App.tsx` to keep DOM tabs alive via hidden CSS (`active ? 'block' : 'hidden'`) rather than destroying and unmounting components on tab switch.
- Added dual storage persistence (`sessionStorage` and `localStorage`) for `AdvisoryChatCard` query/response history keyed by farmer/farm ID.
- Added a "Clear History" action button in the card header for resetting the session at will.
- Stopped event bubbling on all inquiry prompt buttons and Enter keystrokes to ensure clean execution.

### 11. Legacy Prototype Cleanup & Route Stripping (`server.ts`, `AuthContext.tsx`, `vite.config.ts`)
- **Purged Dead Frontend Components**: Removed legacy unmounted marketplace and prototype fertilizer UI (`src/components/marketplace/`, `src/components/fertilizer/`, `src/components/HistoryModal.tsx`).
- **Purged Dead Services & Stores**: Removed unused `src/data/articles.ts`, `src/services/marketService.ts`, and `src/stores/historyStore.ts`.
- **Decoupled AuthContext**: Removed obsolete `useHistoryStore` subscription and user sync hook from `src/context/AuthContext.tsx`.
- **Stripped Obsolete Express Endpoints**: Removed unused multer image upload handling, legacy fertilizer recommendation routes (`/api/fertilizer/*`), deprecated marketplace CRUD endpoints (`/api/products*`), static `/uploads` route, legacy disease history endpoints (`/api/history*`), and dead `/api/chat` + `/api/chat/image` stubs from `server.ts`.
- **Removed Orphan Static Data & Configs**: Deleted root `products.json`, `fertilizer_history.json`, `history.json`, `firebase-blueprint.json`, `firebase-applet-config.json`, `metadata.json`, `screenshots/`, `uploads/`, and `firestore.rules`. Cleaned up `server.watch.ignored` in `vite.config.ts`.
- **TypeScript Boundary Optimization**: Updated `tsconfig.json` with explicit `include` (`src`, `server.ts`, `vite.config.ts`), `exclude` (`node_modules`, `dist`, `backend`), and added `"node"` to `compilerOptions.types` to keep typechecking isolated to TS source files.



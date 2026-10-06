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

# 6. Seed agronomic reference norms to Supabase:
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
curl -s -X POST "http://127.0.0.1:8000/api/advisory/disease-check" \
  -F "file=@path/to/leaf_photo.jpg" \
  -F "crop=Tomato"

# 2. Train / fine-tune MobileNetV2 on PlantVillage dataset (offline script):
python training/train_disease_model.py --data-dir path/to/dataset --epochs 10
```

### 17. Run All Automated Tests
```bash
cd backend && .venv/bin/pytest tests/ -v
npx tsc --noEmit
npm run build
```

---

## 📁 Key Source Directories
- `src/components/farmer/` — `FarmerOnboardingModal` and `FarmDiagnosticCard` UI
- `src/lib/api/advisory.ts` — Frontend API client for agronomic calculation engines, RAG search, `/ask` Q&A, and `disease-check`
- `src/components/market/` — Market trend charts, MandiExplore, and MarketContextCard UI
- `src/components/weather/` — WeatherStrip with multi-source fusion, confidence badges, and India-wide explore search
- `backend/app/api/routes/` — FastAPI endpoints (`market.py`, `weather.py`, `context.py`, `farmer.py`, `advisory.py`)
- `backend/app/domain/advisory/` — Computation engines & RAG (`growth_stage_engine.py`, `water_requirement_engine.py`, `soil_suitability_engine.py`, `climate_suitability_engine.py`, `retrieve.py`, `generator.py`, `disease_detector.py`, `context.py`, `audit.py`, `translation.py`)
- `training/` — Offline model training pipelines (`train_disease_model.py` MobileNetV2 fine-tuning)
- `backend/app/data/advisory/` — Agronomic reference repository, RAG repository (`rag_repo.py`), query repository (`query_repo.py`), and fixtures
- `backend/app/schemas/` — Pydantic models for advisory (`advisory.py`, `rag.py`)
- `backend/jobs/` — Scheduled pipelines & ingest jobs (`load_advisory_reference.py`, `ingest_document.py`, `prune.py`)
- `supabase/migrations/` — `20261006000000_advisory_phase1.sql`, `20261006000001_advisory_phase2_engines.sql`, `20261006000002_advisory_phase3_rag.sql`, `20261006000003_advisory_phase4_ask.sql`

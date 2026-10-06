# 🌾 AI Smart Agriculture Advisory System

An intelligent agricultural platform providing multi-source weather fusion, real-time and historical mandi market price discovery across India, rule-based crop-weather contextual intelligence, and crop margin & hold-vs-sell storage calculators.

---

## 🏗️ Architecture & Data Layer Overview

The system combines a **React + Vite** frontend (proxied via Node/Express) and a high-performance **FastAPI** backend backed by **Supabase (PostgreSQL with pgvector)**.

1. **Personalized Crop Advisory Layer (Deep-6 Crops: Wheat, Rice, Cotton, Maize, Sugarcane, Potato):**
   - **Farmer Context Assembly:** Combines registered location, soil type, NPK soil tests, irrigation method, sowing date, and live weather.
   - **Precision Agronomy Calculation Engines:**
     - *Physiological Growth Stage Engine:* Tracks accumulated thermal time (Growing Degree Days, GDD) with base temperatures and calendar fallbacks.
     - *Water Requirement & Deficit Engine:* Computes daily crop evapotranspiration ($ET_c = K_c \times ET_0$) and 7-day rainfall deficits.
     - *Soil Suitability Engine:* Checks texture compatibility and Soil Health Card (SHC) N-P-K-pH thresholds.
     - *Climate Thermal Tolerance Engine:* Validates ambient cardinal temperatures and humidity ranges.
   - **RAG Knowledge Pipeline:** Strict retrieval-augmented generation grounded in ICAR Packages of Practices and State Agricultural University guides using 768-dimensional Gemini embeddings (`vector(768)`).
   - **Disease Detection & Treatment Linking:** MobileNetV2 leaf image analysis with calibrated confidence tiers and direct RAG treatment linking.
   - **National Agricultural Welfare Schemes:** Static curated catalog and grounded Q&A across PM-KISAN, PMFBY, KCC, SHC, AIF, and PKVY.
   - **Feedback Loop & Safety Audit:** Farmer query audit snapshots (`advisory_queries`), thumbs up/down logging, and weekly agronomic review.

2. **Market Data Layer:**
   - **Tier A (Advisory):** 6 key crops across 7 tracked states (Gujarat, Maharashtra, UP, Punjab, MP, Karnataka, Rajasthan) with continuous date-spine history.
   - **Tier B (Explore):** Any commodity at any mandi in India with live lookups, automatic graduation into daily tracking, and LRU eviction at a 300-pair cap.

3. **Weather Fusion Layer:**
   - Multi-source fused forecast and archive (Open-Meteo as primary, cross-checked against NASA POWER and OpenWeather).
   - Real-time agreement metrics, sensor confidence ratings (`high`, `medium`, `low`), and 0.1° (~10 km) geographic grid snapping.

4. **Context & Economic Calculators:**
   - **Crop Margin Calculator:** Uses official DES Cost of Cultivation benchmarks (C2 and A2+FL).
   - **Storage Estimator:** Models monthly warehouse holding fees vs. moisture shrinkage weight loss, and explicitly refuses non-storable crops (Sugarcane, Tomato).

---

## 🗄️ Database Tables (Supabase PostgreSQL)

| Table | Purpose |
|---|---|
| `farmer_profile` | Farmer profiles, preferred language (`en`, `hi`, `mr`, `gu`), and phone contact. |
| `farms` | Farm geo-coordinates, soil texture classification, N-P-K-pH values, and irrigation systems. |
| `farm_crops` | Active registered crops, crop varieties, sowing dates, and harvest seasons. |
| `crop_stage_norms` | Base temperatures ($T_{base}$), cumulative GDD thresholds, and fallback durations per stage. |
| `crop_kc_reference` | FAO-56 crop coefficients ($K_c$) mapped per physiological growth stage. |
| `crop_soil_suitability` | Soil texture preferences and optimal pH boundaries. |
| `crop_climate_suitability` | Minimum and maximum cardinal thermal and humidity tolerances. |
| `rag_documents` | Ingested ICAR, State Ag University, and Ministry of Agriculture documents. |
| `rag_chunks` | Semantic text passages with 768-dimensional pgvector embeddings (`vector(768)`). |
| `advisory_queries` | Auditable context snapshots, generated responses, citations, and farmer feedback (+1 / -1). |

---

## 🛠️ Background Jobs & Pipelines

| Job Script | Schedule | Purpose |
|---|---|---|
| `python -m jobs.ingest_mandi_daily` | 15:30, 21:30 IST | Daily data.gov.in mandi arrival ingestion, validation, and upsert. |
| `python -m jobs.ingest_weather` | 05:45, 11:45, 17:45, 23:45 IST | Multi-source weather forecast and observation fusion. |
| `python -m jobs.recompute_growth_stages` | Daily (Post-Weather) | Recomputes GDD accumulation and water deficits for all registered active crops. |
| `python -m jobs.review_advisory_feedback` | Weekly (Manual) | Agronomic audit tool reviewing flagged advisory responses (`feedback = -1`). |
| `python -m jobs.ingest_document` | Manual / As needed | Ingests and vectorizes new agronomic guides or government scheme PDFs into `rag_chunks`. |
| `python -m jobs.load_advisory_reference` | One-time / Setup | Seeds GDD stage norms, Kc tables, and soil/climate parameters into Supabase. |
| `python -m jobs.reconcile_recent` | 08:00 IST | Reconciles recent 14-day weather with Open-Meteo ERA5 archive. |
| `python -m jobs.power_validate` | 08:30 IST | Fetches NASA POWER radiation and precipitation to validate fused weather. |
| `python -m jobs.prune` | Sun 01:30 IST | Enforces table retention limits and guards storage limits. |
| `python -m jobs.load_reference_data` | Setup | Seeds DES Cost of Cultivation and WDRA storage benchmarks. |
| `python -m jobs.refresh_normals` | Setup | Computes 30-year monthly historical climate normals for new weather grids. |

---

## 🌾 How to Add a New Crop (Mechanical Process)

Adding support for an additional crop (e.g. *Mustard*, *Soybean*, or *Chickpea*) does **not** require changing any core calculation or advisory engine code. Follow these mechanical steps:

1. **Populate Reference Tables** (or add entry to [`backend/app/data/advisory/fixtures/crop_catalog.json`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/backend/app/data/advisory/fixtures/crop_catalog.json)):
   - **`crop_stage_norms`**: Add 4–6 physiological growth stages with `gdd_base_c`, `gdd_cumulative_at_stage_end`, and `typical_days_fallback`.
   - **`crop_kc_reference`**: Add crop water coefficient ($K_c$) for each growth stage based on FAO-56.
   - **`crop_soil_suitability`**: Add compatible soil types (e.g. `Sandy Loam (बलुई दोमट)`), `ideal_ph_min`, and `ideal_ph_max`.
   - **`crop_climate_suitability`**: Add optimal temperature boundaries (`ideal_temp_min_c`, `ideal_temp_max_c`).
2. **Ingest State University / ICAR Package of Practices**:
   - Run the document ingestion job to embed the new crop's agronomy guide:
     ```bash
     PYTHONPATH=backend python -m jobs.ingest_document --pdf-path path/to/Crop_Guide.pdf --crop "Mustard" --doc-type "agronomy_pop"
     ```
3. **Verify via Tests**:
   - Run the automated test suite to ensure the new crop resolves in growth stage, water balance, and RAG retrieval pipelines:
     ```bash
     cd backend && .venv/bin/pytest tests/test_phase7_hardening.py -k test_mechanical_addition_of_new_crop
     ```

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
# Backend test suite (125 tests covering API contracts, agronomy engines, RAG, CV disease detection, calculators, and jobs):
cd backend && .venv/bin/pytest tests/ -v

# Frontend TypeScript check and production build:
npx tsc --noEmit
npm run build
```


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

### 12. Run All Automated Tests
```bash
cd backend && .venv/bin/pytest tests/ -v
npx tsc --noEmit
```

---

## 📁 Key Source Directories
- `src/components/market/` — Market trend charts, MandiExplore, and MarketContextCard UI
- `src/components/weather/` — WeatherStrip with multi-source fusion, confidence badges, and India-wide explore search
- `backend/app/api/routes/` — FastAPI endpoints (`market.py`, `weather.py`, `context.py`)
- `backend/app/data/` — Data layer (`mandi/`, `weather/`, `locations/`, `context/`)
- `backend/jobs/` — Scheduled data pipelines & sync jobs

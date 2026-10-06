# Phase 0 Reconnaissance — Personalized Crop Advisory Layer

**Date:** 2026-10-06  
**Branch:** `feature/advisory-phase-0`  
**Status:** Complete  
**Scope:** Reconnaissance and architecture mapping across existing auth, RAG, Gemini, Bhashini, disease classification, and weather data services.

---

## 1. Existing System Audit

### 1.1 Existing RAG & Vector Search
- **Current State:** A frontend-only prototype in `src/services/ragService.ts` reading a local JSON dataset `src/data/agriculture_knowledge.json`.
- **Mechanism:** Calls `@google/genai` with model `gemini-embedding-2` in the browser, caches embeddings in `localStorage` (`agri_knowledge_embeddings`), and runs client-side cosine similarity in JavaScript.
- **Limitation:** Cannot scale, lacks server-side persistence, cannot ingest multi-page official PDFs (ICAR / SAU Package of Practices), does not filter by crop or document type, and exposes API keys to client browsers.
- **Target Replacement:** Server-side FastAPI RAG pipeline (`backend/app/data/advisory/rag/`) backed by Supabase Postgres `pgvector` extension, `rag_documents` and `rag_chunks` tables, 768-dim embeddings (`gemini-embedding-001` or compatible Gemini text embedding), and SQL RPC function `match_rag_chunks()`.

### 1.2 Gemini Integration
- **Backend:** `GEMINI_API_KEY` is defined in `backend/app/core/config.py` (`Settings.GEMINI_API_KEY`) and loaded from root `.env`. Ready for server-side generation and embedding calls via `google-genai` Python SDK.
- **Frontend:** `src/services/aiService.ts` currently instantiates `@google/genai` using `VITE_GEMINI_API_KEY` with model `"gemini-2.5-flash"`.
- **Target Usage:** Advisory context assembly and prompt generation will be centralized in FastAPI (`/api/advisory/ask`) using the backend key, eliminating client-side API key leakage and keeping prompt grounding strictly enforced on the server.

### 1.3 Bhashini Integration
- **Current State:** No active Bhashini code or API keys exist in the repository. The application currently uses `i18next` with static JSON translation dictionaries in `src/i18n/locales/` (`en.json`, `hi.json`, `kn.json`, `te.json`).
- **User Note:** Bhashini API access requires government/institutional onboarding and is currently pending/inaccessible for individual development.
- **Strategy:** 
  1. For dynamic advisory text: Route through Gemini with bilingual translation prompting or free open endpoints with graceful fallback to English/Hindi.
  2. For static terminology (crop names, growth stages, disease names, UI elements): Use the existing `i18next` dictionary system.
  3. Seamless drop-in interface for `BHASHINI_API_KEY` whenever credentials become available.

### 1.4 Farmer Auth & Profile Tables
- **Current State:** 
  - Express proxy (`server.ts`) has a local file/memory JWT auth system (`/api/auth/register`, `/api/auth/login`, `/api/auth/profile`).
  - Frontend has `src/context/AuthContext.tsx` and `src/services/authService.ts`.
- **Target Replacement:** 
  - Support both Supabase Auth (`auth.users`) and local user identifiers.
  - Create database tables: `farmer_profile`, `farms`, and `farm_crops` with Row Level Security (RLS).
  - Mode: Allow **anonymous** access with sensible district-level defaults while providing personalized GDD and soil insights for logged-in farmers.

### 1.5 Disease Detection Model
- **Current State:** `src/services/aiService.ts` currently has a placeholder function `detectDisease(base64Image)` that queries Gemini multimodal directly with the prompt `"As a plant pathologist, analyze this image..."`. There are no `.h5`, `.keras`, `.tflite`, or `.onnx` local weights in the repository.
- **Target Replacement:** 
  1. Train a lightweight MobileNetV2 classifier on the benchmark PlantVillage dataset covering available crops (Tomato, Potato, Pepper, Grape, Corn, Apple).
  2. For crops outside PlantVillage (or low-confidence images): Fall back gracefully to Gemini multimodal vision analysis, clearly labeled as an AI visual estimate, while routing confirmed diseases into cited RAG treatment text.

### 1.6 Weather Layer Readiness
- **Current State:** **100% Ready & Verified**.
- **Implementation:** `backend/app/data/weather/service.py` provides `WeatherService.get_summary(lat, lon)` which fuses Open-Meteo, NASA POWER, and OpenWeather into daily histories, forecasts, $ET_0$ evapotranspiration, and agro metrics.
- **Direct Integration:** The advisory computation engines can import and call `WeatherService` directly in Python without any HTTP overhead.

---

## 2. Existing → Target Mapping

| Component | Current Implementation | Target Advisory Architecture |
|---|---|---|
| **Advisory Q&A** | Client-side Gemini prompt with browser mock RAG | Server-side `/api/advisory/ask` with 3-engine grounding (GDD + FAO-56 + Soil) + pgvector RAG |
| **Growth Stage** | None (calendar day assumption) | Deterministic GDD thermal-time accumulation from `weather_daily_fused` history |
| **Irrigation** | Static general advice | FAO-56 $K_c \times ET_0$ vs 7-day rainfall deficit calculation |
| **Soil Match** | Static general advice | Deterministic suitability check against ideal soil types & pH range |
| **Knowledge Base** | `agriculture_knowledge.json` in browser | Supabase `pgvector` (`rag_documents`, `rag_chunks`, `match_rag_chunks`) |
| **Disease Detection** | Direct Gemini vision prompt | MobileNetV2 trained on PlantVillage + Gemini vision fallback for unmapped crops |
| **Auth & Profiles** | Local memory/JSON in `server.ts` | Supabase Postgres `farmer_profile`, `farms`, `farm_crops` with RLS |
| **Multilingual** | Static `i18next` bundles | Static dictionaries for UI + server translation pipeline for free-form responses |

---

## 3. Deviations & Clarifications

1. **pgvector Status:** User confirmed the `vector` extension is already enabled on their Supabase database.
2. **Bhashini Access:** Direct Bhashini API access is unavailable due to institutional access constraints; an abstraction layer will support Gemini-based translation with direct upgrade to Bhashini when keys are supplied.
3. **Out-of-Dataset Disease Handling:** When a user uploads a leaf image for a crop not covered by the PlantVillage dataset (e.g. Cotton), the system will use Gemini vision with a clear disclaimer ("AI Visual Estimate — confirm with local KVK") and retrieve general pest/pathology practices via RAG.

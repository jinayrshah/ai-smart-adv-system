# Smart Crop Advisory System — Project Map

This file is the one thing to read before any of the six subsystem documents. It exists so a fresh Antigravity session (or a fresh you, six weeks from now) gets the whole picture in one place instead of piecing it together from six files.

**Put this file at `docs/README.md`.** Everything else already specifies its own folder (`docs/data-layer/`, `docs/advisory/`, `docs/iot/`).

---

## 1. What this project is

A crop advisory platform for Indian farmers: real mandi price trends, weather (current/forecast/history), and a grounded, personalized advisory chat covering 6 crops in depth — sharpened by live IoT sensor data when a farmer has the hardware, gracefully falling back to profile-and-weather-only advice when they don't. Originally built solo for SIH25010 (Smart India Hackathon, college round); now being rebuilt from scratch post-feedback, still solo.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js | Deployed on Vercel |
| Design system | Tailwind v4 (CSS-first `@theme`), `motion` (React animation), shadcn/ui (primitives) | Tokens sourced from a real-site style extraction (Arva, via refero.design) — `Architecture_Frontend.md`; **not** the Framer website-builder product, see that file's §7 |
| Backend/API | FastAPI (Python) | Hosting (Vercel serverless vs. a persistent server) is **still unconfirmed** — flagged in every subsystem doc's Phase 0 recon; matters for whether in-process schedulers are possible (they're avoided everywhere in favor of GitHub Actions specifically because this wasn't settled) |
| Database | **Supabase** (managed Postgres) | Also provides: Auth (farmer login, §6 of the advisory doc), `pgvector` extension (RAG embeddings), and row-level security used as the deny-by-default pattern on every table across all three subsystems |
| Scheduled jobs | GitHub Actions (cron + `workflow_dispatch`) | Chosen over Vercel Hobby's cron specifically because Hobby is once-a-day and imprecise — see `Architecture_MarketData_Weather.md` §11 |
| LLM + embeddings | Gemini API (`gemini-2.5-flash` generation, `gemini-embedding-001` embeddings) | Free tier (~1,500 requests/day); same API key reused for both |
| Multilingual | Bhashini | Already part of the project's stated stack — integration status to be confirmed in Advisory Phase 0 recon |
| Disease detection | MobileNetV2 (transfer learning) on PlantVillage | The one actually-trained ML model in the whole system — see `Architecture_Advisory.md` §3 |
| Weather data | Open-Meteo (primary), NASA POWER (validator/fallback), OpenWeatherMap (cross-check) | `Architecture_MarketData_Weather.md` |
| Mandi price data | data.gov.in (live), `agmarknet` package + CEDA (backfill), Kaggle (offline seed) | Same file |
| IoT | ESP32 + DHT11 + soil moisture + water-level sensor + relay + pump + MG90S servo | `Architecture_IoT.md` |
| Source control | GitHub, `main`/`dev`/`feature*`/`fix*` branching | One PR per phase into `dev`, across all three subsystems |
| Budget | **$0 — free tier only, everywhere** | Stated constraint, enforced in every doc's operating rules |

**So, directly: yes, Supabase is the database (and auth, and vector store) for everything; FastAPI is the backend all three subsystems' endpoints live in; Next.js is the one frontend all of them render into.** There's no separate database or backend per subsystem — it's one Supabase project and one FastAPI app, organized into modules (`app/data/`, `app/advisory/`, `app/iot/` or similar — exact layout is for Phase 0 recon to map onto whatever already exists).

---

## 3. The documents

| File | Covers | Depends on |
|---|---|---|
| `docs/data-layer/Architecture_MarketData_Weather.md` + `Implementationplan_MarketData_Weather.md` | Mandi price ingestion (6 tracked crops + a bounded "any crop, anywhere" explore tier) and weather (fused, validated, confidence-scored) | Nothing else in this project — this is the foundation |
| `docs/advisory/Architecture_Advisory.md` + `Implementationplan_Advisory.md` | Farmer/farm profiles, the grounded RAG+LLM advisory chat, growth-stage/water/soil/climate computation engines, disease detection | Calls the data layer's `weather.service.get_summary()` directly — no HTTP hop |
| `docs/iot/Architecture_IoT.md` + `Implementationplan_IoT.md` | ESP32 hardware, firmware, device data model, the live-reading override that sharpens the advisory engines when a sensor is present | Plugs into the advisory layer's §8 (water) and §9b (climate) engines — doesn't redefine them |
| `docs/frontend/Architecture_Frontend.md` + `Implementationplan_Frontend.md` | The design system (Arva-derived tokens, fonts, motion), applied across all four features; deep MandiLens analysis and how the market UI exceeds it | Visual/interaction layer over all three subsystems above — changes no backend contract |
| `docs/frontend/Cleanup_Frontend_Baseline.md` | **Run first, before any frontend work:** deletion-only cleanup pass — inventory of new vs legacy pages, a protected list, approved removals, smoke tests | Everything built so far — protects it |
| `docs/data-layer/Revisions_MarketWeather.md` | Bug fixes and additions for the built market/weather pages (round 1 QA, MandiLens/iti-h findings, Price Trends review). Run **after** the cleanup file | Data-layer phases already built |
| `docs/README.md` (this file) | The map | — |

---

## 4. Cross-subsystem table connections (so the whole schema is visible in one place)

| Table | Lives in | Referenced by |
|---|---|---|
| `locations` (`grid_key` convention) | data-layer | `farms.grid_key` in advisory uses the **same convention** — not a foreign key, but must match exactly |
| `weather_daily_fused`, `weather.service.get_summary()` | data-layer | advisory's growth-stage engine (§7), water engine (§8), climate engine (§9b) all read from this |
| `farms`, `farm_crops` | advisory | `devices.farm_id`, `iot_readings.farm_id` in IoT; also the natural link point if the market layer's Tier B search is ever surfaced per-farm (noted as a future idea, not built) |
| `crop_stage_norms`, `crop_kc_reference`, `crop_soil_suitability`, `crop_climate_suitability` | advisory | IoT's override logic (`resolve_reading`) feeds these engines fresher inputs; doesn't add its own crop reference tables except `crop_moisture_targets` |
| `rag_chunks` (pgvector) | advisory | shared by agronomy content, disease-treatment content, and government-scheme content (`doc_type` column distinguishes them) — one pipeline, not three |
| `advisory_queries` | advisory | logs which `iot_readings` (if any) and which `rag_chunks` fed each answer, via `context_snapshot` |

---

## 5. Consolidated open questions (answer these once, they're referenced from multiple files)

| # | Question | Blocks | First needed in |
|---|---|---|---|
| 1 | **The exact 6 crop names — ANSWERED: Wheat, Tomato, Cotton, Soybean, Rice, Maize** (as built in the Advisor onboarding). Do not ask again. | Everything crop-specific — data-layer's tracked scope, advisory's entire reference-table set, IoT's climate/moisture targets | Data-layer Phase 0 |
| 2 | Is the repo actually empty, or does some scaffolding already exist (Next.js init, FastAPI skeleton, Supabase project)? | Every Phase 0 recon across all three docs assumes there's *something* to inspect — confirm what | Data-layer Phase 0 |
| 3 | Tracked states / priority mandis | Data-layer's tracked scope | Data-layer Phase 0 |
| 4 | Personal data.gov.in API key set up? | Data-layer Phase 1 | Data-layer Phase 1 |
| 5 | Where does FastAPI actually run (Vercel serverless vs. a real server)? | Confirms whether the stateless-API design assumption is required or just cautious | Data-layer Phase 0 |
| 6 | Which chart library / existing market UI components? | Data-layer Phase 2 frontend | Data-layer Phase 2 |
| 7 | For each of the 6 crops, does PlantVillage cover it? (check the dataset's class list) | Advisory's disease-detection scope | Advisory Phase 0 |
| 8 | Which State Agricultural University covers your tracked states — whose Package of Practices to source? | Advisory's whole reference-table set (GDD, Kc, soil, climate) | Advisory Phase 0, before Phase 2 |
| 9 | Bhashini integration status — working already, or needs rebuilding? | Advisory Phase 4 | Advisory Phase 0 |
| 10 | Onboarding required before first question, or anonymous (degraded) allowed? | Advisory Phase 1 UX | Advisory Phase 1 |
| 11 | What's the MG90S servo actually for? | Whether the camera/auto-photo idea is worth building | IoT Phase 0 |
| 12 | Resistive or capacitive soil moisture sensor — which do you actually have? | Whether to budget a swap before real deployment | IoT bench-testing |
| 13 | Is "soil temperature" in your original description literal (need a buried probe) or shorthand for ambient (DHT already covers it)? | Whether a DS18B20 is needed | IoT bench-testing |
| 14 | DHT22 upgrade — worth the cost to you? | Accuracy margin on near-threshold climate verdicts | IoT bench-testing |

**#1 and #2 are the two genuine hard blockers.** Everything else has a stated default in its own file and can be settled as its phase comes up.

---

## 6. Manual setup checklist (accounts/keys — start these early, they have lead time)

- [ ] Confirm repo state (Q2 above) — first thing, before anything else.
- [ ] Supabase project created, `vector` extension available (Free plan supports it).
- [ ] Personal data.gov.in API key (demo key caps at 10 rows/request — unusable for real ingestion).
- [ ] Gemini API key (used for both generation and embeddings).
- [ ] CEDA API key registration (`api.ceda.ashoka.edu.in`) — optional at first, the CSV path works without it.
- [ ] OpenWeatherMap Student Initiative application (college email + student ID) — optional, unlocks free 1-year history.
- [ ] GitHub Actions secrets mirror whatever's in each subsystem's env-var table (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_GOV_IN_KEY`, `GEMINI_API_KEY`, `OPENWEATHER_API_KEY`, `BHASHINI_API_KEY`, `CEDA_API_KEY` if obtained).
- [ ] Download the State Agricultural University Package of Practices PDF(s) for your tracked states (Q8) — same license-verification process already done for the ICAR Kharif PDF.
- [ ] Start the manual GDD/Kc/soil/climate value extraction from those PoP documents for at least your first 1-2 crops (`Implementationplan_Advisory.md` front matter) — this is slow, human work; start it early so it isn't the thing blocking Advisory Phase 2 later.

---

## 7. Build order — what can run in parallel, and where the real gates are

This project has more genuine parallelism than "finish subsystem 1, then 2, then 3" suggests. Laid out by actual dependency, not by document order:

**Can all start immediately, in parallel, once the answers to Q1/Q2 above exist:**
- **Data-layer Phase 0 → 1 → 2/3** (upload `Architecture_MarketData_Weather.md` + its plan). This also establishes the migration/GitHub-Actions conventions the other two subsystems reuse — do this first if you're only doing one thing at a time.
- **Advisory Phase 1** (farmer profile/farms) — needs only a Supabase project, nothing from data-layer. Upload `Architecture_Advisory.md` + its plan whenever you're ready to start this, even alongside data-layer.
- **Advisory Phase 3** (RAG ingestion pipeline) — also has no data-layer dependency. Can start as soon as you have your first PoP PDF in hand.
- **Advisory Phase 5** (disease-detection model training) — fully independent of everything; genuinely could be done first if you want an early, visible win.
- **IoT hardware bench-testing (Track B, B0–B4 in `Implementationplan_IoT.md`)** — zero software dependency, physical work only, doesn't need any file uploaded to Antigravity at all unless you want help drafting firmware code.

**One real optimization inside data-layer itself:** its own Phase 2 (mandi backfill/trend) and Phase 3 (weather) don't depend on each other, only both depend on Phase 1. If reaching Advisory sooner matters more to you than the market trend charts, do data-layer Phase 3 before Phase 2 — Advisory's engines need weather, not mandi prices.

**Gated — needs something above to finish first:**
- **IoT Track A** (device + readings endpoint) — only needs Advisory Phase 1's `farms` table. Can start as soon as that one phase lands, well before the rest of Advisory is done.
- **Advisory Phase 2** (GDD/water/soil/climate engines) — needs data-layer's weather working **and** some real accumulated weather history (days of it, not just working code) **and** your manual PoP-extraction work for at least one crop. This is gated by time as much as by code — don't expect it to be startable the moment weather's code merges.
- **IoT merge phase (C1–C5)** — needs Advisory Phase 2 done, IoT Track A done, and IoT Track B through B3 (WiFi+POST working). The last thing to converge, by design.
- **Advisory Phase 4** (generation, ties everything together) and **Phase 6** (government schemes) — need Phase 2 and Phase 3 respectively.

**Genuinely last, no rush:**
- Data-layer Phase 2B/3B (the "any crop, anywhere" explore tiers).
- Advisory Phase 7 (feedback loop).
- IoT's "Later" section (opt-in auto-irrigation, camera/servo auto-photo) — deliberately gated behind weeks of proven-reliable sensing.

---

**Frontend sequence (current):** `Cleanup_Frontend_Baseline.md` (PR-1, deletion-only) → `Revisions_MarketWeather.md` plus the bugfix rows in the cleanup file's §8 (PR-2) → `Implementationplan_Frontend.md` redesign (PR-3 onward). All frontend work stays inside the frontend directory — no backend edits.

---

## 8. Multilingual strategy (Hindi, Marathi, Gujarati — cross-cutting across all four features)

Not built yet anywhere in the docs until now — this section is the design for it. It splits into two genuinely different problems, and mixing them up is the main way this goes wrong.

**Dynamic content — free-form text generated per request.** The advisory chat's response prose, and disease-treatment guidance, are different every time. This has to go through **Bhashini** live: translate the farmer's query to English before retrieval, keep the LLM's own reasoning in English, translate the final response back to their language before returning it (`Architecture_Advisory.md` §15 has the full mechanics and the research behind it). **Bhashini, not Gemini's own multilingual output, is the reliable choice here** — Gemini's quality is genuinely uneven across these three languages (solid for Hindi, documented problems specifically with Gujarati), while Bhashini is free government infrastructure built for exactly this, covering all three (and 19 more) consistently. Don't let a "just ask Gemini to answer in Gujarati" shortcut into the codebase — it's the one place a plausible-looking simplification would actually make quality worse and inconsistent across languages.

**Static content — a small, finite, known-in-advance vocabulary.** This covers all four features' UI chrome and fixed labels, and it does **not** need a live translation API call per request:
- Advisory: the 6 crop names, PlantVillage's disease class labels (whichever ones are in scope per `Architecture_Advisory.md` §21 Q2), stage names, UI chrome ("Ask", "My Farm", etc.)
- Market: UI labels ("Modal Price", "Market", "Today", range toggles), the 6 tracked crop names (same list as advisory — one dictionary, not two)
- Weather: UI labels, the finite set of weather-condition phrases ("Partly cloudy", "Heavy rain", etc.)
- Market/place names (mandi names, districts): generally left as-is or transliterated, not translated — a market name is a proper noun

Build this as a normal Next.js i18n setup (e.g. `next-intl` or `react-i18next`) with one JSON dictionary per language (`hi.json`, `mr.json`, `gu.json`). **Drafting these dictionaries is a one-time task, not a running cost** — machine-translate a first draft (Bhashini or any tool) and have a Hindi/Marathi/Gujarati speaker sanity-check it once, since these are small, fixed lists (a few dozen to a couple hundred strings total), not something worth spending live API calls on for every page load.

**Where this lives in code:** `farmer_profile.preferred_language` (already defined, `Architecture_Advisory.md` §6) is the one source of truth for which language a farmer sees — both the static i18n dictionary selection and the dynamic Bhashini calls key off the same field, so there's one language setting in the whole app, not one per feature.

**One dependency on the frontend doc:** the design system's fonts (Inter, and the Reckless substitute) don't cover Devanagari or Gujarati glyphs — `Architecture_Frontend.md` §5 specifies the Noto Sans Devanagari/Gujarati fallback needed for this to actually render correctly, not just translate correctly.

---

## 9. Standing rules across all three subsystems (stated once here, repeated in each file's §0 — this is the canonical version)

- Free tier only, everywhere — no paid API, no paid plan upgrade, ever, without it being an explicit, deliberate decision.
- Never invent a number, endpoint, or data source that isn't in the docs — if reality differs from what's documented, adapt and log it, don't guess.
- No fake/synthetic data, anywhere, at any layer — this project deliberately removed dummy data once already.
- One git branch, one PR, per phase, into `dev`. Never commit to `main` directly.
- Phase 0 of every subsystem is reconnaissance only — no code changes — and ends with questions, then **stops and waits** for "go phase N."
- Nothing ships without a named source for anything a farmer could act on (dosages, thresholds, numbers) — the advisory layer's most important rule, but the spirit ("cite it or don't say it") applies to the whole project's credibility.

---

## 10. First message to a fresh Antigravity session

```
This is the Smart Crop Advisory System — a solo rebuild of SIH25010. All planning docs
are in docs/: docs/README.md (read this first, it's the map), then
docs/data-layer/, docs/advisory/, docs/iot/ (each has an Architecture_*.md source-of-truth
and an Implementationplan_*.md task runbook).

1. Read docs/README.md in full now.
2. Tell me the current state of this repo — is it empty, or does something already exist?
   (This isn't answered anywhere in the docs — I need your read on the actual codebase.)
3. Based on docs/README.md §7, confirm which subsystem/phase we're starting with, then go
   read that subsystem's own Architecture + Implementation Plan files in full before doing
   anything else.
4. Do Phase 0 of that subsystem (recon only, no code) and then stop and show me what you
   found plus its file's own open questions before writing any code.
5. Standing rules (docs/README.md §9) apply everywhere: free-tier only, no invented
   numbers/sources, one PR per phase, never touch main directly, always stop and wait for
   me to say "go phase N."
```

---

## 11. If you only remember one thing from this file

Answer questions #1 and #2 in §5 before uploading anything else. Everything downstream of those two either has a working default already written into the docs, or is genuinely fine to figure out as its own phase comes up.

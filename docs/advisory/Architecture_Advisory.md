# Architecture — Personalized Crop Advisory Layer

**Project:** Smart Crop Advisory System (SIH25010 origin, solo rebuild)
**Stack:** Next.js (Vercel) · FastAPI · Supabase Postgres (+ pgvector) · Gemini (LLM + embeddings) · Bhashini (multilingual) · GitHub
**Version:** v1 · 2026-09-29
**Audience:** Antigravity IDE agent (primary), Jinay (reviewer)
**Depends on:** `Architecture_MarketData_Weather.md` (this layer calls its weather `service.get_summary()` directly — no HTTP hop, no new weather integration) and, optionally, its market layer for the cross-link idea in §2.

Put this file and its companion `Implementationplan_Advisory.md` in the repo under `docs/advisory/`.

---

## 0. Operating rules for Antigravity (read first)

1. Read this file and `Implementationplan_Advisory.md` completely before writing code. Also skim `Architecture_MarketData_Weather.md` §6 (types) and §10.2 (weather API) — this layer is a **consumer** of that service, not a reimplementation.
2. **Phase 0 is reconnaissance, not coding** — same rule as the data-layer project. Map onto the real repo; don't duplicate the existing RAG/Gemini/Bhashini wiring if it already exists, extend it.
3. **Never let the LLM invent a number that matters.** Dosages, thresholds, day-counts, ₹ figures — anything a farmer could act on — must come from a retrieved source or a computed value in the context object (§12), never from the model's parametric memory. This is the single most important rule in this document; §17 explains why and how it's enforced.
4. **Free only.** No paid API, no paid plan upgrades.
5. **Never invent** a data source, endpoint, or figure. If a real source's format differs from what's documented here, adapt in the ingestion layer, log a WARNING, and record it in `recon.md`.
6. Ask the user **only** the questions in §21, once, after Phase 0. Everything else has a default here.
7. Git: branch from `dev` as `feature/advisory-phase-N`, one PR per phase into `dev`.
8. Do not start a phase until the user says `go phase N`.

---

## 1. Goals, non-goals, constraints

**Goals**
- G1. Ground every piece of advice in a named, citable source — ICAR/State Agricultural University (SAU) agronomy references, not the model's general knowledge.
- G2. **Personalize**, not generalize: the same question from two farmers with different locations, crops, sowing dates, and soil gets two different, specifically-reasoned answers.
- G3. Cover the 6 deep-advisory crops in real depth (per the project's existing stated direction) rather than many crops shallowly.
- G4. Real disease/pest detection from a leaf photo, trained on real data (replacing the placeholder/untrained checkpoint from the first attempt).
- G5. Multilingual, via the already-chosen Bhashini integration.
- G6. Everything at $0, reusing the same Supabase project as the market/weather layer — no new infrastructure.

**Non-goals**
- No yield-prediction ML model, no price-forecasting model. (Yield/price *prediction* is a much harder, data-hungry problem than grounded advisory generation — see §3's honest framing of what ML is actually doing here.)
- No agronomic claim ships without a source. If nothing relevant was retrieved, the system says so — it does not let the LLM fill the gap.
- No real-time government-portal integration (GKMS, Soil Health Card) — those systems don't expose stable public APIs (§5.2 explains what was actually found). Their **outputs** (published advisories, bulk soil datasets) are used as reference data, not live services.

**Constraints:** same $0 / Supabase-Free / solo-dev constraints as the data-layer project — see `Architecture_MarketData_Weather.md` §1's constraints table; they apply here unchanged.

---

## 2. Ideas added beyond what was asked

You invited this, so flagging clearly what's mine versus what you asked for:

1. **A visible "grounded in" trail on every answer** — not just the prose, but the actual numbers used (today's forecast rain, the farmer's GDD-based growth stage, the soil comparison) shown alongside it, with a link to the source passage. This turns "trust me" into "check me," which matters more in agriculture than almost anywhere — a wrong pesticide dose or a bad irrigation call costs a season. It also happens to be a strong demo/judging feature: it's visibly not a generic chatbot answer.
2. **A confidence indicator on advisory responses**, structurally identical to the weather layer's `confidence` field (§4.2 of the other architecture) — `grounded` (retrieved + computed context both present and relevant), `partial` (one side thin), `insufficient` (say so, don't guess). Same design language across the whole app.
3. **A lightweight feedback loop** — a thumbs up/down on each answer, logged with which RAG chunks were used. You don't need to build a re-ranking model on this data now; just log it (§19), so there's real data to look at in three months instead of starting from zero.
4. **A cross-link to the market layer** — if the farmer's tracked crop is within ~2 weeks of harvest (from the GDD stage engine, §7) and they ask a market-adjacent question, surface the nearby mandi price trend from `Architecture_MarketData_Weather.md`'s `/api/market/trend` alongside the agronomic answer. Small, optional, reuses infrastructure that already exists — not a new feature to build from scratch.

---

## 3. The three-engine model — what ML is actually doing here

This is the direct answer to "what ML is used, how to train it": **almost none of this system is a trained model.** Being precise about that now avoids solving the wrong problem later.

| Engine | What it is | Trained? | Why |
|---|---|---|---|
| **Computation** (§7–9) | Growth stage from Growing Degree Days, water requirement from FAO-56 crop coefficients, soil suitability comparison | **No — deterministic formulas** over reference tables and live weather data | These are well-established agronomic formulas, not statistical patterns to learn. A formula is auditable, reproducible, and doesn't need thousands of labeled examples you don't have. |
| **Retrieval (RAG)** (§10) | Semantic search over embedded ICAR/SAU agronomy text, disease-treatment guidance, scheme content | **No training** — embeddings come from a pre-trained model (`gemini-embedding-001`) called at ingestion and query time; nothing is fine-tuned | RAG's job is finding the right paragraph, not learning agronomy from scratch. Off-the-shelf embeddings are good at semantic similarity out of the box. |
| **Generation** | Gemini 2.5 Flash turns (context + retrieved text) into fluent, personalized, farmer-facing language | **No training — prompting only** | The LLM's job is *phrasing*, grounded by what §12's context object hands it. It is explicitly instructed not to add facts beyond that context (§17). |
| **Disease/pest detection** (§11) | MobileNetV2 (ImageNet-pretrained) fine-tuned on the PlantVillage dataset to classify a leaf photo into a disease/healthy label | **Yes — this is the one real training job in the whole system** | Image classification from pixels genuinely needs a trained visual model; there's no formula for "is this a fungal lesion." |

So: **one CV model to train** (§11), **three deterministic engines** to implement correctly (§7–9), **one RAG pipeline** to populate with good source documents (§5, §10), and **prompting discipline** to keep the LLM from making things up (§17). That's a much smaller and more testable build than "train an AI for farming advice" sounds like — and a more honest one, since a solo project training a custom yield/advisory model from scratch on a small dataset would very likely be *less* reliable than this grounded-retrieval approach.

---

## 4. System context

```
Farmer (app, logged in)
   │  "should I irrigate today?" / "what's wrong with my tomato leaf?" (+ optional photo)
   ▼
FastAPI  /api/advisory/ask  or  /api/advisory/disease-check
   │
   ├─► farmer_profile + farms  (§6, Supabase)         — who they are, what/where/when they grow
   ├─► weather.service.get_summary(farm.grid_key)     — REUSED from the data layer, no new call
   ├─► growth_stage_engine(farm, weather history)      (§7) — GDD → current crop stage
   ├─► water_requirement_engine(stage, weather)         (§8) — ETc vs rainfall/irrigation logged
   ├─► soil_suitability_engine(farm.soil, crop)          (§9) — flags, not a model
   ├─► [if photo] disease_model.predict(image)          (§11) — MobileNetV2, one forward pass
   ├─► rag.retrieve(crop, stage, disease_label?, query)  (§10) — pgvector semantic search, filtered
   │
   ▼
context_assembly (§12) → prompt → Gemini 2.5 Flash → (→ Bhashini if non-English) → response + sources + confidence
   │
   ▼
advisory_log (§13, §19) — for the feedback loop and future review
```

**Design principles** (mirrors the data-layer document's, applied here):
- **P1. Compute first, retrieve second, generate last.** The LLM is the last, least-trusted step — everything it's allowed to state as fact was either computed or retrieved before it ran.
- **P2. No source, no claim.** If retrieval returns nothing relevant, the answer says so rather than falling back to the model's general knowledge (§17).
- **P3. Personalization is structural, not a prompt trick.** The farmer's profile changes *which* weather grid, *which* GDD thresholds, *which* soil comparison, and *which* RAG filters are used — not just a sentence prepended to a generic answer.
- **P4. Reuse, don't rebuild.** Weather comes from the existing service. Storage is the same Supabase project. Embeddings and generation use the same Gemini key already in the project.

---

## 5. Data sources

### 5.1 Agronomy knowledge base (RAG corpus)

| Source | What it is | Access | License note |
|---|---|---|---|
| **ICAR Kharif Agro-Advisories for Farmers** (already found, icar.org.in) | National-level, crop-wise advisory content | PDF | Freely usable non-commercially with attribution (already verified) |
| **State Agricultural University "Package of Practices" (PoP)** — e.g. Kerala Agricultural University's *Package of Practices Recommendations: Crops*, updated periodically | The authoritative, standard agronomy reference in India — every SAU publishes one; "widely revered as the most authentic guide" for farmers and extension officers | Free PDF from each SAU's site | Check each SAU's own terms; most are freely distributed for extension/education use — verify per document, same as the ICAR PDF was |
| **ICAR-KRISHI Research Data Repository** (krishi.icar.gov.in) | Searchable repository of extension leaflets, crop-specific package-of-practices documents from ICAR institutes (e.g., CAZRI, KVKs) | PDF, per-document | Has an explicit "ICAR Data Use Licence" — read it once, applies across the repository |
| **RKMP — Rice Knowledge Management Portal** (rkmp.co.in) and similar ICAR crop-specific expert portals (wheat, seed spices) | Crop-specific production know-how, FAQs, pest/disease guidance, in English and local languages | Web content | Check page-level terms |
| **KVK (Krishi Vigyan Kendra) network** publications | 731+ district-level centers publish practical, localized extension leaflets (irrigation, pest management, low-cost techniques) | PDF, per-KVK site | Check per-document |

**Get the SAU PoP for your tracked states**, not just the one national ICAR PDF — the ICAR document is a good general layer; the state PoP is where crop-variety-specific, region-adjusted numbers (sowing windows, spacing, exact fertilizer schedules) live. This is the single highest-value addition to what's already been found.

### 5.2 Weather-linked advisory — precedent, not a live source

**IMD's Gramin Krishi Mausam Sewa (GKMS)** is the government's own version of exactly what this project does: District Agromet Units combine a 5-day weather forecast with crop-stage information to issue twice-weekly (Tuesday/Friday) advisories, disseminated via SMS, IVRS, and the mKisan portal. It is genuinely the right model to imitate — but **it is not a live data source to integrate**: bulletins are PDF/SMS/IVRS, not an API, and the District Agromet Unit network was actually **shut down by IMD in March 2024** with a revival only planned as of the sources checked. Use it as **design precedent** (§4's flow mirrors it deliberately) — the differentiator this project already chose against Bharat-VISTAAR (hyper-local + live sensor data) is exactly what GKMS's district-level, twice-weekly cadence can't offer.

### 5.3 Crop water requirement — FAO-56 crop coefficients (Kc)

**FAO Irrigation and Drainage Paper 56**, Table 12, is the global standard reference for crop coefficients (Kc at initial/mid/late growth stages) across cereals, legumes, oil crops, solanaceous vegetables, and more — free, UN-published, and the basis nearly every irrigation-scheduling tool in the world uses. §8 shows exactly how this becomes an actual irrigation number using weather data you already have (ET₀ is already a field in `weather_daily_fused` from the data layer).

### 5.4 Soil

| Source | Granularity | Access | Use |
|---|---|---|---|
| **Farmer's own input** (self-reported soil type, or their Soil Health Card's N/P/K/pH if they have one) | Farm-specific | Onboarding form | **Best available — always prefer this when present** |
| **Soil Health Card scheme aggregate data** — bulk district/block-level soil test results (N, P, K, pH, EC, organic carbon, micronutrients), published under the Ministry of Agriculture's Soil Health Card scheme, mirrored as a structured dataset (e.g. via indiadataportal.com's CKAN interface, ~738 districts, block/village granularity) | District/block | Bulk CSV/CKAN API download, one-time + periodic refresh | **Default when the farmer hasn't entered their own soil data** — genuinely India-specific and far more granular than a global product |
| **SoilGrids (ISRIC)** — global 250 m machine-learning soil property maps (texture, pH, organic carbon, CEC), CC-BY 4.0 | 250 m grid, global | REST API *or* bulk raster/WCS | **Last-resort fallback only** — two real caveats: (1) it is itself ML-predicted, not measured, so accuracy is explicitly lower in data-sparse regions; (2) its REST API has had unannounced outages/pauses — if used, treat as best-effort with a timeout and fall back to the district SHC default, never block on it |

**Recommendation:** onboarding asks the farmer for soil type in plain language (a short picklist: clay / sandy / loamy / black cotton / red / alluvial, etc. — whatever your SAU's PoP uses) with an optional "I have a Soil Health Card" path for exact N/P/K numbers. Behind the scenes, if the farmer skips this, default to the district-level Soil Health Card aggregate for their location; only reach for SoilGrids if even that's missing.

### 5.5 Disease/pest detection training data

**PlantVillage** — the standard benchmark dataset for this exact task: ~54,000 labeled leaf images across 38 classes covering roughly 14 crop species (healthy + multiple disease states each). Transfer learning with MobileNetV2 (ImageNet-pretrained, fine-tuned on PlantVillage) consistently reaches **~95–97% validation accuracy** across multiple independent studies. Full detail and the honest caveat about lab-vs-field images in §11.

### 5.6 Disease treatment knowledge

A CV model outputs a **label** ("Tomato — Early Blight"), not a treatment plan — treatment text must come from the same kind of curated, citable sources as §5.1 (ICAR/SAU plant-protection sections of the PoP documents, KVK pest-management leaflets), retrieved via the same RAG pipeline with `doc_type='disease_treatment'`. **Never let the LLM generate a pesticide name or dosage from its own knowledge** — see §17.

---

## 6. Personalization: farmer and farm profile

This is the mechanism that turns a generic answer into "your soil, your sowing date, your forecast."

### 6.0 Login method — a gap none of the earlier docs actually settled

Every table below assumes a Supabase Auth `auth.users` row exists, but nothing so far specified *how* a farmer gets one. For this audience, **phone number + OTP** is the right default, not email/password — email adoption is far less universal among Indian farmers than a phone number, and Supabase Auth supports phone/OTP natively (via an SMS provider — Twilio and MSG91 are the common choices; MSG91 is India-focused and often cheaper per SMS, worth comparing costs for whichever free-tier/trial allowance fits a student project). Google/email login can stay as a secondary option for demo convenience (judges, testers) without being the primary farmer-facing path. This needs a decision, not a default silently assumed — add it to §21's questions if still open when Phase 1 starts.

```sql
create table farmer_profile (
  id                 uuid primary key references auth.users(id),   -- Supabase Auth user
  full_name          text,
  preferred_language text not null default 'en',        -- BCP-47 or Bhashini's own codes — match what Bhashini expects
  phone              text,
  created_at         timestamptz not null default now()
);
-- RLS: a farmer can only read/write their own row (auth.uid() = id). Standard Supabase pattern.

create table farms (
  id              bigserial primary key,
  farmer_id       uuid not null references farmer_profile(id) on delete cascade,
  name            text not null default 'My farm',           -- lets a farmer with 2 plots distinguish them
  lat             numeric(8,5) not null,
  lon             numeric(8,5) not null,
  grid_key        text not null,                              -- SAME grid_key convention as the weather layer — reuse, don't reinvent
  state           text not null,
  district        text not null,
  soil_type       text,                                        -- farmer-entered picklist value, or null
  soil_source     text not null default 'farmer_input'
                   check (soil_source in ('farmer_input','soil_health_card','district_default','soilgrids')),
  soil_npk        jsonb,                                        -- {"n": .., "p": .., "k": .., "ph": ..} if the farmer has a Soil Health Card
  irrigation_type text check (irrigation_type in ('borewell','canal','rainfed','drip','sprinkler','other')),
  field_size_acres numeric(6,2),
  created_at      timestamptz not null default now()
);

create table farm_crops (
  id           bigserial primary key,
  farm_id      bigint not null references farms(id) on delete cascade,
  crop         text not null,              -- must be one of the 6 deep-advisory crops for full engine support (§1 G3)
  variety      text,                       -- optional — lets Kc/GDD tables get more specific if you track variety-level data
  sowing_date  date not null,
  season       text,                       -- kharif/rabi/zaid — useful for picking the right PoP season chapter
  status       text not null default 'active' check (status in ('active','harvested','failed')),
  unique (farm_id, crop, sowing_date)
);
create index farm_crops_active_idx on farm_crops (farm_id) where status = 'active';

alter table farmer_profile enable row level security;
alter table farms          enable row level security;
alter table farm_crops     enable row level security;
-- Policy pattern for all three: farmer_id (or the chain to it) must equal auth.uid().
```

**Onboarding flow (once, editable later):** name + language → add a farm (location — let them drop a pin or search; state/district can be reverse-geocoded) → soil (picklist, or "I have a Soil Health Card" → enter N/P/K/pH) → add crop(s) with sowing date and season → done. Every field has a sensible "skip for now" — personalization degrades gracefully to district-level defaults, it never blocks the farmer from asking a question.

---

## 7. Growth-stage engine (Growing Degree Days)

Why not just "days since sowing"? Because two identical sowing dates in a cool spell versus a heat wave produce plants at very different real growth stages — GDD (thermal time) tracks the plant's actual physiological progress, which is exactly the improvement a temperature-history-aware system can make over a static calendar. This is standard agronomic method, not a novel idea — and it's basically free to compute here because the daily Tmax/Tmin history is **already sitting in `weather_daily_fused`** from the data layer.

```
GDD_day = max(0, (Tmax_c + Tmin_c) / 2 − T_base)
cumulative_GDD(farm_crop) = Σ GDD_day  for day in [sowing_date, today]
```

```sql
create table crop_stage_norms (
  crop            text not null,
  stage_order     smallint not null,             -- 1, 2, 3... in sequence
  stage_name      text not null,                 -- e.g. 'tillering', 'flowering' — use the PoP's own terminology per crop
  gdd_base_c      numeric(4,1) not null,          -- T_base for this crop (constant across its stages)
  gdd_cumulative_at_stage_end numeric(6,1) not null,  -- cumulative GDD threshold marking the end of this stage
  typical_days_fallback smallint,                 -- calendar-day estimate, used ONLY if weather history is unavailable
  source          text not null,                  -- which PoP/reference this came from — required, not optional
  primary key (crop, stage_order)
);
```

```python
def current_growth_stage(farm_crop, weather_history) -> StageResult:
    cum_gdd = sum(max(0, (d.tmax_c + d.tmin_c)/2 - T_BASE[farm_crop.crop])
                  for d in weather_history if d.date >= farm_crop.sowing_date)
    stages = crop_stage_norms.for_crop(farm_crop.crop)     # ordered by stage_order
    stage = next((s for s in stages if cum_gdd <= s.gdd_cumulative_at_stage_end), stages[-1])
    return StageResult(stage_name=stage.stage_name, cumulative_gdd=cum_gdd,
                        method="gdd" if weather_history_covers_full_range else "calendar_fallback",
                        source=stage.source)
```

**`crop_stage_norms` must be populated per crop from the actual PoP documents (§5.1) for your 6 crops — the `T_base` and stage-GDD thresholds vary by crop and are exactly the kind of number that should never be guessed.** Populating this table accurately, sourced and cited, is real Phase-2 work (§ Implementation Plan), not a placeholder to auto-generate.

---

## 8. Water-requirement engine

```
ETc_mm_per_day = Kc(current_stage) × ET0_mm_per_day
```
`ET0` is **already computed daily** by the weather layer (`et0_fao_evapotranspiration` in `weather_daily_fused`, itself FAO-56 Penman-Monteith from Open-Meteo). `Kc` comes from the crop-coefficient reference table (§5.3), keyed by the growth stage from §7.

```sql
create table crop_kc_reference (
  crop      text not null,
  stage_name text not null,    -- must match crop_stage_norms.stage_name for the same crop
  kc        numeric(3,2) not null,
  source    text not null default 'FAO-56 Table 12',
  primary key (crop, stage_name)
);
```

```python
def irrigation_recommendation(farm, stage_result, weather_summary) -> IrrigationAdvice:
    kc = crop_kc_reference.get(farm_crop.crop, stage_result.stage_name)
    etc_today = kc * weather_summary.days[today].et0_mm
    etc_7d = sum(kc * d.et0_mm for d in weather_summary.days if d.phase in ("past","today"))
    rain_7d = weather_summary.metrics.rain_7d_mm
    deficit_mm = max(0, etc_7d - rain_7d)          # naive water balance — no soil moisture buffering yet (see Risks)
    return IrrigationAdvice(etc_today_mm=round(etc_today,1), etc_7d_mm=round(etc_7d,1),
                             rain_7d_mm=rain_7d, deficit_mm=round(deficit_mm,1),
                             confidence=weather_summary.metrics.confidence)   # inherits weather's own confidence
```

This gives the farmer an actual number — "your crop needed about 32mm of water this week, it rained 9mm, consider irrigating roughly 20-25mm" — computed, not phrased by the LLM from nothing. The LLM's job is only to phrase `IrrigationAdvice` in natural language (§12).

**Honest limitation:** this is a simple water-balance (ETc vs rainfall), not a full soil-moisture model — it doesn't account for stored soil moisture, drainage, or runoff. It's a genuinely useful first-order signal, not a substitute for a real irrigation-scheduling model. If/when the IoT soil-moisture sensor is integrated, its reading is a *far* better input than this estimate and should override it when available and fresh (that's a specific, well-defined future integration point — not detailed further here per your instruction).

---

## 9. Soil-suitability engine

```sql
create table crop_soil_suitability (
  crop            text not null,
  ideal_soil_types text[] not null,       -- e.g. ARRAY['loamy','black cotton'] — from the PoP
  ideal_ph_min    numeric(3,1),
  ideal_ph_max    numeric(3,1),
  notes           text,                    -- amendment guidance for common mismatches, from the PoP
  source          text not null,
  primary key (crop)
);
```
```python
def soil_suitability_check(farm, crop) -> list[SoilFlag]:
    ref = crop_soil_suitability.get(crop)
    flags = []
    if farm.soil_type and farm.soil_type not in ref.ideal_soil_types:
        flags.append(SoilFlag("soil_type_mismatch", farm.soil_type, ref.ideal_soil_types, ref.notes))
    if farm.soil_npk and farm.soil_npk.get("ph"):
        ph = farm.soil_npk["ph"]
        if not (ref.ideal_ph_min <= ph <= ref.ideal_ph_max):
            flags.append(SoilFlag("ph_out_of_range", ph, (ref.ideal_ph_min, ref.ideal_ph_max), ref.notes))
    return flags   # empty list = no flags = don't mention soil at all, don't manufacture a non-issue
```
Same rule as everywhere else: `notes`/amendment guidance is sourced text, not LLM invention.

---

## 9b. Climate/temperature suitability engine

Answers exactly the question "is the temperature/humidity right for this crop, right now" — the engine behind your own worked example ("optimum temperature in Nashik to grow wheat is X, yours is Y"). Same pattern as §9, one more reference table:

```sql
create table crop_climate_suitability (
  crop              text not null,
  stage_name        text,                    -- null = applies across all stages; a specific stage overrides the crop-wide row
  ideal_temp_min_c  numeric(4,1) not null,
  ideal_temp_max_c  numeric(4,1) not null,
  ideal_humidity_min_pct numeric(4,1),
  ideal_humidity_max_pct numeric(4,1),
  notes             text,                     -- what to do/expect near or outside the range, from the source
  source            text not null,
  primary key (crop, coalesce(stage_name, ''))
);
```
```python
def climate_suitability_check(crop, stage_name, observed_temp_c, observed_humidity_pct, reading_source) -> ClimateVerdict:
    ref = crop_climate_suitability.get(crop, stage_name) or crop_climate_suitability.get(crop, None)
    temp_ok = ref.ideal_temp_min_c <= observed_temp_c <= ref.ideal_temp_max_c
    margin_c = min(observed_temp_c - ref.ideal_temp_min_c, ref.ideal_temp_max_c - observed_temp_c)
    verdict = "suitable" if temp_ok else ("marginal" if abs(margin_c) <= MARGINAL_BAND_C else "unsuitable")
    return ClimateVerdict(verdict=verdict, observed_temp_c=observed_temp_c, ideal_range=(ref.ideal_temp_min_c, ref.ideal_temp_max_c),
                           margin_c=round(margin_c,1), reading_source=reading_source, notes=ref.notes)
```
**`observed_temp_c`/`observed_humidity_pct` and `reading_source` are deliberately generic inputs, not a weather-API call baked into this function** — for a farmer with no IoT device, the caller passes the weather layer's forecast ambient temperature for today (`reading_source="weather_forecast"`); for a farmer with a live sensor, the caller passes the fresh device reading instead (`reading_source="iot_live"`). **This is the exact hook `Architecture_IoT.md` uses** — that file defines the override rule for which value gets passed in, the freshness check, and the worked example for the IoT case. Nothing here changes based on whether IoT exists; only the input changes.

---

## 10. RAG knowledge pipeline

### 10.1 Storage — reuse Supabase, add `pgvector`
```sql
create extension if not exists vector;

create table rag_documents (
  id            bigserial primary key,
  title         text not null,
  doc_type      text not null check (doc_type in ('agronomy_pop','disease_treatment','govt_scheme')),
  crop          text,                       -- null for crop-agnostic docs (e.g. a scheme document)
  state         text,                       -- null for national-level docs (e.g. the ICAR Kharif PDF)
  source_url    text not null,
  license_note  text not null,              -- what you verified about reuse rights — required, not optional
  ingested_at   timestamptz not null default now(),
  version_tag   text                        -- e.g. 'KAU-PoP-2016-15th-ed' — PoPs get revised; track which edition
);

create table rag_chunks (
  id            bigserial primary key,
  document_id   bigint not null references rag_documents(id) on delete cascade,
  crop          text,                        -- denormalized from the parent doc, for fast filtering
  doc_type      text not null,
  chunk_text    text not null,
  chunk_index   integer not null,
  page_number   integer,                     -- for citation display back to the farmer
  embedding     vector(768) not null          -- gemini-embedding-001 at 768 dims (Matryoshka) — good balance of storage/quality
);
create index rag_chunks_embedding_idx on rag_chunks using hnsw (embedding vector_cosine_ops);
create index rag_chunks_crop_idx on rag_chunks (crop, doc_type);

create or replace function match_rag_chunks(query_embedding vector(768), match_crop text, match_doc_types text[], match_count int default 6)
returns table (chunk_text text, document_id bigint, page_number int, similarity float)
language sql stable as $$
  select chunk_text, document_id, page_number, 1 - (embedding <=> query_embedding) as similarity
  from rag_chunks
  where (match_crop is null or crop = match_crop or crop is null)
    and doc_type = any(match_doc_types)
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### 10.2 Ingestion (one job, run per new/updated source document)
```python
def ingest_document(pdf_path, title, doc_type, crop, state, source_url, license_note, version_tag):
    doc_id = rag_documents.insert(title=title, doc_type=doc_type, crop=crop, state=state,
                                   source_url=source_url, license_note=license_note, version_tag=version_tag)
    text_by_page = extract_text_per_page(pdf_path)          # pypdf or similar
    chunks = chunk_by_semantic_sections(text_by_page, target_tokens=300, overlap_tokens=50)
    for i, chunk in enumerate(chunks):
        embedding = gemini_embed(chunk.text, task_type="RETRIEVAL_DOCUMENT")
        rag_chunks.insert(document_id=doc_id, crop=crop, doc_type=doc_type,
                           chunk_text=chunk.text, chunk_index=i, page_number=chunk.page, embedding=embedding)
```
Chunk by section/paragraph boundaries where possible (PoPs have clear headers: sowing, spacing, fertilizer, irrigation, pests) rather than fixed character counts — retrieval quality depends heavily on this, and these documents are structured enough to make it worth the extra parsing effort.

### 10.3 Retrieval (per query)
```python
def retrieve(crop, stage_name, disease_label, user_query, k=6) -> list[RetrievedChunk]:
    query_text = f"{crop} {stage_name or ''} {disease_label or ''} {user_query}".strip()
    query_embedding = gemini_embed(query_text, task_type="RETRIEVAL_QUERY")
    doc_types = ["disease_treatment"] if disease_label else ["agronomy_pop"]
    return match_rag_chunks(query_embedding, match_crop=crop, match_doc_types=doc_types, match_count=k)
```

---

## 11. Disease/pest detection (the one trained model)

**Data:** PlantVillage (§5.5) — start with whichever of your 6 crops it actually covers (verify class list against the dataset before committing — not all crops have PlantVillage coverage; where a crop isn't covered, disease detection for it is out of scope until a labeled dataset exists, and the advisory chat can still answer text questions about that crop's known pests via RAG without a CV model).

**Model:** MobileNetV2, ImageNet-pretrained, fine-tuned — this specific combination is extensively validated in the literature at ~95–97% accuracy on PlantVillage, and it's small enough to serve cheaply.

```python
# training/train_disease_model.py — run once (or re-run when you add data), not part of the live request path
base = tf.keras.applications.MobileNetV2(input_shape=(224,224,3), include_top=False, weights='imagenet')
base.trainable = False                          # Phase 1: feature extraction
x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
x = tf.keras.layers.Dropout(0.2)(x)
outputs = tf.keras.layers.Dense(NUM_CLASSES, activation='softmax')(x)
model = tf.keras.Model(base.input, outputs)
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit(train_ds, validation_data=val_ds, epochs=10)

base.trainable = True                            # Phase 2: fine-tune the top block(s)
for layer in base.layers[:-30]: layer.trainable = False
model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit(train_ds, validation_data=val_ds, epochs=5)
model.save('disease_model_v1.keras')
```
Use `tf.keras.utils.image_dataset_from_directory` with an 80/20 train/val split, `image_size=(224,224)`, and standard augmentation (rotation, flip, zoom, brightness) on the training set only — augmentation is consistently reported to reduce overfitting on this dataset. Track validation accuracy **per class**, not just overall — PlantVillage classes are imbalanced.

**Honest limitation (train this in, don't ignore it):** PlantVillage images are lab-quality — uniform background, controlled lighting. Real farmer photos (field background, variable light, blur) will score measurably lower than the ~95%+ benchmark. Mitigations: heavy augmentation as above; if time allows, hold out a small self-collected set of realistic phone photos as a second validation set so you know your *real* accuracy, not just the benchmark's; in the UI, show the model's confidence score and phrase low-confidence results as "possibly X — a local KVK/extension officer can confirm" rather than a flat diagnosis.

**Serving:** a single `/api/advisory/disease-check` endpoint — receives an image, runs one forward pass (CPU inference is fine for MobileNetV2 at this scale), returns `{label, confidence}`. That label feeds `retrieve(doc_types=["disease_treatment"])` (§10.3) for the actual treatment text — **the CV model's output is a search key into cited text, never itself the final advisory sentence.**

---

## 12. Advisory generation — context assembly and the worked example

### 12.1 The context object (everything the LLM is allowed to know for this answer)
```python
@dataclass
class AdvisoryContext:
    farmer_name: str
    farm: dict                       # location, state, district, soil_type, irrigation_type
    crop: str; sowing_date: date; season: str
    growth_stage: StageResult        # §7
    irrigation: IrrigationAdvice     # §8
    soil_flags: list[SoilFlag]       # §9, may be empty
    climate_check: ClimateVerdict    # §9b — built from IoT if fresh (Architecture_IoT.md), else weather_summary
    weather_summary: dict            # from weather.service.get_summary() — current + 7-day forecast + confidence
    iot_reading: dict | None         # the live device reading actually used, if any — for the sources/computed panel (§2 idea 1)
    disease: dict | None             # {label, confidence} if a photo was analyzed, else None
    retrieved_chunks: list[RetrievedChunk]   # §10.3 — the ONLY source of "what to do" text
    user_query: str
```

### 12.2 The prompt (structure, not exact final wording — tune this in Phase 3)
```
SYSTEM:
You are an agricultural advisory assistant for Indian farmers. You answer ONLY using the
CONTEXT block below. Do not use outside knowledge for anything a farmer could act on —
dosages, quantities, timings, ₹ figures, thresholds. If the CONTEXT does not contain
something the farmer asked about, say so plainly and suggest they contact their nearest
Krishi Vigyan Kendra — do not guess.
Always ground weather- or water-related statements in the WEATHER and IRRIGATION numbers
given. Always cite which source (title + page, from RETRIEVED_PASSAGES) supports any
specific recommendation, dosage, or threshold you state, in a short "Source:" line.
Respond in {farmer.preferred_language}. Keep it practical and specific to THIS farmer.

CONTEXT:
Farmer: {farmer_name}, farm in {district}, {state}. Soil: {soil_type} (flags: {soil_flags}).
Crop: {crop}, sown {sowing_date} ({season}). Current stage: {growth_stage.stage_name}
(estimated via {growth_stage.method}).
WEATHER: {weather_summary — current + 7-day forecast, confidence}
IRRIGATION: needed ~{irrigation.etc_7d_mm}mm over the last 7 days, {irrigation.rain_7d_mm}mm
rain fell, estimated deficit {irrigation.deficit_mm}mm. (confidence: {irrigation.confidence})
{if disease}: Photo analysis suggests {disease.label} ({disease.confidence} confidence).
RETRIEVED_PASSAGES:
{for each retrieved_chunks: "[{document.title}, p.{page_number}]: {chunk_text}"}

FARMER'S QUESTION: {user_query}
```

### 12.3 Worked example (trace it end to end)

> **Farmer asks:** "Should I water my tomatoes today?"
> **Profile:** Tomato, sown 45 days ago, Nashik district, loamy soil.
> **Computed:** GDD → stage = "flowering" (cumulative GDD 620, threshold table says flowering runs 550–850 for this crop's `T_base`). Kc at flowering (from `crop_kc_reference`) = 1.15. ET0 today (from the weather layer) = 4.8mm → ETc today = 5.5mm. 7-day: ETc_7d = 34mm, rain_7d = 6mm → deficit = 28mm. Weather confidence: `high`.
> **Soil check:** loamy is in tomato's ideal soil types → no flag.
> **Retrieved:** two passages from the Maharashtra SAU PoP's tomato-irrigation section on flowering-stage water sensitivity.
> **LLM output (English, before Bhashini translation if needed):** *"Your tomatoes are in the flowering stage — a moisture-sensitive period (Source: [Maharashtra PoP, p.112]). Based on this week's weather (high confidence), your plants needed about 34mm of water and only 6mm of rain fell, leaving a shortfall of roughly 28mm. Consider irrigating today — about 25-30mm would cover the gap. Your loamy soil is well-suited for tomato, no soil concerns."*

Note what's LLM-authored (the phrasing, the framing) versus what's computed/retrieved (every number, the source citation, the soil verdict) — that split is the whole point of §3.

---

## 13. Data model — advisory log (for §2's feedback loop and §18's evaluation)

```sql
create table advisory_queries (
  id                bigserial primary key,
  farmer_id         uuid not null references farmer_profile(id),
  farm_id           bigint references farms(id),
  user_query        text not null,
  context_snapshot  jsonb not null,          -- the AdvisoryContext actually used — for debugging/audit
  response_text     text not null,
  retrieved_chunk_ids bigint[] not null default '{}',
  confidence        text not null check (confidence in ('grounded','partial','insufficient')),
  feedback          smallint,                 -- null = no feedback yet, 1 = up, -1 = down
  created_at        timestamptz not null default now()
);
alter table advisory_queries enable row level security;
-- policy: farmer_id = auth.uid()
```
`context_snapshot` is what makes an answer auditable after the fact — if a farmer disputes advice, or you're debugging a bad response, you can see exactly what the system knew when it generated it.

---

## 14. API contract

| Endpoint | Purpose |
|---|---|
| `POST /api/farmer/profile`, `POST /api/farmer/farms`, `POST /api/farmer/farms/{id}/crops` | Onboarding/profile CRUD (§6) |
| `POST /api/advisory/ask` `{farm_id, crop, query}` | Main flow (§4, §12). Returns `{response, confidence, sources: [{title, page, url}], computed: {growth_stage, irrigation, soil_flags}}` — sources and computed values are always returned alongside the prose, per §2 idea 1 |
| `POST /api/advisory/disease-check` `{farm_id, crop, image}` | §11 — returns `{label, confidence}`, and internally feeds into the same `ask` flow if the farmer follows up with "what do I do about it" |
| `POST /api/advisory/queries/{id}/feedback` `{up: bool}` | §2 idea 3 |
| `GET /api/advisory/schemes?query=` | Government scheme section (§16) — same RAG infra, `doc_type='govt_scheme'`, no personalization needed beyond language |

---

## 15. Multilingual (Bhashini) — research-backed, for Hindi/Marathi/Gujarati specifically

**Bhashini is the right call, and the research says to route *both* directions through it rather than leaning on Gemini's own multilingual generation.** Bhashini (the National Language Translation Mission's platform) is free, government-run Digital Public Infrastructure, explicitly covers all 22 scheduled languages including Hindi, Marathi, and Gujarati, and its translation engine is itself built on AI4Bharat's IndicTrans2 models — so using Bhashini already gets you IndicTrans2-quality translation through one stable hosted API, with no separate self-hosting to consider unless Bhashini's own API ever becomes unavailable.

**Why not just have Gemini answer directly in Hindi/Marathi/Gujarati and skip Bhashini for text?** It was tempting to simplify to that — one fewer API call — but the evidence doesn't support it being reliable across all three of your target languages. Gemini's multilingual quality is genuinely uneven: Hindi performs well, but Gujarati specifically has documented, reported failures (developers finding Gemini won't generate in Gujarati at all in some cases), and independent evaluation work (e.g., the IndicParam benchmark for low-resource Indian languages) treats Gemini-2.5-Flash's performance on languages like Gujarati and Marathi as a genuinely open research question, not a solved one. Shipping a design where Hindi works great and Gujarati silently fails or degrades is exactly the kind of inconsistency this project can't afford for a farmer-facing feature. **Keep the existing design: LLM reasoning and retrieval stay in English internally; Bhashini translates the farmer's query in and the final response out, uniformly, regardless of which of the three languages it is.** This also means quality is consistent across languages because it comes from one well-audited translation system, not three different levels of an LLM's native fluency.

**Retrieval stays English-only on purpose:** translate the query to English *before* embedding it (§10.3) rather than embedding it in the original language — the RAG corpus (PoP documents) is English, so English-query-against-English-corpus matching is more reliable than cross-lingual embedding matching, even though Gemini's embedding model does support cross-lingual retrieval reasonably well. No need to take on that extra uncertainty when the simpler path works.

**Language codes:** Bhashini's own language identifiers (`hi`, `mr`, `gu` are the standard ones you'll see across Bhashini integrations) — confirm the exact codes your specific Bhashini integration expects in Phase 0 recon, don't assume they match BCP-47 exactly.

**Practical integration:** this layer's job is just calling Bhashini correctly at the right two points — translate the user's query to English before retrieval, translate the final response back to `farmer_profile.preferred_language` before returning it. If Bhashini's API details need rediscovery, that's Phase 0 recon (the integration already exists per project history — extend it, don't rebuild it).

### 15.1 This is cross-cutting, not advisory-only

Multilingual support was asked for across all four features (advisory, mandi prices, weather, disease detection), not just this one — and it splits cleanly into two different problems that need two different solutions. See `docs/README.md`'s new multilingual-strategy section for the full cross-cutting design (which content is static-translate-once vs. live-Bhashini-per-request, and where each of the four features falls). The short version as it applies here: the advisory chat's free-form response text is **dynamic** (goes through Bhashini live, as above); but the 6 crop names, the disease class labels, and all UI chrome are **static** — a small, finite, curate-once translation dictionary, no API call needed per request.

---

## 16. Government scheme section (brief — shares this infrastructure)

Already a separately stated goal (static curated content, RAG-retrieved, not live eligibility checking). No new infrastructure needed: ingest scheme PDFs via §10.2 with `doc_type='govt_scheme'`, `crop=null`; `/api/advisory/schemes` (§14) is the same `retrieve()` + generation flow with `doc_types=["govt_scheme"]` and no farmer-specific computed context (schemes aren't personalized by GDD/soil). Keep it in this same RAG table rather than a parallel system — one ingestion pipeline, one retrieval function.

---

## 17. Safety, grounding, and hallucination controls

This is where G1/G2 either hold or don't. Concrete, testable rules:

1. **The system prompt (§12.2) explicitly forbids stating a number not present in CONTEXT.** This is necessary but not sufficient — LLMs still sometimes ignore instructions.
2. **Post-generation check (cheap, worth doing):** regex-scan the response for numbers (₹ figures, mm, kg, %, dates) and flag any that don't appear in `context_snapshot` for manual review during testing (§18). Don't try to auto-block in production yet — log and review first; over-aggressive blocking makes the assistant useless.
3. **`confidence` is computed, not asserted by the LLM:** `grounded` = retrieval returned ≥1 relevant chunk AND the computed engines had real data; `partial` = one side is thin (e.g. good RAG match but weather was `degraded`, or vice versa); `insufficient` = retrieval returned nothing relevant for the question asked → the response is a template ("I don't have reliable information on that for {crop} — try your nearest KVK") **not** a generated answer at all in that case.
4. **Dosage/chemical-name specifics are highest-risk** — for `disease_treatment` retrieval, require a minimum similarity threshold (tune in testing) before allowing the LLM to state a specific product/dosage; below threshold, degrade to general guidance ("a fungicide may help — confirm the specific product and dose with your KVK") rather than a possibly-wrong specific.
5. **Every response shown to the farmer carries its sources** (§14) — this is a product decision as much as a safety one; a farmer (or Jinay demoing to judges) can check any specific claim against the cited PoP page.

---

## 18. Testing and evaluation

- **Engine unit tests (no LLM, no network):** GDD accumulation math, Kc lookup, soil-flag logic — deterministic, easy, do these first.
- **Golden question set (~20–30 questions per crop, written by hand):** for each, a known-good expected *type* of answer (not exact text) and which source document should be cited. Run after any prompt change; a human (you) reviews the diffs — this is a small, manageable eval given the deep-6-crop scope.
- **Groundedness spot-check:** for a sample of golden-set runs, verify every specific number in the response traces back to `context_snapshot`.
- **CV model:** standard train/val split accuracy, **plus** a held-out set of real (non-PlantVillage) phone photos if you can collect even 20-30 per class — this is the number that actually matters for the demo and for farmers.
- **Load/cost sanity:** Gemini 2.5 Flash free tier is roughly 1,500 requests/day (not a hard guarantee — check your AI Studio console) — plenty for development and a demo; note it, don't need to build rate-limiting infrastructure yet.

---

## 19. Jobs and scheduling

Reuse the same GitHub Actions runner pattern as the data layer (`Architecture_MarketData_Weather.md` §11).

| Job | Trigger | Does |
|---|---|---|
| `ingest_rag_document.py` | `workflow_dispatch` (manual — you're adding a specific new PDF, this isn't a recurring crawl) | §10.2 for one document |
| `recompute_growth_stages.py` | Daily, after the weather ingest job | Recomputes `current_growth_stage` for all active `farm_crops` and caches the result (add a `farm_crop_stage_cache` table if query latency on `/api/advisory/ask` matters — start without it, add only if profiling says so) |
| `review_advisory_feedback.py` | Manual, weekly-ish | Pulls `advisory_queries where feedback = -1` for you to read — this is the actual mechanism behind §2 idea 3, not an automated retrain |

---

## 20. Risks and known limitations

| Risk / limitation | Impact | Mitigation |
|---|---|---|
| PoP/ICAR documents get revised periodically (see Kerala PoP's own edition history) | Stale numbers | `rag_documents.version_tag`; re-ingest when a newer edition is found; don't treat this as "done once" |
| GDD thresholds and Kc values must be sourced per crop, not guessed | Wrong growth-stage/irrigation numbers = bad advice | §7/§8 explicitly require a `source` column, no defaults shipped without one |
| PlantVillage is lab-quality images | Real-world CV accuracy lower than benchmark | §11's held-out real-photo set; confidence-aware phrasing in the UI |
| LLMs can ignore grounding instructions | A hallucinated specific number reaches a farmer | §17's layered controls; this is risk-reduction, not risk-elimination — say so honestly in any demo |
| Simple ETc-vs-rainfall water balance ignores soil moisture storage | Irrigation number is a first-order estimate, not precise | Documented as a limitation (§8); a live IoT soil-moisture reading is the real fix — see `Architecture_IoT.md` for the override design |
| GKMS/Soil Health Card have no stable public API | Can't live-integrate; DAMU network itself was disrupted | Used as reference data / precedent, not a live dependency (§5.2, §5.4) |
| Gemini model line gets deprecated on a schedule (2.5 Flash currently slated for an Oct 2026 shutdown per current docs) | Breaking change if ignored | Keep the model name in one config value; check Google's deprecation notices periodically |

---

## 21. Inputs needed from the user (ask once, after Phase 0)

| # | Question | Default if not answered |
|---|---|---|
| 1 | The exact 6 crop names (same list needed by the data-layer doc's §17 — if already answered there, reuse it) | Blocks §7/§8/§9's reference tables — must have real answer, no default |
| 2 | For each crop, does PlantVillage have matching disease classes? (check the dataset's class list) | CV scope narrows to whatever's covered; others get RAG-only pest guidance |
| 3 | Which SAU covers your tracked states — whose PoP to source? | Found in Phase 0/1 alongside the ICAR PDF already in hand |
| 4 | Bhashini integration status — already working, or needs rebuilding in the fresh repo? | Found in Phase 0 recon |
| 5 | Onboarding required before first question, or allowed to ask anonymously with degraded (non-personalized) answers? | Personalization optional — anonymous questions get district-level defaults, no farm-specific soil/GDD |

---

## 22. Environment variables

| Variable | Used by |
|---|---|
| `GEMINI_API_KEY` | LLM generation + embeddings (same key, reused) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | as in the data layer |
| `BHASHINI_API_KEY` / whatever the existing integration uses | Found in Phase 0 |
| `DISEASE_MODEL_PATH` or a model-hosting URL | §11 serving |

---

## 23. References
- ICAR Kharif Agro-Advisories for Farmers — icar.org.in (already verified by the user)
- Kerala Agricultural University, *Package of Practices Recommendations: Crops*, 15th ed. — kau.in (example of the SAU PoP pattern; get the equivalent for your tracked states)
- ICAR-KRISHI Research Data Repository — krishi.icar.gov.in
- RKMP (Rice Knowledge Management Portal) and ICAR expert-system initiatives — rkmp.co.in
- IMD Gramin Krishi Mausam Sewa SOP — mausam.imd.gov.in/imd_latest/contents/pdf/gkms_sop.pdf (design precedent; DAMU shutdown noted March 2024)
- FAO Irrigation and Drainage Paper 56, Table 12 (crop coefficients) — fao.org/3/x0490E/x0490e00.htm
- Soil Health Card scheme aggregate dataset — soilhealth.dac.gov.in; structured mirror via indiadataportal.com
- SoilGrids (ISRIC) — isric.org/explore/soilgrids, rest.soilgrids.org (note documented API reliability issues)
- PlantVillage dataset + MobileNetV2 transfer-learning benchmarks — multiple independent studies converging on ~95–97% validation accuracy (arxiv.org/pdf/2310.12509 and others)
- Gemini API — gemini-2.5-flash (generation), gemini-embedding-001 (embeddings, 768-dim Matryoshka) — ai.google.dev/gemini-api/docs
- Supabase + pgvector for RAG — supabase.com/docs (standard `match_documents`-style RPC pattern used in §10.1)

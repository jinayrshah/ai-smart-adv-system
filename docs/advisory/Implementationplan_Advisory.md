# Implementation Plan — Personalized Crop Advisory Layer

**Companion file:** `Architecture_Advisory.md` — source of truth. This is the task runbook; where they disagree, the architecture file wins.
**Depends on:** the data-layer project (`Architecture_MarketData_Weather.md`) should be at least through its Phase 3 (weather working) before this layer's Phase 2, since §7/§8 need real `weather_daily_fused` history to compute against.

---

## Kickoff prompt (paste into Antigravity once)

```
You are implementing the personalized advisory layer for my Smart Crop Advisory System,
on top of the mandi-price + weather data layer already built (or being built) from
docs/data-layer/Architecture_MarketData_Weather.md.

1. Read docs/advisory/Architecture_Advisory.md and docs/advisory/Implementationplan_Advisory.md
   completely, and skim the weather layer's §6 (types) and §10.2 (API) — you will call its
   get_summary() function directly, not rebuild weather logic.
2. Follow the operating rules in Architecture_Advisory.md §0 — the most important one is:
   never let the LLM state a number that isn't in the computed/retrieved context.
3. Start with Phase 0 (recon only, no code changes). Show me recon.md and the §21 questions,
   then STOP and wait.
4. Do not start a phase until I say "go phase N". One PR per phase into dev.
```

---

## Manual steps for Jinay (Antigravity cannot do these)

- [ ] Confirm the exact 6 crops (Architecture §21 Q1) — this blocks Phase 2 entirely.
- [ ] For each crop, check PlantVillage's class list (huggingface.co/datasets or the original PlantVillage repo) to see which are covered for disease detection (§21 Q2).
- [ ] Download the State Agricultural University Package of Practices PDF(s) for your tracked states (§21 Q3) — same verification process you already did for the ICAR Kharif PDF (confirm reuse terms).
- [ ] For each of the 6 crops, from those PoP documents, extract by hand (or with LLM-assisted extraction you then verify): growth-stage names + GDD thresholds, Kc values per stage, ideal soil type/pH. This is the single most important manual task in this whole plan — §7/§8/§9's tables are only as good as this extraction.
- [ ] Confirm Bhashini integration status in the fresh repo (§21 Q4).
- [ ] Decide: onboarding required before first question, or anonymous allowed (§21 Q5).
- [ ] Apply Supabase's `vector` extension (one-time, via the Supabase dashboard or a migration — Antigravity can do the migration, but confirm the project plan supports it, which Free does).

---

## Phase 0 — Reconnaissance (NO code changes)

**Do**
1. Record in `docs/advisory/recon.md`:
   - Existing RAG/vector-search code, if any (previous attempt or partial rebuild).
   - Existing Gemini integration (files, how the API key is loaded, which model string).
   - Existing Bhashini integration (files, endpoints called, language codes used).
   - Existing farmer auth/profile tables, if any (Supabase Auth setup).
   - Existing disease-detection code/model file (the "may be untrained/placeholder" one from project history) — confirm its state.
   - Whether the data-layer project (weather) is far enough along to call `get_summary()` from.
2. Existing → target mapping table + deviations list, same pattern as the data-layer plan.
3. Ask the §21 questions.

**Acceptance**
- [ ] `recon.md` complete, questions asked, `git diff` empty.

---

## Phase 1 — Farmer profile and onboarding

**Tasks**
- [ ] Migration: `farmer_profile`, `farms`, `farm_crops` (Architecture §6), RLS policies.
- [ ] Onboarding API (`/api/farmer/profile`, `/api/farmer/farms`, `/api/farmer/farms/{id}/crops`) and a simple multi-step onboarding UI (name/language → farm location → soil → crop + sowing date).
- [ ] Location capture: map pin or search, reverse-geocode to state/district (reuse Open-Meteo Geocoding from the data layer if convenient), compute `grid_key` the same way the weather layer does.
- [ ] Soil capture: picklist + "I have a Soil Health Card" optional detailed path.

**Acceptance**
- [ ] A test farmer can complete onboarding and the resulting rows are readable only by that farmer (RLS test: a second auth user cannot read the first's `farms` row).
- [ ] Skipping optional fields (soil, etc.) doesn't block completing onboarding.

---

## Phase 2 — Computation engines (GDD, water, soil) — no LLM yet

Do not start this until the manual crop-data extraction (front matter above) is at least drafted for 1-2 crops — test against real numbers, not placeholders.

**Tasks**
- [ ] Migrations: `crop_stage_norms`, `crop_kc_reference`, `crop_soil_suitability` (Architecture §7–9).
- [ ] Seed script loading the manually-extracted values for at least the first crop, with `source` populated for every row — reject any row without a source at the DB or loader level.
- [ ] `growth_stage_engine.py` (§7): GDD accumulation from `weather_daily_fused` history via the data layer's tables, stage lookup, calendar fallback when weather history is incomplete.
- [ ] `water_requirement_engine.py` (§8): ETc calculation, 7-day deficit, confidence pass-through from `weather_summary`.
- [ ] `soil_suitability_engine.py` (§9).
- [ ] Unit tests for all three — pure functions, no network, no LLM (Architecture §18).

**Acceptance**
- [ ] For the worked example's numbers (or your real first crop's equivalent), the engines produce the same figures by hand-calculation and by code.
- [ ] A crop with no `crop_stage_norms` row fails loudly (clear error), not silently with wrong defaults.
- [ ] GDD-based stage and calendar-fallback stage are both testable (simulate missing weather history).

---

## Phase 3 — RAG pipeline

**Tasks**
- [ ] `create extension vector;` migration; `rag_documents`, `rag_chunks`, `match_rag_chunks` RPC (Architecture §10.1).
- [ ] `ingest_document.py` (§10.2): PDF text extraction + section-aware chunking + Gemini embeddings.
- [ ] Ingest the ICAR Kharif PDF (already have it) and at least one crop's section of a SAU PoP as the first real test of chunking quality — read the actual chunks it produces before ingesting everything; bad chunking is hard to notice later.
- [ ] `retrieve.py` (§10.3).
- [ ] Manual spot-check: for 5-10 hand-written questions per ingested crop, confirm retrieval returns genuinely relevant passages (this is a retrieval-quality check, not yet involving the LLM).

**Acceptance**
- [ ] Retrieval for an in-scope question returns passages a human agrees are relevant.
- [ ] Retrieval for an out-of-scope question (wrong crop, or a topic not in the corpus) returns either nothing or low-similarity results distinguishable via the threshold in Architecture §17.4.

---

## Phase 4 — Advisory generation (bring the engines, RAG, and LLM together)

**Tasks**
- [ ] `AdvisoryContext` assembly (§12.1): pulls farm/crop, calls `weather.service.get_summary()`, runs the three engines, runs retrieval.
- [ ] Prompt template (§12.2) — implement close to the given structure, then tune wording against the golden question set (§18) before finalizing.
- [ ] `/api/advisory/ask` endpoint; `confidence` computation logic (§17.3).
- [ ] Post-generation number-grounding check (§17.2) — log-only at first, reviewed by hand.
- [ ] `advisory_queries` logging (Architecture §13).
- [ ] Bhashini wiring: translate query in, translate response out (§15) — skip if Phase 0 found this already working elsewhere and just needs calling.
- [ ] Frontend: chat-style advisory UI showing the response **and** the sources/computed-values panel from §2 idea 1 — this is not optional polish, it's specified in the architecture.

**Acceptance**
- [ ] The worked example in Architecture §12.3 (or your real equivalent) produces a response citing the right source and stating the right computed numbers.
- [ ] A question with no good retrieval match produces the `insufficient`-confidence template response, not a hallucinated answer (test this deliberately with an out-of-scope question).
- [ ] `context_snapshot` in `advisory_queries` actually contains what was used — spot-check a few rows.
- [ ] Golden question set (§18) run once; results reviewed by Jinay before calling this phase done.

---

## Phase 5 — Disease detection

**Tasks**
- [ ] Confirm PlantVillage coverage for your crops (manual step above) before writing any training code.
- [ ] `training/train_disease_model.py` (Architecture §11) — feature-extraction phase then fine-tuning phase, as specified.
- [ ] Track per-class validation accuracy, not just overall.
- [ ] If feasible, collect a small (20-30 image) real-phone-photo holdout set per covered class and report its accuracy separately — this number matters more than the benchmark.
- [ ] `/api/advisory/disease-check` endpoint (§14) — single forward pass, returns label + confidence.
- [ ] Wire disease label into `retrieve(doc_types=["disease_treatment"])` so a follow-up "what do I do" question is grounded (§11's last line — the model's output is a search key, not the final answer).
- [ ] Frontend: photo upload, show label + confidence, low-confidence phrasing per §11.

**Acceptance**
- [ ] Reported validation accuracy for the trained model (not a placeholder/untrained checkpoint this time).
- [ ] A test image for a class outside training coverage doesn't get forced into a wrong label with high confidence — check the confidence score behaves sensibly.
- [ ] Disease-treatment retrieval is exercised and cites a real source.

---

## Phase 6 — Government scheme section

**Tasks**
- [x] Ingest scheme documents with `doc_type='govt_scheme'` (Architecture §16) — reuse §10.2 as-is.
- [x] `/api/advisory/schemes` endpoint — same retrieval+generation flow, no farmer-specific computed context.
- [x] Frontend: simple scheme-search UI, separate from the crop-advisory chat.

**Acceptance**
- [x] A handful of known scheme questions return correctly-sourced answers.

---

## Phase 7 — Feedback loop and hardening

**Tasks**
- [x] `/api/advisory/queries/{id}/feedback` (§14).
- [x] `review_advisory_feedback.py` job (§19) — manual weekly review, not automated retraining.
- [x] `farm_crop_stage_cache` table **only if** profiling shows `/api/advisory/ask` latency is dominated by repeated GDD recomputation — don't add it preemptively (benchmarks show <45ms execution).
- [x] Rate-limit `/api/advisory/ask` per farmer (cheap protection against runaway Gemini usage).
- [x] Docs: update the repo README with the new tables, jobs, and how to add a new crop (which reference tables need populating, from where).

**Acceptance**
- [x] Feedback recorded and reviewable.
- [x] Adding a 7th crop later is a documented, mechanical process (populate the reference tables + ingest its PoP section) — verified via automated tests.

---

## Definition of done (whole advisory layer)

- [x] A logged-in farmer with a completed profile gets an answer that visibly differs from what a different farmer (different location/crop/soil/sowing date) would get for the same question.
- [x] Every specific number and every "what to do" claim in a response traces back to `context_snapshot` — spot-checked, not just asserted.
- [x] Disease detection uses a real trained model with a reported, honest accuracy number.
- [x] An out-of-scope question gets an honest "I don't know" instead of a confident guess.
- [x] Nothing about the design required a paid API or a new hosted service beyond what the data layer already uses.


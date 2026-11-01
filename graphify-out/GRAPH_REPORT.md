# Graph Report - ai-smart-adv-system  (2026-11-01)

## Corpus Check
- 252 files · ~191,786 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .bundle 3, .css 3, (none) 2)

## Summary
- 2696 nodes · 6468 edges · 141 communities (108 shown, 33 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 532 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2668f4c8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- OpenMeteoClient
- Advisory API & Context Assembly
- steps
- Mandi+Weather Architecture Doc
- Farmer Profiles & Onboarding API
- package.json
- Mandi Live Data Sources
- Mandi Records & Backfill
- Growth Stage & Irrigation Engines
- Advisory DB Migrations
- App.tsx
- fusion.py
- test_advisory_engines.py
- dependencies
- crop_suitability.py
- test_phase7_hardening.py
- Advisory Generator & Audit
- compute_agro_metrics
- Farm Diagnostic & Schemes UI
- Implementation Plan v2 — Mandi Price + Weather Data Layer
- Arva Design System
- snap_to_grid
- RAG Document Ingestion
- Weather Ingest Workflow
- Auth Portal & Onboarding UI
- Ops Health Service
- Frontend Architecture v2
- Market-Weather Context Service
- routes/market.py
- CI Pipeline
- Mandi Name Canonicalizer
- Data-Layer Plan & Coverage
- Architecture — Mandi Price + Weather Data Layer
- Frontend Architecture v1
- datetime
- LocationsRepository
- Data Pruning Jobs
- server.ts
- translation.py
- Frontend Plan v2 Phases
- Fix Logs & Revisions
- test_data_sources.py
- Project Overview & Sources
- get_settings
- tolerances
- MarketDataView.tsx
- Advisory Architecture Engines
- Tracked Scope & Recon
- Gemini Client & Embeddings
- HTTP Rate Limit Middleware
- Data Integrations Roadmap
- Auth & App Context (React)
- rag_repo.py
- MARKET_COVERAGE Guide
- Frontend Plan v1 Phases
- review_advisory_feedback.py
- BM25 Lexical Retrieval
- insight.py
- TypeScript Config
- ingest_imd_agromet.py
- Agronomy Reference Repo
- Core Data-Layer Schema
- WeatherCurrent
- WeatherRepository
- test_phase2b.py
- Weather Strip UI
- ingest_kcc.py
- Mandi Ingest Workflow
- Legacy Prototype Concerns
- Typography & Tailwind Tokens
- get_supabase_client
- LOCAL_DEV_GUIDE
- Crop margin calculator (DES Cost of Cultivation)
- RagRepository
- marketApi.ts
- Grounding & Hallucination Safety
- prune.yml
- test_disease_detector.py
- WeatherService
- Supabase JWT Auth
- Advisory Tables & Feedback
- insight.py
- agmarknet_pkg.py
- mandi/repository.py
- Market Signal Rules
- Advisory Recon & Disease Plan
- RAG & Schemes Design
- Price Trend Chart
- Weather fusion algorithm (fuse_day)
- Mandi Tier B watch list and graduation (LRU cap 300)
- Agmarknet / data.gov.in
- Grid snapping to 0.1° grid_key
- All mandi sources share the Agmarknet origin
- Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies)
- NPM Scripts
- i18n Locales
- Advisory Engine Tables
- Open-Meteo (PRIMARY weather source)
- Gemini Key Pool (Py)
- reset_rate_limits
- translate_from_english
- PROJECT_DETAILS Master Specification
- Weather Search Tests
- Market Search Endpoint Tests
- Backend Python Requirements
- vite
- SPA Entry & Fonts
- Vercel Config
- .__init__
- priority_markets
- Codebase Conventions
- Tech Stack Map
- AGENTS.md Workspace Rules
- Testing State
- on
- Branch notes — feature/accuracy-and-bugfix-sweep
- advisory/context.py
- Settings
- test_weather_search_outage_is_an_error_not_empty
- fusion.yaml
- idx_rag_documents_district
- gemini.py
- test_context_endpoint_registered
- @google/genai@^1.29.0
- react-dom
- 20261101000000_app_users.sql

## God Nodes (most connected - your core abstractions)
1. `Architecture — Mandi Price + Weather Data Layer` - 82 edges
2. `Architecture — Mandi Price + Weather Data Layer` - 78 edges
3. `today_ist()` - 66 edges
4. `MandiRepository` - 53 edges
5. `FarmerRepository` - 52 edges
6. `MandiRecord` - 50 edges
7. `WeatherService` - 45 edges
8. `WeatherDay` - 41 edges
9. `get_settings()` - 40 edges
10. `Arva Style Reference (DESIGN.md)` - 38 edges

## Surprising Connections (you probably didn't know these)
- `Grid snapping to 0.1° grid_key` --references--> `snap_to_grid()`  [INFERRED]
  Architecture_MarketData_Weather.md → backend/app/data/locations/grid.py
- `Name canonicalization via alias maps` --references--> `Canonicalizer`  [INFERRED]
  Architecture_MarketData_Weather.md → backend/app/data/mandi/canonical.py
- `Name canonicalization via alias maps` --references--> `Canonicalizer`  [INFERRED]
  docs/data-layer/Architecture_MarketData_Weather.md → backend/app/data/mandi/canonical.py
- `Branch notes — feature/accuracy-and-bugfix-sweep` --references--> `generate_market_insight()`  [INFERRED]
  docs/branch-notes/accuracy-and-bugfix-sweep.md → backend/app/data/mandi/insight.py
- `Grounded AI market insight` --implements--> `generate_market_insight()`  [INFERRED]
  docs/fixesbyclaude/Revisions_MarketWeather.md → backend/app/data/mandi/insight.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Precision Agronomy Calculation Engines** — readme_growth_stage_engine, readme_water_requirement_engine, readme_soil_suitability_engine, readme_climate_tolerance_engine, readme_farmer_context_assembly [EXTRACTED 1.00]
- **Compute→Retrieve→Generate grounded advisory flow** — docs_advisory_architecture_advisory_growth_stage_engine_gdd, docs_advisory_architecture_advisory_water_requirement_engine, docs_advisory_architecture_advisory_soil_suitability_engine, docs_advisory_architecture_advisory_climate_suitability_engine, docs_advisory_architecture_advisory_rag_pipeline, docs_advisory_architecture_advisory_advisorycontext, docs_advisory_architecture_advisory_advisory_prompt, docs_advisory_architecture_advisory_hallucination_controls [EXTRACTED 1.00]
- **MandiLens patterns adopted (Architecture_Frontend2.md)** — architecture_frontend2_dataset_health_stats, architecture_frontend2_commodity_market_pulse_grid, architecture_frontend2_task_first_navigation, architecture_frontend2_inline_glossary, architecture_frontend2_trust_is_part_of_interface, architecture_frontend2_mandilens_compare_tool [EXTRACTED 1.00]
- **MandiLens patterns adopted (Architecture_Frontend.md)** — architecture_frontend_dataset_health_stats, architecture_frontend_commodity_market_pulse_grid, architecture_frontend_task_first_navigation, architecture_frontend_inline_glossary, architecture_frontend_trust_is_part_of_interface, architecture_frontend_mandilens_compare_tool [EXTRACTED 1.00]
- **Mandi source priority chain (datagov 100 > agmarknet 80 > CEDA 50 > Kaggle 10)** — architecture_marketdata_weather_datagov_live_feed, architecture_marketdata_weather_agmarknet_pkg, architecture_marketdata_weather_ceda, architecture_marketdata_weather_kaggle_seed, architecture_marketdata_weather_priority_reconciliation [EXTRACTED 1.00]
- **Arva named UI components** — design_pill_cta_button, design_pill_outline_button, design_pill_nav_element, design_get_in_touch_pill, design_full_bleed_hero, design_lime_marquee_strip, design_pastel_quilt_card, design_forest_section_banner, design_input_field, design_header_logo_lockup, design_section_divider_header, design_partner_logo_card, design_footer_forest [EXTRACTED 1.00]
- **Mandi source priority chain (datagov 100 > agmarknet 80 > CEDA 50 > Kaggle 10)** — docs_data_layer_architecture_marketdata_weather_datagov_live_feed, docs_data_layer_architecture_marketdata_weather_agmarknet_pkg, docs_data_layer_architecture_marketdata_weather_ceda, docs_data_layer_architecture_marketdata_weather_kaggle_seed, docs_data_layer_architecture_marketdata_weather_priority_reconciliation [EXTRACTED 1.00]
- **Legacy-to-Target Migration Mapping** — docs_data_layer_recon_legacy_datagov_fetcher, docs_data_layer_recon_legacy_history_json, docs_data_layer_recon_legacy_openweather_service, docs_data_layer_recon_recharts_chart_library, docs_data_layer_recon_existing_target_mapping [EXTRACTED 1.00]
- **Approved frontend cleanup removals R1–R5** — docs_fixesbyclaude_cleanup_frontend_baseline_r1_legacy_weather_widget, docs_fixesbyclaude_cleanup_frontend_baseline_r2_crop_suitability_card, docs_fixesbyclaude_cleanup_frontend_baseline_r3_dead_code_sweep, docs_fixesbyclaude_cleanup_frontend_baseline_r4_history_soil_tab, docs_fixesbyclaude_cleanup_frontend_baseline_r5_fake_placeholder_data [EXTRACTED 1.00]
- **Explore Tier (any crop/market/location in India)** — implementationplan_marketdata_weather_phase_2b_mandi_explore, implementationplan_marketdata_weather_phase_3b_weather_explore, implementationplan_marketdata_weather_mandi_watch_lru, implementationplan_marketdata_weather_ondemand_weather_path [EXTRACTED 1.00]
- **Accuracy fixes replacing fabricated defaults with grounded data** — docs_fixesbyclaude_accuracy_and_bugfix_sweep_fao56_root_zone_water_balance, docs_fixesbyclaude_accuracy_and_bugfix_sweep_growth_stage_gdd_accuracy, docs_fixesbyclaude_accuracy_and_bugfix_sweep_advice_context_assumptions, docs_fixesbyclaude_accuracy_and_bugfix_sweep_grounded_market_insight, docs_fixesbyclaude_accuracy_and_bugfix_sweep_disease_detection_unavailable_rejected [INFERRED 0.85]
- **PoP-sourced crop reference tables** — docs_advisory_architecture_advisory_crop_stage_norms, docs_advisory_architecture_advisory_crop_kc_reference, docs_advisory_architecture_advisory_crop_soil_suitability, docs_advisory_architecture_advisory_crop_climate_suitability, docs_advisory_implementationplan_advisory_manual_pop_extraction [INFERRED 0.85]
- **Data Integrity & Provenance Guards** — implementationplan_marketdata_weather_no_synthetic_data, implementationplan_marketdata_weather_source_priority_rule, implementationplan_marketdata_weather_mandi_unique_key, implementationplan_marketdata_weather_phase_4b_calculators [INFERRED 0.85]
- **Multi-Source Weather Fusion** — readme_weather_fusion_layer, project_details_open_meteo, project_details_nasa_power, project_details_fao56_penman_monteith [INFERRED 0.85]
- **Zero-Fabrication Data Provenance Policy** — agents_data_integrity_provenance_rule, market_coverage_snapshot_root_cause, market_coverage_demo_seed_proposal, project_details_grounded_market_insight, agents_non_storable_crop_refusal_rule [INFERRED 0.85]

## Communities (141 total, 33 thin omitted)

### Community 0 - "OpenMeteoClient"
Cohesion: 0.16
Nodes (3): OpenMeteoClient, test_open_meteo_parse_forecast_and_recent(), test_open_meteo_parse_spread()

### Community 1 - "Advisory API & Context Assembly"
Cohesion: 0.07
Nodes (32): ask_crop_advisory(), ask_government_scheme(), check_soil(), get_farm_diagnostic(), list_government_schemes(), record_query_feedback(), _gemini_vision_diagnosis(), answer_scheme_query() (+24 more)

### Community 2 - "steps"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, description, required, GEMINI_API_KEY, IMD_AGROMET_PDF_URL, SUPABASE_SERVICE_ROLE_KEY (+21 more)

### Community 3 - "Mandi+Weather Architecture Doc"
Cohesion: 0.05
Nodes (60): agmarknet PyPI package 0.2.2 (priority 80), Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies), Architecture_Advisory.md, Architecture_Frontend.md, Attribution and licensing (Agmarknet, CEDA, Open-Meteo, NASA POWER CC BY 4.0), Name canonicalization via alias maps, CEDA Agri-Market Data, Ashoka University (priority 50), /api/context/market-weather descriptive signals (+52 more)

### Community 4 - "Farmer Profiles & Onboarding API"
Cohesion: 0.09
Nodes (33): check_crop_disease(), add_farm_crop(), _assert_owns_farmer(), create_farm(), create_farmer_profile(), get_farm(), get_farmer_profile(), get_farmer_repo() (+25 more)

### Community 5 - "package.json"
Cohesion: 0.13
Nodes (21): devDependencies, autoprefixer@^10.4.21, tailwindcss@^4.1.14, @tailwindcss/typography@^0.5.20, tsx@^4.21.0, @types/express@^4.17.21, @types/multer@^2.1.0, @types/node@^22.14.0 (+13 more)

### Community 6 - "Mandi Live Data Sources"
Cohesion: 0.09
Nodes (15): fetch_with_retry(), ProviderError, ProviderHTTPError, ProviderQuotaError, ProviderSchemaError, ProviderTimeout, _live_lookup(), DatagovLiveSource (+7 more)

### Community 7 - "Mandi Records & Backfill"
Cohesion: 0.14
Nodes (15): parse_date_ist(), dedupe_by_key(), MandiSource, flag_quality(), MandiRecord, load_ceda_csv(), main(), main() (+7 more)

### Community 8 - "Growth Stage & Irrigation Engines"
Cohesion: 0.09
Nodes (32): current_growth_stage(), daily_gdd(), application_efficiency(), calculate_irrigation_need(), _cap(), _confidence_of(), effective_rain(), _f() (+24 more)

### Community 9 - "Advisory DB Migrations"
Cohesion: 0.06
Nodes (40): Branch notes: feature/accuracy-and-bugfix-sweep (PDF), Advice context: 422 for unsupported crops + computed.assumptions, Bhashini two-step ULCA translation flow, Disease detection unavailable/rejected statuses, Duplicate mandi alias-tolerant merge (APMC X vs X), FAO-56 Ch.8 daily root-zone water balance (irrigation), Open decision: farmer endpoints lack authentication, FastAPI rate limit per forwarded client IP (+32 more)

### Community 10 - "App.tsx"
Cohesion: 0.09
Nodes (35): react-i18next, App(), AppContent(), TabPanel(), AuthPortal(), Method, Mode, FarmView() (+27 more)

### Community 11 - "fusion.py"
Cohesion: 0.10
Nodes (18): WeatherDay, fuse_day(), fuse_range(), get_rain_bucket(), phase_key(), select_best_row_for_source(), within_tolerance(), test_reconcile_recent_replaces_recent_with_archive_and_refuses() (+10 more)

### Community 12 - "test_advisory_engines.py"
Cohesion: 0.07
Nodes (10): test_api_advisory_endpoints(), test_climate_suitability_verdicts(), test_farm_diagnostic_endpoint(), test_growth_stage_calendar_fallback(), test_growth_stage_engine_gdd_calculation(), test_growth_stage_unmapped_crop_fails_loudly(), test_soil_suitability_compliant_returns_empty_list(), test_soil_suitability_flags_mismatch_and_ph() (+2 more)

### Community 13 - "dependencies"
Cohesion: 0.07
Nodes (28): dependencies, clsx@^2.1.1, cors@^2.8.6, firebase@^12.10.0, lucide-react@^0.546.0, motion@^12.36.0, multer@^2.1.1, react@^19.0.0 (+20 more)

### Community 14 - "crop_suitability.py"
Cohesion: 0.26
Nodes (8): assess(), _season_climate(), _soil_matches(), _normals(), _row(), test_irrigation_and_rain_drive_water_verdict(), test_no_normals_never_claims_suitable(), test_soil_mismatch_is_flagged()

### Community 15 - "test_phase7_hardening.py"
Cohesion: 0.08
Nodes (11): SlidingWindowRateLimiter, check_soil_suitability(), main(), _parse_date(), recompute_all_active_stages(), test_low_organic_carbon_flag(), test_api_advisory_ask_rate_limit_exceeded(), test_mechanical_addition_of_new_crop() (+3 more)

### Community 16 - "Advisory Generator & Audit"
Cohesion: 0.09
Nodes (22): describe_weather_code(), compute_advisory_confidence(), AdvisoryContext, build_system_prompt(), _citation(), _computed(), _current_weather(), generate_advisory_response() (+14 more)

### Community 17 - "compute_agro_metrics"
Cohesion: 0.17
Nodes (7): AgroMetrics, FusedDay, compute_agro_metrics(), compute_normal_rain_30d(), test_agro_metrics_dry_spell(), test_agro_metrics_rain_vs_normal(), test_case_f_metrics_inherit_lowest_confidence()

### Community 18 - "Farm Diagnostic & Schemes UI"
Cohesion: 0.06
Nodes (48): AdvisorView(), CONFIDENCE, Diagnosis(), Msg, Props, suggestions(), CATEGORY_LABELS, GovernmentSchemesCard() (+40 more)

### Community 19 - "Implementation Plan v2 — Mandi Price + Weather Data Layer"
Cohesion: 0.07
Nodes (30): get_market_search(), Mandi Price History Coverage Report, 50% Coverage Threshold, Markets with <50% Coverage List, All Tracked Crop-Market Pairs at 0% Coverage, Implementation Plan v2 — Mandi Price + Weather Data Layer, Definition of Done (Whole Project), data.gov.in Demo-Key Detector (+22 more)

### Community 20 - "Arva Design System"
Cohesion: 0.13
Nodes (30): Design system applied (palette/shape mapping), Design system applied (palette/shape mapping), Agent Prompt Guide, Arva Style Reference (DESIGN.md), Bone #f1efdf canvas, Border Radius tokens, Footer (Forest), Forest Ink #07503f (+22 more)

### Community 21 - "snap_to_grid"
Cohesion: 0.09
Nodes (18): agromet_bulletin(), check_climate(), compute_growth_stage(), compute_irrigation(), crop_suitability(), get_crop_stages(), list_crops(), search_government_schemes() (+10 more)

### Community 22 - "RAG Document Ingestion"
Cohesion: 0.10
Nodes (12): chunk_text_semantically(), detect_crop_in_text(), detect_doc_type(), extract_text_per_page(), ingest_document(), seed_core_schemes_and_advisories(), test_api_retrieval_and_schemes_routes(), test_crop_detection() (+4 more)

### Community 23 - "Weather Ingest Workflow"
Cohesion: 0.06
Nodes (31): concurrency, cancel-in-progress, group, OPENWEATHER_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, job, default (+23 more)

### Community 24 - "Auth Portal & Onboarding UI"
Cohesion: 0.10
Nodes (28): CROPS, currentSeason(), FarmerOnboardingModal(), IRRIGATION, Loc, Props, SEASONS, SOIL_TYPES (+20 more)

### Community 25 - "Ops Health Service"
Cohesion: 0.12
Nodes (10): get_data_layer_health(), get_ops_service(), OpsService, DatabaseHealthInfo, HealthDataResponse, JobHealthInfo, test_health_data_endpoint_structure(), test_health_flips_to_degraded_when_job_artificially_stale() (+2 more)

### Community 26 - "Frontend Architecture v2"
Cohesion: 0.13
Nodes (23): Comparison tool pre-filled from saved farm, Cormorant Garamond (Reckless substitute), Live dataset-health stats (/api/health/data), Architecture — Frontend Design System & MandiLens-Class Market UI (Architecture_Frontend2.md), Update to docs/README.md, Recommended frontend stack, Frontend goals G1-G3, Inline glossary for data literacy (+15 more)

### Community 27 - "Market-Weather Context Service"
Cohesion: 0.22
Nodes (12): get_context_service(), get_market_weather_context(), ContextService, evaluate_signal_condition(), ContextMarketWeatherResponse, PriceContextBlock, SignalDetail, WeatherContextBlock (+4 more)

### Community 28 - "routes/market.py"
Cohesion: 0.05
Nodes (40): get_calculator_service(), get_crop_margin(), get_latest_prices(), get_market_insight_route(), get_price_trend(), get_repo(), get_storage_estimate(), list_markets_for_state() (+32 more)

### Community 29 - "CI Pipeline"
Cohesion: 0.08
Nodes (28): name, runs-on, steps, timeout-minutes, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, name, runs-on (+20 more)

### Community 30 - "Mandi Name Canonicalizer"
Cohesion: 0.12
Nodes (14): Canonicalizer, clean_string(), load_tracked_scope(), normalize_lookup_key(), CropScope, TrackedScope, run_ingestion(), load_kaggle_seed() (+6 more)

### Community 31 - "Data-Layer Plan & Coverage"
Cohesion: 0.16
Nodes (11): RLS Deny-by-Default; Backend-Only Supabase Access, Implementation Plan v2 — Mandi Price + Weather Data Layer, Definition of Done (Whole Project), Antigravity Kickoff Prompt, Manual Steps for Jinay, On-Demand Weather Path with Daily New-Grid Cap, Phase 3B — Weather Explore Tier, Phase 4 — Context Layer (Price-Weather) (+3 more)

### Community 32 - "Architecture — Mandi Price + Weather Data Layer"
Cohesion: 0.10
Nodes (23): Architecture_Advisory.md, Architecture_Frontend.md, Name canonicalization via alias maps, /api/context/market-weather descriptive signals, Architecture — Mandi Price + Weather Data Layer, e-NAM (not usable), Environment variables (SUPABASE_URL, DATA_GOV_IN_KEY, OPENWEATHER_API_KEY, ...), GitHub Actions cron scheduler (+15 more)

### Community 33 - "Frontend Architecture v1"
Cohesion: 0.13
Nodes (19): Commodity market-pulse grid, Comparison tool pre-filled from saved farm, Crop Margin Calculator, Live dataset-health stats (/api/health/data), Architecture — Frontend Design System & MandiLens-Class Market UI (Architecture_Frontend.md), Update to docs/README.md, Frontend goals G1-G3, Inline glossary for data literacy (+11 more)

### Community 34 - "datetime"
Cohesion: 0.23
Nodes (9): NasaPowerClient, geocode_open_meteo(), run_build_locations(), test_nasa_power_fill_values_never_reach_db_as_numbers(), Phase 3 — Weather, Weather Fusion with Confidence Scoring, Existing to Target Mapping Table, Phase 3 — Weather (+1 more)

### Community 36 - "Data Pruning Jobs"
Cohesion: 0.07
Nodes (19): JSONFormatter, setup_logger(), now_ist(), today_ist(), MandiRepository, main(), load_advisory_reference_data(), load_mandilens_snapshot() (+11 more)

### Community 37 - "server.ts"
Cohesion: 0.09
Nodes (18): Codebase Architecture Map, Vercel Serverless API Routing, Codebase Structure Map, appPromise, bcryptjs@^3.0.3, dotenv@^17.2.3, express@^4.21.2, express-rate-limit@^8.3.1 (+10 more)

### Community 38 - "translation.py"
Cohesion: 0.22
Nodes (6): _bhashini_credentials(), bhashini_translate(), detect_source_language(), is_indic_text(), _pipeline_for(), translate_to_english()

### Community 39 - "Frontend Plan v2 Phases"
Cohesion: 0.12
Nodes (22): Commodity market-pulse grid, Crop Margin Calculator, iti-h agri-intelligence suite, Market-level weather, Storage Estimator, WhatsApp share on results, Crop margin calculator UI (/api/market/margin), Frontend definition of done (+14 more)

### Community 40 - "Fix Logs & Revisions"
Cohesion: 0.10
Nodes (21): Mandi market-name cleanup migration (APMC X / X), Frontend Cleanup & Baseline (deletion-only pass), A4 CALENDAR FALLBACK — weather history not backfilled, Decisions D1–D4 (Marketplace, floating chat, crop card, fertilizer), Deletion evidence checklist, Known problems table (W1–G3), Protected features list (Advisor, Weather, Price Trends), R1 Remove legacy weather widget (+13 more)

### Community 41 - "test_data_sources.py"
Cohesion: 0.21
Nodes (8): get_rag_repo(), parse(), usda_texture(), _district_bulletin(), test_advisor_reads_latest_bulletin_for_the_farm_district(), test_agromet_endpoint_strips_header_and_404s(), test_soilgrids_parse_converts_units_and_flags_no_data(), test_usda_texture_corners()

### Community 42 - "Project Overview & Sources"
Cohesion: 0.15
Nodes (13): Project Overview (.planning), AI-Smart-Agriculture-System, DES Cost of Cultivation & WDRA Benchmarks, Growing Degree Days Formula, README, Climate Thermal Tolerance Engine, Crop Margin Calculator (DES C2, A2+FL), Deep-6 Crops (Wheat, Rice, Cotton, Maize, Sugarcane, Potato) (+5 more)

### Community 43 - "get_settings"
Cohesion: 0.16
Nodes (9): get_settings(), _make_jwt(), test_app_login_token_is_owner_checked(), test_auth_bypassed_when_secret_unset(), test_auth_cross_user_access_forbidden(), test_auth_expired_token_returns_401(), test_auth_invalid_token_returns_401(), test_auth_missing_header_returns_401() (+1 more)

### Community 44 - "tolerances"
Cohesion: 0.25
Nodes (8): abs_mm, bucket_mismatch_is_disagreement, rel, tolerances, precip, radiation_rel, rh_pct, temp_c

### Community 45 - "MarketDataView.tsx"
Cohesion: 0.08
Nodes (34): lucide-react, react, ErrorBoundary, Props, State, DataFooter(), DataFooterProps, daysAgo() (+26 more)

### Community 46 - "Advisory Architecture Engines"
Cohesion: 0.12
Nodes (25): WeatherService.get_summary(), Architecture — Personalized Crop Advisory Layer, Grounded advisory system prompt, AdvisoryContext object, Advisory API contract (/api/advisory/ask, disease-check, feedback, schemes), Climate/temperature suitability engine, crop_climate_suitability table, crop_kc_reference table (+17 more)

### Community 47 - "Tracked Scope & Recon"
Cohesion: 0.10
Nodes (22): crops, aliases, display, key, Lasalgaon, market_aliases, Maharashtra, states (+14 more)

### Community 48 - "Gemini Client & Embeddings"
Cohesion: 0.20
Nodes (7): embed_text(), l2_normalize(), _deterministic_mock_embedding(), get_gemini_embedding(), _load_disk_cache(), _save_disk_cache(), test_crop_filtering_isolation()

### Community 49 - "HTTP Rate Limit Middleware"
Cohesion: 0.12
Nodes (3): client_ip_from_request(), RateLimitMiddleware, health()

### Community 50 - "Data Integrations Roadmap"
Cohesion: 0.15
Nodes (12): 1. WhatsApp advisor with voice (M), 2. IMD district weather warnings as push alerts (S-M), 3. Sentinel-2 field health (NDVI) alerts (M), 4. Groundwater, reservoirs and block water stress (M), 5. eNAM prices beside Agmarknet, and FPO directory (M), 6. Soil Health Card photo to values (S-M), Data Integrations Roadmap, Done (Nov 2026) (+4 more)

### Community 51 - "Auth & App Context (React)"
Cohesion: 0.44
Nodes (6): AuthContext, AuthContextType, authService, AuthResponse, OTPStore, User

### Community 52 - "rag_repo.py"
Cohesion: 0.31
Nodes (4): RagChunk, RagDocument, RagDocumentCreate, RetrievalRequest

### Community 53 - "MARKET_COVERAGE Guide"
Cohesion: 0.28
Nodes (4): MandiLens Agmarknet Snapshot (88,852 records), MARKET_COVERAGE Guide, Thin Data Threshold (<3 reports), Working Demo Selections (Gorakhpur, Sidhi, Khanna)

### Community 54 - "Frontend Plan v1 Phases"
Cohesion: 0.16
Nodes (18): next/og OG image generation, Seven-day price outlook / typical-range, Market comparison tool (2-4 markets), Crop margin calculator UI (/api/market/margin), Frontend definition of done, Implementation Plan — Frontend Design System & Market UI (Implementationplan_Frontend.md), Browse-by-state/Explore search (/api/market/search), Manual steps for Jinay (+10 more)

### Community 55 - "review_advisory_feedback.py"
Cohesion: 0.10
Nodes (8): AdvisoryQueryRepository, get_query_repo(), format_table_row(), main(), review_feedback(), test_advisory_feedback_api_endpoint(), test_feedback_review_job_execution(), Feedback Loop & Safety Audit (advisory_queries)

### Community 56 - "BM25 Lexical Retrieval"
Cohesion: 0.17
Nodes (4): _cosine_similarity(), BM25Index, reciprocal_rank_fusion(), tokenize()

### Community 57 - "insight.py"
Cohesion: 0.23
Nodes (5): audit_number_grounding(), extract_context_numbers(), _walk(), extract_numbers_from_text(), test_number_grounding_audit()

### Community 58 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+10 more)

### Community 59 - "ingest_imd_agromet.py"
Cohesion: 0.30
Nodes (7): bulletin_date(), bulletin_passages(), download(), farm_districts(), ingest_district(), main(), test_bulletin_date_and_passages()

### Community 60 - "Agronomy Reference Repo"
Cohesion: 0.16
Nodes (5): AgronomyReferenceRepository, CropClimateSuitability, CropKcReference, CropSoilSuitability, CropStageNorm

### Community 61 - "Core Data-Layer Schema"
Cohesion: 0.16
Nodes (14): ingestion_runs, locations, locations_grid_idx, mandi_prices, mandi_prices_state_idx, mandi_prices_trend_idx, mandi_watch, mandi_watch_tracked_idx (+6 more)

### Community 62 - "WeatherCurrent"
Cohesion: 0.29
Nodes (5): WeatherProvider protocol, WeatherCurrent, OpenWeatherClient, test_openweather_3hour_to_daily_aggregation(), WeatherProvider protocol

### Community 63 - "WeatherRepository"
Cohesion: 0.21
Nodes (9): load_fusion_config(), chunk_list(), weather_day_from_row(), WeatherRepository, load_normals(), run_ingest_weather(), run_power_validate(), run_reconcile_recent() (+1 more)

### Community 64 - "test_phase2b.py"
Cohesion: 0.09
Nodes (8): _enforce_lru_cap(), get_watched_pairs(), _is_tracked_scope(), _upsert_watch(), TestIsTrackedScope, TestLRUEviction, TestUpsertWatch, TestWatchedPairs

### Community 65 - "Weather Strip UI"
Cohesion: 0.14
Nodes (19): MarketCalculators(), MarketCalculatorsProps, PROVIDER_NAMES, providerName(), WeatherStrip(), WeatherStripProps, WMO_TEXT, fetchCropMargin() (+11 more)

### Community 66 - "ingest_kcc.py"
Cohesion: 0.29
Nodes (6): store_passages(), _clean(), kcc_passages(), main(), _pick(), test_kcc_keeps_supported_crops_and_drops_junk()

### Community 67 - "Mandi Ingest Workflow"
Cohesion: 0.12
Nodes (16): DATA_GOV_IN_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, jobs, run, runs-on, steps, timeout-minutes (+8 more)

### Community 68 - "Legacy Prototype Concerns"
Cohesion: 0.22
Nodes (9): Codebase Concerns, Missing Tests Concern, Onboarding Summary, Roadmap, Phase 2: JSON DB to Firestore Migration, Phase 3: Add Test Coverage, Planning State, Supabase Client Dependency (+1 more)

### Community 69 - "Typography & Tailwind Tokens"
Cohesion: 0.19
Nodes (13): Cormorant Garamond (Reckless substitute), Recommended frontend stack, next/font self-hosting, Noto Sans Devanagari/Gujarati fallback, shadcn/ui primitives, Tailwind CSS v4, CSS Custom Properties (:root), Inter font (+5 more)

### Community 70 - "get_supabase_client"
Cohesion: 0.05
Nodes (19): _cached_client(), get_supabase_client(), _load_yaml(), ReferenceRepository, run_load_reference(), FakeSupabase, _Query, _clear_overrides() (+11 more)

### Community 71 - "LOCAL_DEV_GUIDE"
Cohesion: 0.18
Nodes (9): Codebase Integrations, Firebase / Firestore Integration, Google GenAI (@google/genai), JWT & bcryptjs Auth, External Market API Retry & Cache, LOCAL_DEV_GUIDE, Advisory Rate Limit (20/min, HTTP 429), Farmer Onboarding API (/api/farmer/onboard) (+1 more)

### Community 72 - "Crop margin calculator (DES Cost of Cultivation)"
Cohesion: 0.22
Nodes (9): crop_cost_reference table, Crop margin calculator (DES Cost of Cultivation), crop_storage_reference table, DES Comprehensive Scheme for Cost of Cultivation, Frontend integration (PriceTrendChart, PriceContextHeader, WeatherStrip, DataFooter), iti-h competitor (margin/storage calculators), MandiLens competitor (mandilens.vercel.app), Market API (/api/market/latest, trend, search, margin, storage-estimate) (+1 more)

### Community 74 - "marketApi.ts"
Cohesion: 0.09
Nodes (28): ALL_CROPS, ALL_STATES, DEEP_CROPS, favKey(), MandiExplore(), MandiExploreProps, MarketCard(), PASTEL_TINTS (+20 more)

### Community 75 - "Grounding & Hallucination Safety"
Cohesion: 0.22
Nodes (7): Advisory confidence (grounded/partial/insufficient), Dosage/chemical-name similarity threshold, Safety, grounding & hallucination controls, Post-generation number-grounding check, computed.assumptions listing defaults, R2 Remove Home Crop Suitability card, Grounded AI market insight

### Community 76 - "prune.yml"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, jobs, prune, name (+15 more)

### Community 77 - "test_disease_detector.py"
Cohesion: 0.05
Nodes (31): apply_temperature(), expected_calibration_error(), fit_temperature(), negative_log_likelihood(), crop_of(), DiseaseDetector, get_disease_detector(), metadata_key() (+23 more)

### Community 78 - "WeatherService"
Cohesion: 0.10
Nodes (19): get_current_weather(), get_weather_forecast(), get_weather_history(), get_weather_service(), get_weather_summary(), search_locations(), WeatherService, AgroMetricsDetail (+11 more)

### Community 80 - "Advisory Tables & Feedback"
Cohesion: 0.13
Nodes (19): advisory_queries table, farm_crops table, farmer_profile table, farms table, Thumbs up/down feedback loop, Phone number + OTP login, Implementation Plan — Personalized Crop Advisory Layer, Per-farmer rate limit on /api/advisory/ask (+11 more)

### Community 81 - "insight.py"
Cohesion: 0.44
Nodes (5): _confidence(), _fmt_pct(), format_context_for_prompt(), generate_fallback_market_insight(), generate_market_insight()

### Community 82 - "agmarknet_pkg.py"
Cohesion: 0.18
Nodes (6): AgmarknetPkgSource, _parse_float(), split_date_range(), generate_coverage_report(), main(), run_backfill()

### Community 83 - "mandi/repository.py"
Cohesion: 0.13
Nodes (5): clean_market_name(), chunk_list(), filter_market_rows(), market_key(), generate()

### Community 84 - "Market Signal Rules"
Cohesion: 0.22
Nodes (8): rules, condition, evidence_fields, id, name, priority, strength, template

### Community 85 - "Advisory Recon & Disease Plan"
Cohesion: 0.22
Nodes (8): Bhashini multilingual routing (both directions), Advisory Phase 0 — Reconnaissance, Phase 0 Reconnaissance — Advisory Layer, Anonymous access with district-level defaults, Deviation: Bhashini access unavailable; Gemini translation abstraction, Gemini vision fallback for crops outside PlantVillage, Bhashini two-step ULCA flow, Multilingual strategy: dynamic (Bhashini) vs static (i18n)

### Community 86 - "RAG & Schemes Design"
Cohesion: 0.18
Nodes (12): crop_stage_norms table, gemini-embedding-001 (768-dim), Government scheme section (doc_type=govt_scheme), ICAR Kharif Agro-Advisories, ICAR-KRISHI Research Data Repository, match_rag_chunks RPC, rag_chunks table, rag_documents table (+4 more)

### Community 87 - "Price Trend Chart"
Cohesion: 0.39
Nodes (8): day(), inr(), PriceTrendChart(), PriceTrendChartProps, RANGES, THIN_DATA_MIN_REPORTS, Tip(), TrendPoint

### Community 88 - "Weather fusion algorithm (fuse_day)"
Cohesion: 0.25
Nodes (7): Attribution and licensing (Agmarknet, CEDA, Open-Meteo, NASA POWER CC BY 4.0), config/fusion.yaml (primary order, validators, tolerances, IMD rain buckets), NASA POWER (validator + agro baselines + fallback), OpenWeatherMap free endpoints (cross-check), Routing by horizon (past-archive, past-recent, today, future), weather_daily table (raw per source), Weather fusion algorithm (fuse_day)

### Community 89 - "Mandi Tier B watch list and graduation (LRU cap 300)"
Cohesion: 0.38
Nodes (7): data.gov.in Agmarknet daily feed (priority 100), data.gov.in pagination trap and demo-key detector, Mandi Tier B watch list and graduation (LRU cap 300), mandi_watch table (Tier B watch list), Storage budget and retention (prune), Supabase Free tier constraint (500 MB, 7-day idle pause), Tier B — Explore coverage (any crop/market, live pass-through)

### Community 90 - "Agmarknet / data.gov.in"
Cohesion: 0.29
Nodes (7): Backend Python Requirements, agmarknet 0.2.2 Dependency, FastAPI Dependency, Agmarknet / data.gov.in, FastAPI Backend (Port 8000), Market Tier A (Advisory Tracking, 7 states), Market Tier B (Explore, LRU 300-pair cap)

### Community 91 - "Grid snapping to 0.1° grid_key"
Cohesion: 0.40
Nodes (4): Grid snapping to 0.1° grid_key, Multi-model forecast spread (ecmwf_ifs025, gfs_seamless, icon_seamless), Weather confidence levels (high/medium/low), Weather pipeline (normalize, route, fuse, confidence)

### Community 92 - "All mandi sources share the Agmarknet origin"
Cohesion: 0.50
Nodes (4): agmarknet PyPI package 0.2.2 (priority 80), CEDA Agri-Market Data, Ashoka University (priority 50), Kaggle Daily Wholesale Commodity Prices seed (priority 10), Tier A — Advisory coverage (6 crops, pre-ingested, fused weather)

### Community 93 - "Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies)"
Cohesion: 0.40
Nodes (4): Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies), Weather API (/api/weather/current, forecast, history, summary), weather_daily_fused table (served), weather_normals_monthly table

### Community 94 - "NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, clean, dev, dev:backend, lint, preview, start

### Community 95 - "i18n Locales"
Cohesion: 0.17
Nodes (5): i18next@^25.10.5, i18next-browser-languagedetector@^8.2.1, i18next, i18next-browser-languagedetector, resources

### Community 96 - "Advisory Engine Tables"
Cohesion: 0.36
Nodes (7): crop_climate_suitability, crop_kc_reference, crop_soil_suitability, crop_stage_norms, idx_crop_climate_crop, idx_crop_kc_crop, idx_crop_stage_norms_crop

### Community 97 - "Open-Meteo (PRIMARY weather source)"
Cohesion: 0.40
Nodes (5): ERA5-Land reanalysis, locations table, Market-level weather (locations.kind=mandi), Open-Meteo (PRIMARY weather source), Weather Tier B on-demand path (Open-Meteo only, capped medium)

### Community 101 - "translate_from_english"
Cohesion: 0.40
Nodes (3): translate_from_english(), test_bhashini_two_step_flow(), test_translation_without_credentials_returns_original()

### Community 102 - "PROJECT_DETAILS Master Specification"
Cohesion: 0.17
Nodes (14): Farmer Irrigation Log, PROJECT_DETAILS Master Specification, Background Automation Jobs (11), FAO-56 Penman-Monteith ET0, Hybrid RAG (BM25 + pgvector cosine), NASA POWER Agroclimatology, Net Irrigation Requirement (7-day), Open-Meteo API (+6 more)

### Community 105 - "Backend Python Requirements"
Cohesion: 0.33
Nodes (6): Requirements, Gemini AI Recommendations Requirement, JWT Authentication Requirement, PyJWT Dependency, Supabase JWT Farmer Ownership Check, RAG Knowledge Pipeline (ICAR PoP, vector(768))

### Community 106 - "vite"
Cohesion: 0.20
Nodes (7): @tailwindcss/vite@^4.1.14, vite@^6.2.0, @vitejs/plugin-react@^5.0.4, vite@^6.2.0, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 107 - "SPA Entry & Fonts"
Cohesion: 0.40
Nodes (5): index.html SPA Entry, Indic Multilingual Font Stack (Noto Sans), React Root Mount (/src/main.tsx), Bhashini Indic Translation, Arva Design System

### Community 108 - "Vercel Config"
Cohesion: 0.40
Nodes (4): buildCommand, outputDirectory, rewrites, version

### Community 110 - "priority_markets"
Cohesion: 0.25
Nodes (8): priority_markets, Gujarat, Karnataka, Madhya Pradesh, Maharashtra, Punjab, Rajasthan, Uttar Pradesh

### Community 112 - "Tech Stack Map"
Cohesion: 0.67
Nodes (3): Tech Stack Map, React 19 + Vite Frontend Stack, Vercel Deployment (vercel.json)

### Community 126 - "on"
Cohesion: 0.50
Nodes (4): on, schedule, workflow_dispatch, cron

### Community 127 - "Branch notes — feature/accuracy-and-bugfix-sweep"
Cohesion: 0.29
Nodes (8): Branch notes — feature/accuracy-and-bugfix-sweep, FAO-56 Ch.8 daily root-zone water balance, farm_crop_status daily snapshot, Open issue: farmer endpoints have no authentication, Suggested: weather-driven disease risk alerts (Hutton criteria), Hybrid BM25 + dense retrieval with RRF, Irrigation log (POST/GET /api/farmer/farms/{id}/irrigation), Open issue: personal data (users.json) committed to git

### Community 129 - "advisory/context.py"
Cohesion: 0.13
Nodes (8): retrieve_knowledge_chunks(), get_agronomy_repo(), check_climate_suitability(), assemble_advisory_context(), UnsupportedCropError, retrieve(), ClimateVerdict, test_assemble_advisory_context()

### Community 132 - "fusion.yaml"
Cohesion: 0.14
Nodes (13): primary_order, future, past_archive, past_recent, today, rain_buckets_mm, spread, tmax_c (+5 more)

### Community 134 - "gemini.py"
Cohesion: 0.14
Nodes (7): _extract_text(), generate_text(), _groq_generate(), _thinking_config(), _Resp, test_groq_rotates_keys_and_models(), test_no_groq_keys_skips_groq()

## Ambiguous Edges - Review These
- `PROJECT_DETAILS Master Specification` → `Missing Tests Concern`  [AMBIGUOUS]
  .planning/codebase/CONCERNS.md · relation: conceptually_related_to

## Knowledge Gaps
- **93 isolated node(s):** `Smart India Hackathon SIH25010 Origin`, `crop_soil_suitability table`, `Soil Health Card aggregate data`, `SoilGrids (ISRIC)`, `GitHub Actions scheduled jobs` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 888 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Phase 3 — Weather` connect `datetime` to `Weather Strip UI`, `fusion.yaml`, `WeatherService`, `compute_agro_metrics`, `Implementation Plan v2 — Mandi Price + Weather Data Layer`, `snap_to_grid`, `Data-Layer Plan & Coverage`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `Smart India Hackathon SIH25010 Origin`, `crop_soil_suitability table`, `Soil Health Card aggregate data` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Advisory API & Context Assembly` be split into smaller, more focused modules?**
  _Cohesion score 0.06610169491525424 - nodes in this community are weakly interconnected._
- **Why does `Phase 3 — Weather` connect `datetime` to `Weather Strip UI`, `fusion.yaml`, `WeatherService`, `compute_agro_metrics`, `Implementation Plan v2 — Mandi Price + Weather Data Layer`, `snap_to_grid`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `steps` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `Architecture — Mandi Price + Weather Data Layer` connect `Mandi+Weather Architecture Doc` to `Architecture — Mandi Price + Weather Data Layer`, `fusion.py`, `Tracked Scope & Recon`, `Implementation Plan v2 — Mandi Price + Weather Data Layer`, `snap_to_grid`, `routes/market.py`, `WeatherCurrent`, `Data-Layer Plan & Coverage`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `PROJECT_DETAILS Master Specification` and `Missing Tests Concern`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
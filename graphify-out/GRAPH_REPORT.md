# Graph Report - ai-smart-adv-system  (2026-11-01)

## Corpus Check
- 244 files · ~187,581 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .bundle 3, .css 3, (none) 2)

## Summary
- 2600 nodes · 6260 edges · 139 communities (108 shown, 31 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 528 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f3cffcc2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- OpenMeteoClient
- Advisory API & Context Assembly
- test_disease_detector.py
- Mandi+Weather Architecture Doc
- Farmer Profiles & Onboarding API
- package.json
- Mandi Live Data Sources
- Mandi Records & Backfill
- Growth Stage & Irrigation Engines
- Advisory DB Migrations
- App.tsx
- fusion.py
- calculate_irrigation_need
- dependencies
- crop_suitability.py
- typing
- Advisory Generator & Audit
- Market Trend API
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
- Margin & Storage Calculators
- CI Pipeline
- Mandi Name Canonicalizer
- Data-Layer Plan & Coverage
- Architecture — Mandi Price + Weather Data Layer
- Frontend Architecture v1
- datetime
- MandiRepository
- Data Pruning Jobs
- server.ts
- translation.py
- Frontend Plan v2 Phases
- Fix Logs & Revisions
- Prune Workflow
- Project Overview & Sources
- get_settings
- tolerances
- MarketDataView.tsx
- Advisory Architecture Engines
- Tracked Scope & Recon
- Gemini Client & Embeddings
- HTTP Rate Limit Middleware
- Fake Supabase Test Double
- Auth & App Context (React)
- rag_repo.py
- MARKET_COVERAGE Guide
- Frontend Plan v1 Phases
- test_phase7_hardening.py
- BM25 Lexical Retrieval
- insight.py
- TypeScript Config
- Market API Tests
- Agronomy Reference Repo
- Core Data-Layer Schema
- Phase 0 Reconnaissance Report — Mandi Price + Weather Data Layer
- WeatherRepository
- test_phase2b.py
- Weather Strip UI
- main.py
- Mandi Ingest Workflow
- Legacy Prototype Concerns
- Typography & Tailwind Tokens
- get_supabase_client
- LOCAL_DEV_GUIDE
- Price Series Utilities
- RagRepository
- Mandi Explore UI
- Grounding & Hallucination Safety
- prune.yml
- _create_sample_leaf_image
- WeatherService
- Supabase JWT Auth
- Advisory Tables & Feedback
- train_disease_model.py
- agmarknet_pkg.py
- .get_daily_trend
- Market Signal Rules
- Advisory Recon & Disease Plan
- RAG & Schemes Design
- Price Trend Chart
- get_market_search
- Market Context Card
- DiseaseDetector
- TodayView.tsx
- numpy
- Routing by horizon (past-archive, past-recent, today, future)
- NPM Scripts
- i18n Locales
- Advisory Engine Tables
- _is_tracked_scope
- today_ist
- Gemini Key Pool (Py)
- Mandi Tier B watch list and graduation (LRU cap 300)
- Mandi Price History Coverage Report
- PROJECT_DETAILS Master Specification
- Weather Search Tests
- Market Search Endpoint Tests
- Backend Python Requirements
- vite
- SPA Entry & Fonts
- Vercel Config
- Implementation Plan — Personalized Crop Advisory Layer
- priority_markets
- Codebase Conventions
- Tech Stack Map
- AGENTS.md Workspace Rules
- Testing State
- Mandi pipeline (canonicalize, validate, reconcile, aggregate)
- Branch notes — feature/accuracy-and-bugfix-sweep
- Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies)
- ask_crop_advisory
- Settings
- test_weather_search_outage_is_an_error_not_empty
- primary_order
- validators
- _Resp
- 20261004000000_phase4b_calculators.sql
- @google/genai@^1.29.0
- react-dom
- 20261101000000_app_users.sql

## God Nodes (most connected - your core abstractions)
1. `Architecture — Mandi Price + Weather Data Layer` - 82 edges
2. `Architecture — Mandi Price + Weather Data Layer` - 78 edges
3. `today_ist()` - 64 edges
4. `MandiRepository` - 53 edges
5. `FarmerRepository` - 52 edges
6. `MandiRecord` - 50 edges
7. `WeatherService` - 45 edges
8. `WeatherDay` - 41 edges
9. `get_settings()` - 40 edges
10. `Arva Style Reference (DESIGN.md)` - 38 edges

## Surprising Connections (you probably didn't know these)
- `Name canonicalization via alias maps` --references--> `Canonicalizer`  [INFERRED]
  Architecture_MarketData_Weather.md → backend/app/data/mandi/canonical.py
- `Name canonicalization via alias maps` --references--> `Canonicalizer`  [INFERRED]
  docs/data-layer/Architecture_MarketData_Weather.md → backend/app/data/mandi/canonical.py
- `Branch notes — feature/accuracy-and-bugfix-sweep` --references--> `generate_market_insight()`  [INFERRED]
  docs/branch-notes/accuracy-and-bugfix-sweep.md → backend/app/data/mandi/insight.py
- `Grounded AI market insight` --implements--> `generate_market_insight()`  [INFERRED]
  docs/fixesbyclaude/Revisions_MarketWeather.md → backend/app/data/mandi/insight.py
- `Reconcile by source_priority` --references--> `dedupe_by_key()`  [INFERRED]
  Architecture_MarketData_Weather.md → backend/app/data/mandi/reconcile.py

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

## Communities (139 total, 31 thin omitted)

### Community 0 - "OpenMeteoClient"
Cohesion: 0.10
Nodes (11): WeatherProvider protocol, WeatherCurrent, WeatherDay, OpenMeteoClient, OpenWeatherClient, test_case_d_no_validators_yields_medium_confidence(), test_case_e_wide_model_spread_yields_medium_confidence(), test_open_meteo_parse_forecast_and_recent() (+3 more)

### Community 1 - "Advisory API & Context Assembly"
Cohesion: 0.05
Nodes (35): ask_government_scheme(), check_climate(), check_soil(), compute_growth_stage(), compute_irrigation(), get_crop_stages(), get_farm_diagnostic(), list_crops() (+27 more)

### Community 2 - "test_disease_detector.py"
Cohesion: 0.20
Nodes (7): crop_of(), get_disease_detector(), metadata_key(), _sniff_mime(), test_api_disease_check_invalid_file(), test_image_preprocessing(), test_plantvillage_folder_names_map_to_metadata()

### Community 3 - "Mandi+Weather Architecture Doc"
Cohesion: 0.08
Nodes (28): agmarknet PyPI package 0.2.2 (priority 80), Architecture_Advisory.md, Architecture_Frontend.md, CEDA Agri-Market Data, Ashoka University (priority 50), /api/context/market-weather descriptive signals, crop_cost_reference table, Crop margin calculator (DES Cost of Cultivation), crop_storage_reference table (+20 more)

### Community 4 - "Farmer Profiles & Onboarding API"
Cohesion: 0.09
Nodes (33): check_crop_disease(), add_farm_crop(), _assert_owns_farmer(), create_farm(), create_farmer_profile(), get_farm(), get_farmer_profile(), get_farmer_repo() (+25 more)

### Community 5 - "package.json"
Cohesion: 0.13
Nodes (21): devDependencies, autoprefixer@^10.4.21, tailwindcss@^4.1.14, @tailwindcss/typography@^0.5.20, tsx@^4.21.0, @types/express@^4.17.21, @types/multer@^2.1.0, @types/node@^22.14.0 (+13 more)

### Community 6 - "Mandi Live Data Sources"
Cohesion: 0.10
Nodes (13): fetch_with_retry(), ProviderError, ProviderHTTPError, ProviderQuotaError, ProviderSchemaError, ProviderTimeout, DatagovLiveSource, _get_field() (+5 more)

### Community 7 - "Mandi Records & Backfill"
Cohesion: 0.12
Nodes (19): parse_date_ist(), load_tracked_scope(), dedupe_by_key(), _live_lookup(), flag_quality(), MandiRecord, load_ceda_csv(), main() (+11 more)

### Community 8 - "Growth Stage & Irrigation Engines"
Cohesion: 0.09
Nodes (23): current_growth_stage(), daily_gdd(), translate_from_english(), _history(), _onboard(), _summary(), test_bhashini_two_step_flow(), test_calendar_fallback_does_not_invent_gdd() (+15 more)

### Community 9 - "Advisory DB Migrations"
Cohesion: 0.06
Nodes (40): Branch notes: feature/accuracy-and-bugfix-sweep (PDF), Advice context: 422 for unsupported crops + computed.assumptions, Bhashini two-step ULCA translation flow, Disease detection unavailable/rejected statuses, Duplicate mandi alias-tolerant merge (APMC X vs X), FAO-56 Ch.8 daily root-zone water balance (irrigation), Open decision: farmer endpoints lack authentication, FastAPI rate limit per forwarded client IP (+32 more)

### Community 10 - "App.tsx"
Cohesion: 0.12
Nodes (30): lucide-react, react-i18next, App(), AppContent(), TabPanel(), AuthPortal(), Method, Mode (+22 more)

### Community 11 - "fusion.py"
Cohesion: 0.07
Nodes (25): AgroMetrics, FusedDay, compute_agro_metrics(), compute_normal_rain_30d(), fuse_day(), fuse_range(), get_rain_bucket(), load_fusion_config() (+17 more)

### Community 12 - "calculate_irrigation_need"
Cohesion: 0.15
Nodes (17): application_efficiency(), calculate_irrigation_need(), _cap(), _confidence_of(), effective_rain(), _f(), _forecast(), _seven_day_advice() (+9 more)

### Community 13 - "dependencies"
Cohesion: 0.07
Nodes (28): dependencies, clsx@^2.1.1, cors@^2.8.6, firebase@^12.10.0, lucide-react@^0.546.0, motion@^12.36.0, multer@^2.1.1, react@^19.0.0 (+20 more)

### Community 14 - "crop_suitability.py"
Cohesion: 0.18
Nodes (10): crop_suitability(), assess(), load_normals(), _season_climate(), _soil_matches(), _normals(), _row(), test_irrigation_and_rain_drive_water_verdict() (+2 more)

### Community 15 - "typing"
Cohesion: 0.08
Nodes (17): get_agronomy_repo(), check_climate_suitability(), assemble_advisory_context(), check_soil_suitability(), ClimateVerdict, StageResult, main(), _parse_date() (+9 more)

### Community 16 - "Advisory Generator & Audit"
Cohesion: 0.09
Nodes (22): generate_text(), describe_weather_code(), compute_advisory_confidence(), AdvisoryContext, build_system_prompt(), _citation(), _computed(), _current_weather() (+14 more)

### Community 17 - "Market Trend API"
Cohesion: 0.17
Nodes (16): get_latest_prices(), get_price_trend(), get_repo(), list_markets_for_state(), build_market_trend(), _median(), merge_alias_days(), CoverageStats (+8 more)

### Community 18 - "Farm Diagnostic & Schemes UI"
Cohesion: 0.07
Nodes (33): AdvisorView(), CONFIDENCE, Diagnosis(), Msg, suggestions(), CATEGORY_LABELS, GovernmentSchemesCard(), AdvisoryAskRequest (+25 more)

### Community 19 - "Implementation Plan v2 — Mandi Price + Weather Data Layer"
Cohesion: 0.15
Nodes (13): Implementation Plan v2 — Mandi Price + Weather Data Layer, Definition of Done (Whole Project), Antigravity Kickoff Prompt, mandi_watch LRU Eviction, Manual Steps for Jinay, On-Demand Weather Path with Daily New-Grid Cap, Phase 2 — Backfill + Trend API + Chart Wiring, Phase 2B — Mandi Explore Tier (+5 more)

### Community 20 - "Arva Design System"
Cohesion: 0.13
Nodes (30): Design system applied (palette/shape mapping), Design system applied (palette/shape mapping), Agent Prompt Guide, Arva Style Reference (DESIGN.md), Bone #f1efdf canvas, Border Radius tokens, Footer (Forest), Forest Ink #07503f (+22 more)

### Community 21 - "snap_to_grid"
Cohesion: 0.26
Nodes (9): Grid snapping to 0.1° grid_key, haversine_distance_km(), snap_to_grid(), GridPoint, test_haversine_distance_known_distance(), test_haversine_distance_same_point(), test_snap_to_grid_basic(), test_snap_to_grid_rounding_up() (+1 more)

### Community 22 - "RAG Document Ingestion"
Cohesion: 0.12
Nodes (9): chunk_text_semantically(), detect_crop_in_text(), test_api_retrieval_and_schemes_routes(), test_crop_detection(), test_crop_filtering_isolation(), test_embedding_shape_and_norm(), test_in_scope_retrieval_relevance(), test_out_of_scope_query_distinguishable() (+1 more)

### Community 23 - "Weather Ingest Workflow"
Cohesion: 0.06
Nodes (31): concurrency, cancel-in-progress, group, OPENWEATHER_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, job, default (+23 more)

### Community 24 - "Auth Portal & Onboarding UI"
Cohesion: 0.10
Nodes (27): CROPS, currentSeason(), FarmerOnboardingModal(), IRRIGATION, Loc, Props, SEASONS, SOIL_TYPES (+19 more)

### Community 25 - "Ops Health Service"
Cohesion: 0.13
Nodes (6): get_data_layer_health(), OpsService, test_health_data_endpoint_structure(), test_health_flips_to_degraded_when_job_artificially_stale(), test_health_ok_when_all_jobs_fresh(), test_rate_limiting_headers_and_enforcement()

### Community 26 - "Frontend Architecture v2"
Cohesion: 0.13
Nodes (23): Comparison tool pre-filled from saved farm, Cormorant Garamond (Reckless substitute), Live dataset-health stats (/api/health/data), Architecture — Frontend Design System & MandiLens-Class Market UI (Architecture_Frontend2.md), Update to docs/README.md, Recommended frontend stack, Frontend goals G1-G3, Inline glossary for data literacy (+15 more)

### Community 27 - "Market-Weather Context Service"
Cohesion: 0.15
Nodes (15): get_context_service(), get_market_weather_context(), ContextService, evaluate_signal_condition(), load_signals_config(), ContextMarketWeatherResponse, PriceContextBlock, SignalDetail (+7 more)

### Community 28 - "Margin & Storage Calculators"
Cohesion: 0.11
Nodes (13): get_calculator_service(), get_crop_margin(), get_market_insight_route(), get_storage_estimate(), CalculatorService, MarginEstimateResponse, StorageEstimateResponse, test_calculator_service_direct() (+5 more)

### Community 29 - "CI Pipeline"
Cohesion: 0.08
Nodes (28): name, runs-on, steps, timeout-minutes, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, name, runs-on (+20 more)

### Community 30 - "Mandi Name Canonicalizer"
Cohesion: 0.14
Nodes (14): Canonicalizer, clean_market_name(), clean_string(), normalize_lookup_key(), market_key(), MandiSource, CropScope, TrackedScope (+6 more)

### Community 31 - "Data-Layer Plan & Coverage"
Cohesion: 0.16
Nodes (13): Implementation Plan v2 — Mandi Price + Weather Data Layer, Definition of Done (Whole Project), Antigravity Kickoff Prompt, mandi_watch LRU Eviction, Manual Steps for Jinay, On-Demand Weather Path with Daily New-Grid Cap, Phase 0 — Reconnaissance, Phase 1 — Foundation + Live Mandi Ingest (+5 more)

### Community 32 - "Architecture — Mandi Price + Weather Data Layer"
Cohesion: 0.05
Nodes (62): agmarknet PyPI package 0.2.2 (priority 80), Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies), Architecture_Advisory.md, Architecture_Frontend.md, Attribution and licensing (Agmarknet, CEDA, Open-Meteo, NASA POWER CC BY 4.0), Name canonicalization via alias maps, CEDA Agri-Market Data, Ashoka University (priority 50), /api/context/market-weather descriptive signals (+54 more)

### Community 33 - "Frontend Architecture v1"
Cohesion: 0.13
Nodes (19): Commodity market-pulse grid, Comparison tool pre-filled from saved farm, Crop Margin Calculator, Live dataset-health stats (/api/health/data), Architecture — Frontend Design System & MandiLens-Class Market UI (Architecture_Frontend.md), Update to docs/README.md, Frontend goals G1-G3, Inline glossary for data literacy (+11 more)

### Community 34 - "datetime"
Cohesion: 0.12
Nodes (12): LocationsRepository, NasaPowerClient, geocode_open_meteo(), run_build_locations(), run_verify_locations(), test_nasa_power_fill_values_never_reach_db_as_numbers(), rain_buckets_mm, spread (+4 more)

### Community 35 - "MandiRepository"
Cohesion: 0.14
Nodes (9): chunk_list(), MandiRepository, get_watched_pairs(), AgmarknetPkgSource, generate_coverage_report(), main(), run_backfill(), main() (+1 more)

### Community 36 - "Data Pruning Jobs"
Cohesion: 0.08
Nodes (12): JSONFormatter, setup_logger(), load_mandilens_snapshot(), main(), prune_explore_prices(), prune_forecast_rows(), prune_ingestion_runs(), prune_openweather_rows() (+4 more)

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
Cohesion: 0.09
Nodes (23): Mandi market-name cleanup migration (APMC X / X), Frontend Cleanup & Baseline (deletion-only pass), A4 CALENDAR FALLBACK — weather history not backfilled, Decisions D1–D4 (Marketplace, floating chat, crop card, fertilizer), Deletion evidence checklist, Known problems table (W1–G3), Protected features list (Advisor, Weather, Price Trends), R1 Remove legacy weather widget (+15 more)

### Community 41 - "Prune Workflow"
Cohesion: 0.18
Nodes (11): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, steps, env, name, run, uses, with (+3 more)

### Community 42 - "Project Overview & Sources"
Cohesion: 0.16
Nodes (14): Project Overview (.planning), AI-Smart-Agriculture-System, Agmarknet / data.gov.in, Growing Degree Days Formula, README, Climate Thermal Tolerance Engine, Deep-6 Crops (Wheat, Rice, Cotton, Maize, Sugarcane, Potato), Farmer Context Assembly (+6 more)

### Community 43 - "get_settings"
Cohesion: 0.10
Nodes (12): get_settings(), _groq_generate(), _make_jwt(), test_app_login_token_is_owner_checked(), test_auth_bypassed_when_secret_unset(), test_auth_cross_user_access_forbidden(), test_auth_expired_token_returns_401(), test_auth_invalid_token_returns_401() (+4 more)

### Community 44 - "tolerances"
Cohesion: 0.25
Nodes (8): abs_mm, bucket_mismatch_is_disagreement, rel, tolerances, precip, radiation_rel, rh_pct, temp_c

### Community 45 - "MarketDataView.tsx"
Cohesion: 0.07
Nodes (41): react, ErrorBoundary, Props, State, DataFooter(), DataFooterProps, daysAgo(), MandiAutocomplete() (+33 more)

### Community 46 - "Advisory Architecture Engines"
Cohesion: 0.15
Nodes (19): WeatherService.get_summary(), Architecture — Personalized Crop Advisory Layer, Grounded advisory system prompt, AdvisoryContext object, Advisory API contract (/api/advisory/ask, disease-check, feedback, schemes), Climate/temperature suitability engine, crop_climate_suitability table, crop_kc_reference table (+11 more)

### Community 47 - "Tracked Scope & Recon"
Cohesion: 0.14
Nodes (14): crops, aliases, display, key, Lasalgaon, market_aliases, Maharashtra, states (+6 more)

### Community 48 - "Gemini Client & Embeddings"
Cohesion: 0.14
Nodes (9): embed_text(), _extract_text(), l2_normalize(), _thinking_config(), _deterministic_mock_embedding(), get_gemini_embedding(), _load_disk_cache(), _save_disk_cache() (+1 more)

### Community 49 - "HTTP Rate Limit Middleware"
Cohesion: 0.12
Nodes (4): client_ip_from_request(), RateLimitMiddleware, reset_rate_limits(), _fresh_rate_limits()

### Community 51 - "Auth & App Context (React)"
Cohesion: 0.19
Nodes (11): AppContext, AppContextType, AppData, createAppDataFromStorage(), defaultAppData, AuthContext, AuthContextType, authService (+3 more)

### Community 52 - "rag_repo.py"
Cohesion: 0.17
Nodes (9): get_rag_repo(), RagChunk, RagDocument, RagDocumentCreate, RetrievalRequest, detect_doc_type(), extract_text_per_page(), ingest_document() (+1 more)

### Community 53 - "MARKET_COVERAGE Guide"
Cohesion: 0.28
Nodes (4): MandiLens Agmarknet Snapshot (88,852 records), MARKET_COVERAGE Guide, Thin Data Threshold (<3 reports), Working Demo Selections (Gorakhpur, Sidhi, Khanna)

### Community 54 - "Frontend Plan v1 Phases"
Cohesion: 0.16
Nodes (18): next/og OG image generation, Seven-day price outlook / typical-range, Market comparison tool (2-4 markets), Crop margin calculator UI (/api/market/margin), Frontend definition of done, Implementation Plan — Frontend Design System & Market UI (Implementationplan_Frontend.md), Browse-by-state/Explore search (/api/market/search), Manual steps for Jinay (+10 more)

### Community 55 - "test_phase7_hardening.py"
Cohesion: 0.06
Nodes (12): get_query_repo(), SlidingWindowRateLimiter, format_table_row(), main(), review_feedback(), test_advisory_ask_api_endpoint(), test_advisory_feedback_api_endpoint(), test_assemble_advisory_context() (+4 more)

### Community 56 - "BM25 Lexical Retrieval"
Cohesion: 0.16
Nodes (5): _cosine_similarity(), BM25Index, reciprocal_rank_fusion(), tokenize(), Hybrid BM25 + dense retrieval with RRF

### Community 57 - "insight.py"
Cohesion: 0.16
Nodes (10): _confidence(), _fmt_pct(), format_context_for_prompt(), generate_fallback_market_insight(), generate_market_insight(), audit_number_grounding(), extract_context_numbers(), _walk() (+2 more)

### Community 58 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+10 more)

### Community 59 - "Market API Tests"
Cohesion: 0.19
Nodes (12): _clear_overrides(), _daily_view(), _install(), _row(), test_latest_prices_endpoint(), test_latest_prices_include_flagged(), test_list_markets_endpoint(), test_market_insight_endpoint() (+4 more)

### Community 60 - "Agronomy Reference Repo"
Cohesion: 0.16
Nodes (5): AgronomyReferenceRepository, CropClimateSuitability, CropKcReference, CropSoilSuitability, CropStageNorm

### Community 61 - "Core Data-Layer Schema"
Cohesion: 0.16
Nodes (14): ingestion_runs, locations, locations_grid_idx, mandi_prices, mandi_prices_state_idx, mandi_prices_trend_idx, mandi_watch, mandi_watch_tracked_idx (+6 more)

### Community 62 - "Phase 0 Reconnaissance Report — Mandi Price + Weather Data Layer"
Cohesion: 0.15
Nodes (13): check_storage_budget(), Phase 0 Reconnaissance Report — Mandi Price + Weather Data Layer, Backend & Deployment Environment, Hardcoded Offset 0 Pagination Gap, Legacy data.gov.in Fetcher (server.ts /api/market), Legacy Market History JSON (data/market_price_history.json), Legacy OpenWeatherMap Usage, Recharts Chart Library (+5 more)

### Community 63 - "WeatherRepository"
Cohesion: 0.19
Nodes (8): now_utc_iso(), chunk_list(), weather_day_from_row(), WeatherRepository, run_ingest_weather(), run_power_validate(), run_reconcile_recent(), run_refresh_normals()

### Community 64 - "test_phase2b.py"
Cohesion: 0.14
Nodes (7): search_market(), _upsert_watch(), MarketSearchResponse, MarketSearchResult, TestSearchSchemas, TestUpsertWatch, TestWatchedPairs

### Community 65 - "Weather Strip UI"
Cohesion: 0.14
Nodes (19): MarketCalculators(), MarketCalculatorsProps, PROVIDER_NAMES, providerName(), WeatherStrip(), WeatherStripProps, WMO_TEXT, fetchCropMargin() (+11 more)

### Community 66 - "main.py"
Cohesion: 0.23
Nodes (5): get_ops_service(), health(), DatabaseHealthInfo, HealthDataResponse, JobHealthInfo

### Community 67 - "Mandi Ingest Workflow"
Cohesion: 0.08
Nodes (24): concurrency, cancel-in-progress, group, DATA_GOV_IN_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, jobs, run (+16 more)

### Community 68 - "Legacy Prototype Concerns"
Cohesion: 0.22
Nodes (9): Codebase Concerns, Missing Tests Concern, Onboarding Summary, Roadmap, Phase 2: JSON DB to Firestore Migration, Phase 3: Add Test Coverage, Planning State, Supabase Client Dependency (+1 more)

### Community 69 - "Typography & Tailwind Tokens"
Cohesion: 0.19
Nodes (13): Cormorant Garamond (Reckless substitute), Recommended frontend stack, next/font self-hosting, Noto Sans Devanagari/Gujarati fallback, shadcn/ui primitives, Tailwind CSS v4, CSS Custom Properties (:root), Inter font (+5 more)

### Community 70 - "get_supabase_client"
Cohesion: 0.08
Nodes (6): AdvisoryQueryRepository, _cached_client(), get_supabase_client(), _load_yaml(), ReferenceRepository, run_load_reference()

### Community 71 - "LOCAL_DEV_GUIDE"
Cohesion: 0.18
Nodes (9): Codebase Integrations, Firebase / Firestore Integration, Google GenAI (@google/genai), JWT & bcryptjs Auth, External Market API Retry & Cache, LOCAL_DEV_GUIDE, Advisory Rate Limit (20/min, HTTP 429), Farmer Onboarding API (/api/farmer/onboard) (+1 more)

### Community 72 - "Price Series Utilities"
Cohesion: 0.21
Nodes (6): _change_vs(), generate_date_spine(), is_stale_data(), test_generate_date_spine_continuous(), test_is_stale_data_fresh_vs_stale(), test_is_stale_data_none()

### Community 74 - "Mandi Explore UI"
Cohesion: 0.21
Nodes (12): ALL_CROPS, ALL_STATES, DEEP_CROPS, favKey(), MandiExplore(), MandiExploreProps, MarketCard(), PASTEL_TINTS (+4 more)

### Community 75 - "Grounding & Hallucination Safety"
Cohesion: 0.18
Nodes (9): Advisory confidence (grounded/partial/insufficient), Dosage/chemical-name similarity threshold, Golden question set (20-30 per crop), Safety, grounding & hallucination controls, Post-generation number-grounding check, Advisory Phase 4 — Advisory generation, computed.assumptions listing defaults, R2 Remove Home Crop Suitability card (+1 more)

### Community 76 - "prune.yml"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, jobs, prune, name, on, schedule (+4 more)

### Community 77 - "_create_sample_leaf_image"
Cohesion: 0.12
Nodes (11): _create_noise_image(), _create_sample_leaf_image(), _detector_with_stub(), _RecordingModel, _StubModel, test_api_disease_check_endpoint(), test_disease_treatment_rag_linking(), test_model_labels_follow_training_order_and_crop_hint() (+3 more)

### Community 78 - "WeatherService"
Cohesion: 0.13
Nodes (19): get_current_weather(), get_weather_forecast(), get_weather_history(), get_weather_service(), get_weather_summary(), search_locations(), WeatherService, AgroMetricsDetail (+11 more)

### Community 80 - "Advisory Tables & Feedback"
Cohesion: 0.22
Nodes (10): advisory_queries table, farm_crops table, farmer_profile table, farms table, Thumbs up/down feedback loop, Phone number + OTP login, Per-farmer rate limit on /api/advisory/ask, Advisory Phase 1 — Farmer profile & onboarding (+2 more)

### Community 81 - "train_disease_model.py"
Cohesion: 0.29
Nodes (3): _class_view(), _select_classes(), _split_views()

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

### Community 88 - "get_market_search"
Cohesion: 0.20
Nodes (3): _enforce_lru_cap(), get_market_search(), TestLRUEviction

### Community 89 - "Market Context Card"
Cohesion: 0.33
Nodes (7): MarketContextCard(), MarketContextCardProps, ContextMarketWeatherResponse, fetchMarketWeatherContext(), PriceContextBlock, SignalDetail, WeatherContextBlock

### Community 90 - "DiseaseDetector"
Cohesion: 0.16
Nodes (5): DiseaseDetector, _gemini_vision_diagnosis(), DiseaseCheckResponse, DiseaseTreatmentExtract, test_no_model_gives_no_diagnosis()

### Community 91 - "TodayView.tsx"
Cohesion: 0.22
Nodes (14): Props, ACTION_TEXT, Async, inr(), Muted(), Panel(), Props, SeasonLine() (+6 more)

### Community 92 - "numpy"
Cohesion: 0.26
Nodes (8): apply_temperature(), expected_calibration_error(), fit_temperature(), negative_log_likelihood(), test_temperature_fit_reduces_overconfidence(), _predict(), _report(), train_disease_model()

### Community 93 - "Routing by horizon (past-archive, past-recent, today, future)"
Cohesion: 0.18
Nodes (10): ERA5-Land reanalysis, locations table, Market-level weather (locations.kind=mandi), Multi-model forecast spread (ecmwf_ifs025, gfs_seamless, icon_seamless), NASA POWER (validator + agro baselines + fallback), Open-Meteo (PRIMARY weather source), Routing by horizon (past-archive, past-recent, today, future), Weather confidence levels (high/medium/low) (+2 more)

### Community 94 - "NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, clean, dev, dev:backend, lint, preview, start

### Community 95 - "i18n Locales"
Cohesion: 0.17
Nodes (5): i18next@^25.10.5, i18next-browser-languagedetector@^8.2.1, i18next, i18next-browser-languagedetector, resources

### Community 96 - "Advisory Engine Tables"
Cohesion: 0.36
Nodes (7): crop_climate_suitability, crop_kc_reference, crop_soil_suitability, crop_stage_norms, idx_crop_climate_crop, idx_crop_kc_crop, idx_crop_stage_norms_crop

### Community 100 - "Mandi Tier B watch list and graduation (LRU cap 300)"
Cohesion: 0.32
Nodes (8): data.gov.in Agmarknet daily feed (priority 100), data.gov.in pagination trap and demo-key detector, Mandi Tier B watch list and graduation (LRU cap 300), mandi_watch table (Tier B watch list), Market API (/api/market/latest, trend, search, margin, storage-estimate), Storage budget and retention (prune), Supabase Free tier constraint (500 MB, 7-day idle pause), Tier B — Explore coverage (any crop/market, live pass-through)

### Community 101 - "Mandi Price History Coverage Report"
Cohesion: 0.83
Nodes (4): Mandi Price History Coverage Report, 50% Coverage Threshold, Markets with <50% Coverage List, All Tracked Crop-Market Pairs at 0% Coverage

### Community 102 - "PROJECT_DETAILS Master Specification"
Cohesion: 0.17
Nodes (14): Farmer Irrigation Log, PROJECT_DETAILS Master Specification, Background Automation Jobs (11), FAO-56 Penman-Monteith ET0, Hybrid RAG (BM25 + pgvector cosine), NASA POWER Agroclimatology, Net Irrigation Requirement (7-day), Open-Meteo API (+6 more)

### Community 105 - "Backend Python Requirements"
Cohesion: 0.20
Nodes (10): Requirements, Gemini AI Recommendations Requirement, JWT Authentication Requirement, Backend Python Requirements, agmarknet 0.2.2 Dependency, FastAPI Dependency, PyJWT Dependency, Supabase JWT Farmer Ownership Check (+2 more)

### Community 106 - "vite"
Cohesion: 0.20
Nodes (7): @tailwindcss/vite@^4.1.14, vite@^6.2.0, @vitejs/plugin-react@^5.0.4, vite@^6.2.0, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 107 - "SPA Entry & Fonts"
Cohesion: 0.40
Nodes (5): index.html SPA Entry, Indic Multilingual Font Stack (Noto Sans), React Root Mount (/src/main.tsx), Bhashini Indic Translation, Arva Design System

### Community 108 - "Vercel Config"
Cohesion: 0.40
Nodes (4): buildCommand, outputDirectory, rewrites, version

### Community 109 - "Implementation Plan — Personalized Crop Advisory Layer"
Cohesion: 0.22
Nodes (11): crop_soil_suitability table, Soil Health Card aggregate data, Soil-suitability engine, SoilGrids (ISRIC), Implementation Plan — Personalized Crop Advisory Layer, Manual PoP extraction of GDD/Kc/soil values, Advisory Phase 2 — Computation engines, Smart Crop Advisory System — Project Map (+3 more)

### Community 110 - "priority_markets"
Cohesion: 0.25
Nodes (8): priority_markets, Gujarat, Karnataka, Madhya Pradesh, Maharashtra, Punjab, Rajasthan, Uttar Pradesh

### Community 112 - "Tech Stack Map"
Cohesion: 0.67
Nodes (3): Tech Stack Map, React 19 + Vite Frontend Stack, Vercel Deployment (vercel.json)

### Community 113 - "AGENTS.md Workspace Rules"
Cohesion: 0.25
Nodes (5): AGENTS.md Workspace Rules, CLAUDE.md graphify Rules, DES Cost of Cultivation & WDRA Benchmarks, Crop Margin Calculator (DES C2, A2+FL), Storage Estimator (Hold vs Sell)

### Community 126 - "Mandi pipeline (canonicalize, validate, reconcile, aggregate)"
Cohesion: 0.29
Nodes (7): Name canonicalization via alias maps, Mandi pipeline (canonicalize, validate, reconcile, aggregate), mandi_prices table, Reconcile by source_priority, Quality flags (nonpositive, order_violation, missing_price, outlier), upsert_mandi_prices RPC (priority-aware upsert), v_mandi_daily view (median modal across varieties)

### Community 127 - "Branch notes — feature/accuracy-and-bugfix-sweep"
Cohesion: 0.33
Nodes (7): Branch notes — feature/accuracy-and-bugfix-sweep, FAO-56 Ch.8 daily root-zone water balance, farm_crop_status daily snapshot, Open issue: farmer endpoints have no authentication, Suggested: weather-driven disease risk alerts (Hutton criteria), Irrigation log (POST/GET /api/farmer/farms/{id}/irrigation), Open issue: personal data (users.json) committed to git

### Community 128 - "Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies)"
Cohesion: 0.25
Nodes (7): Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies), Attribution and licensing (Agmarknet, CEDA, Open-Meteo, NASA POWER CC BY 4.0), Frontend integration (PriceTrendChart, PriceContextHeader, WeatherStrip, DataFooter), OpenWeatherMap free endpoints (cross-check), Weather API (/api/weather/current, forecast, history, summary), weather_daily_fused table (served), weather_normals_monthly table

### Community 132 - "primary_order"
Cohesion: 0.40
Nodes (5): primary_order, future, past_archive, past_recent, today

### Community 133 - "validators"
Cohesion: 0.40
Nodes (5): validators, future, past_archive, past_recent, today

## Ambiguous Edges - Review These
- `PROJECT_DETAILS Master Specification` → `Missing Tests Concern`  [AMBIGUOUS]
  .planning/codebase/CONCERNS.md · relation: conceptually_related_to

## Knowledge Gaps
- **93 isolated node(s):** `Smart India Hackathon SIH25010 Origin`, `crop_soil_suitability table`, `Soil Health Card aggregate data`, `SoilGrids (ISRIC)`, `React 19 + Vite Frontend Stack` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 845 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `today_ist()` connect `today_ist` to `OpenMeteoClient`, `Advisory API & Context Assembly`, `Farmer Profiles & Onboarding API`, `Mandi Live Data Sources`, `Mandi Records & Backfill`, `Growth Stage & Irrigation Engines`, `fusion.py`, `crop_suitability.py`, `typing`, `Market Trend API`, `Market-Weather Context Service`, `Data-Layer Plan & Coverage`, `datetime`, `MandiRepository`, `Data Pruning Jobs`, `Market API Tests`, `WeatherRepository`, `Price Series Utilities`, `WeatherService`, `get_market_search`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `Smart India Hackathon SIH25010 Origin`, `crop_soil_suitability table`, `Soil Health Card aggregate data` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `OpenMeteoClient` be split into smaller, more focused modules?**
  _Cohesion score 0.0990990990990991 - nodes in this community are weakly interconnected._
- **Why does `Phase 3 — Weather` connect `datetime` to `Weather Strip UI`, `fusion.py`, `WeatherService`, `snap_to_grid`, `Data-Layer Plan & Coverage`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Advisory API & Context Assembly` be split into smaller, more focused modules?**
  _Cohesion score 0.054987212276214836 - nodes in this community are weakly interconnected._
- **Why does `Phase 3 — Weather` connect `datetime` to `Weather Strip UI`, `fusion.py`, `WeatherService`, `Implementation Plan v2 — Mandi Price + Weather Data Layer`, `snap_to_grid`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `PROJECT_DETAILS Master Specification` and `Missing Tests Concern`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
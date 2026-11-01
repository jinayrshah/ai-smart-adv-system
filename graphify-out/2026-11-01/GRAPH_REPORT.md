# Graph Report - ai-smart-adv-system  (2026-11-01)

## Corpus Check
- 254 files · ~198,880 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .bundle 3, .css 3, (none) 2)

## Summary
- 2594 nodes · 6272 edges · 126 communities (98 shown, 28 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 527 edges (avg confidence: 0.89)
- Token cost: 592,035 input · 0 output

## Community Hubs (Navigation)
- Weather Ingestion & Locations
- Advisory API & Context Assembly
- Disease Detection Model
- Mandi+Weather Architecture Doc
- Farmer Profiles & Onboarding API
- Frontend Dependencies & Build
- Mandi Live Data Sources
- Mandi Records & Backfill
- Growth Stage & Irrigation Engines
- Advisory DB Migrations
- App Shell & Home UI
- Weather Fusion & Agro Metrics
- Weather Service API
- AI Chat Widget & RAG Client
- Shared Time & Logging Utils
- Backend App & Test Harness
- Advisory Generator & Audit
- Market Trend API
- Farm Diagnostic & Schemes UI
- Mandi/Weather Implementation Plan
- Arva Design System
- Government Schemes Engine
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
- Ingestion Jobs & Resilience Design
- Frontend Architecture v1
- Location Grid & Stage Recompute
- Mandi Repository & Snapshots
- Data Pruning Jobs
- Legacy BFF Proxy Server
- Bhashini Translation
- Frontend Plan v2 Phases
- Fix Logs & Revisions
- Prune Workflow
- Project Overview & Sources
- Settings & JWT Config
- Weather Fusion Config
- Market Data & Compare Views
- Advisory Architecture Engines
- Tracked Scope & Recon
- Gemini Client & Embeddings
- HTTP Rate Limit Middleware
- Fake Supabase Test Double
- Auth & App Context (React)
- Market Insight UI
- Master Spec & Integrity Rules
- Frontend Plan v1 Phases
- Advisory Query Feedback Loop
- BM25 Lexical Retrieval
- Market Insight Grounding
- TypeScript Config
- Market API Tests
- Agronomy Reference Repo
- Core Data-Layer Schema
- Error Boundary & Dashboard Hooks
- Mandi Daily Ingestion
- Market Search Schemas
- Weather Strip UI
- Advisory Query Repository
- Mandi Ingest Workflow
- Legacy Prototype Concerns
- Typography & Tailwind Tokens
- Cost Reference Repository
- Dev Guide & Workspace Rules
- Price Series Utilities
- RAG Repository
- Mandi Explore UI
- Grounding & Hallucination Safety
- Weather Routing Design
- Market Search LRU Cache
- Bhashini & FAO-56 Notes
- Supabase JWT Auth
- Advisory Tables & Feedback
- Weather Fusion Design
- Tracked Scope Filter
- Sliding Window Rate Limiter
- Market Signal Rules
- Advisory Recon & Disease Plan
- RAG & Schemes Design
- Price Trend Chart
- Calculators UI
- Market Context Card
- Mandi Pipeline Design
- Supabase Client & Ref Loader
- Priority Markets Config
- Advisory Implementation Plan
- NPM Scripts
- i18n Locales
- Advisory Engine Tables
- Market API & Storage Design
- Tier B Coverage & Storage
- Gemini Key Pool (Py)
- Gemini Key Pool (TS)
- Legacy Architecture Map
- YAML Reference Loader
- Weather Search Tests
- Market Search Endpoint Tests
- Auth Requirements
- Mandi Data Source Catalog
- SPA Entry & Fonts
- Vercel Config
- Soil Suitability Engine
- Price Context Header
- Codebase Conventions
- Tech Stack Map
- Crop Stages Endpoint
- Testing State

## God Nodes (most connected - your core abstractions)
1. `Architecture — Mandi Price + Weather Data Layer` - 82 edges
2. `Architecture — Mandi Price + Weather Data Layer` - 78 edges
3. `today_ist()` - 63 edges
4. `MandiRepository` - 53 edges
5. `FarmerRepository` - 51 edges
6. `MandiRecord` - 50 edges
7. `WeatherService` - 45 edges
8. `WeatherDay` - 41 edges
9. `Arva Style Reference (DESIGN.md)` - 38 edges
10. `Architecture — Frontend Design System & MandiLens-Class Market UI (Architecture_Frontend.md)` - 36 edges

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
- **Zero-Fabrication Data Provenance Policy** — agents_data_integrity_provenance_rule, market_coverage_snapshot_root_cause, market_coverage_demo_seed_proposal, project_details_grounded_market_insight, agents_non_storable_crop_refusal_rule [INFERRED 0.85]
- **Multi-Source Weather Fusion** — readme_weather_fusion_layer, project_details_open_meteo, project_details_nasa_power, project_details_fao56_penman_monteith [INFERRED 0.85]
- **Mandi source priority chain (datagov 100 > agmarknet 80 > CEDA 50 > Kaggle 10)** — architecture_marketdata_weather_datagov_live_feed, architecture_marketdata_weather_agmarknet_pkg, architecture_marketdata_weather_ceda, architecture_marketdata_weather_kaggle_seed, architecture_marketdata_weather_priority_reconciliation [EXTRACTED 1.00]
- **Mandi source priority chain (datagov 100 > agmarknet 80 > CEDA 50 > Kaggle 10)** — docs_data_layer_architecture_marketdata_weather_datagov_live_feed, docs_data_layer_architecture_marketdata_weather_agmarknet_pkg, docs_data_layer_architecture_marketdata_weather_ceda, docs_data_layer_architecture_marketdata_weather_kaggle_seed, docs_data_layer_architecture_marketdata_weather_priority_reconciliation [EXTRACTED 1.00]
- **Explore Tier (any crop/market/location in India)** — implementationplan_marketdata_weather_phase_2b_mandi_explore, implementationplan_marketdata_weather_phase_3b_weather_explore, implementationplan_marketdata_weather_mandi_watch_lru, implementationplan_marketdata_weather_ondemand_weather_path [EXTRACTED 1.00]
- **Legacy-to-Target Migration Mapping** — docs_data_layer_recon_legacy_datagov_fetcher, docs_data_layer_recon_legacy_history_json, docs_data_layer_recon_legacy_openweather_service, docs_data_layer_recon_recharts_chart_library, docs_data_layer_recon_existing_target_mapping [EXTRACTED 1.00]
- **Data Integrity & Provenance Guards** — implementationplan_marketdata_weather_no_synthetic_data, implementationplan_marketdata_weather_source_priority_rule, implementationplan_marketdata_weather_mandi_unique_key, implementationplan_marketdata_weather_phase_4b_calculators [INFERRED 0.85]
- **Arva named UI components** — design_pill_cta_button, design_pill_outline_button, design_pill_nav_element, design_get_in_touch_pill, design_full_bleed_hero, design_lime_marquee_strip, design_pastel_quilt_card, design_forest_section_banner, design_input_field, design_header_logo_lockup, design_section_divider_header, design_partner_logo_card, design_footer_forest [EXTRACTED 1.00]
- **MandiLens patterns adopted (Architecture_Frontend.md)** — architecture_frontend_dataset_health_stats, architecture_frontend_commodity_market_pulse_grid, architecture_frontend_task_first_navigation, architecture_frontend_inline_glossary, architecture_frontend_trust_is_part_of_interface, architecture_frontend_mandilens_compare_tool [EXTRACTED 1.00]
- **MandiLens patterns adopted (Architecture_Frontend2.md)** — architecture_frontend2_dataset_health_stats, architecture_frontend2_commodity_market_pulse_grid, architecture_frontend2_task_first_navigation, architecture_frontend2_inline_glossary, architecture_frontend2_trust_is_part_of_interface, architecture_frontend2_mandilens_compare_tool [EXTRACTED 1.00]
- **Compute→Retrieve→Generate grounded advisory flow** — docs_advisory_architecture_advisory_growth_stage_engine_gdd, docs_advisory_architecture_advisory_water_requirement_engine, docs_advisory_architecture_advisory_soil_suitability_engine, docs_advisory_architecture_advisory_climate_suitability_engine, docs_advisory_architecture_advisory_rag_pipeline, docs_advisory_architecture_advisory_advisorycontext, docs_advisory_architecture_advisory_advisory_prompt, docs_advisory_architecture_advisory_hallucination_controls [EXTRACTED 1.00]
- **PoP-sourced crop reference tables** — docs_advisory_architecture_advisory_crop_stage_norms, docs_advisory_architecture_advisory_crop_kc_reference, docs_advisory_architecture_advisory_crop_soil_suitability, docs_advisory_architecture_advisory_crop_climate_suitability, docs_advisory_implementationplan_advisory_manual_pop_extraction [INFERRED 0.85]
- **Approved frontend cleanup removals R1–R5** — docs_fixesbyclaude_cleanup_frontend_baseline_r1_legacy_weather_widget, docs_fixesbyclaude_cleanup_frontend_baseline_r2_crop_suitability_card, docs_fixesbyclaude_cleanup_frontend_baseline_r3_dead_code_sweep, docs_fixesbyclaude_cleanup_frontend_baseline_r4_history_soil_tab, docs_fixesbyclaude_cleanup_frontend_baseline_r5_fake_placeholder_data [EXTRACTED 1.00]
- **Accuracy fixes replacing fabricated defaults with grounded data** — docs_fixesbyclaude_accuracy_and_bugfix_sweep_fao56_root_zone_water_balance, docs_fixesbyclaude_accuracy_and_bugfix_sweep_growth_stage_gdd_accuracy, docs_fixesbyclaude_accuracy_and_bugfix_sweep_advice_context_assumptions, docs_fixesbyclaude_accuracy_and_bugfix_sweep_grounded_market_insight, docs_fixesbyclaude_accuracy_and_bugfix_sweep_disease_detection_unavailable_rejected [INFERRED 0.85]

## Communities (126 total, 28 thin omitted)

### Community 0 - "Weather Ingestion & Locations"
Cohesion: 0.06
Nodes (21): WeatherProvider protocol, LocationsRepository, WeatherCurrent, WeatherDay, NasaPowerClient, OpenMeteoClient, OpenWeatherClient, chunk_list() (+13 more)

### Community 1 - "Advisory API & Context Assembly"
Cohesion: 0.06
Nodes (35): ask_crop_advisory(), ask_government_scheme(), check_climate(), check_crop_disease(), check_soil(), get_farm_diagnostic(), record_query_feedback(), retrieve_knowledge_chunks() (+27 more)

### Community 2 - "Disease Detection Model"
Cohesion: 0.05
Nodes (31): apply_temperature(), expected_calibration_error(), fit_temperature(), negative_log_likelihood(), crop_of(), DiseaseDetector, get_disease_detector(), metadata_key() (+23 more)

### Community 3 - "Mandi+Weather Architecture Doc"
Cohesion: 0.05
Nodes (62): agmarknet PyPI package 0.2.2 (priority 80), Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies), Architecture_Advisory.md, Architecture_Frontend.md, Attribution and licensing (Agmarknet, CEDA, Open-Meteo, NASA POWER CC BY 4.0), Name canonicalization via alias maps, CEDA Agri-Market Data, Ashoka University (priority 50), /api/context/market-weather descriptive signals (+54 more)

### Community 4 - "Farmer Profiles & Onboarding API"
Cohesion: 0.10
Nodes (31): add_farm_crop(), _assert_owns_farmer(), create_farm(), create_farmer_profile(), get_farm(), get_farmer_profile(), get_farmer_repo(), list_farm_crops() (+23 more)

### Community 5 - "Frontend Dependencies & Build"
Cohesion: 0.04
Nodes (62): dependencies, bcryptjs@^3.0.3, cors@^2.8.6, dotenv@^17.2.3, express-rate-limit@^8.3.1, firebase@^12.10.0, i18next@^25.10.5, i18next-browser-languagedetector@^8.2.1 (+54 more)

### Community 6 - "Mandi Live Data Sources"
Cohesion: 0.07
Nodes (16): fetch_with_retry(), ProviderError, ProviderHTTPError, ProviderQuotaError, ProviderSchemaError, ProviderTimeout, parse_date_ist(), AgmarknetPkgSource (+8 more)

### Community 7 - "Mandi Records & Backfill"
Cohesion: 0.12
Nodes (22): clean_market_name(), load_tracked_scope(), dedupe_by_key(), chunk_list(), _live_lookup(), flag_quality(), MandiRecord, main() (+14 more)

### Community 8 - "Growth Stage & Irrigation Engines"
Cohesion: 0.09
Nodes (33): compute_irrigation(), current_growth_stage(), daily_gdd(), application_efficiency(), calculate_irrigation_need(), _cap(), _confidence_of(), effective_rain() (+25 more)

### Community 9 - "Advisory DB Migrations"
Cohesion: 0.06
Nodes (40): Branch notes: feature/accuracy-and-bugfix-sweep (PDF), Advice context: 422 for unsupported crops + computed.assumptions, Bhashini two-step ULCA translation flow, Disease detection unavailable/rejected statuses, Duplicate mandi alias-tolerant merge (APMC X vs X), FAO-56 Ch.8 daily root-zone water balance (irrigation), Open decision: farmer endpoints lack authentication, FastAPI rate limit per forwarded client IP (+32 more)

### Community 10 - "App Shell & Home UI"
Cohesion: 0.11
Nodes (36): clsx@^2.1.1, clsx, lucide-react, motion, react-i18next, AppContent(), cn(), Tab (+28 more)

### Community 11 - "Weather Fusion & Agro Metrics"
Cohesion: 0.07
Nodes (19): FusedDay, compute_agro_metrics(), compute_normal_rain_30d(), fuse_day(), get_rain_bucket(), phase_key(), select_best_row_for_source(), within_tolerance() (+11 more)

### Community 12 - "Weather Service API"
Cohesion: 0.12
Nodes (20): get_current_weather(), get_weather_forecast(), get_weather_history(), get_weather_service(), get_weather_summary(), AgroMetrics, WeatherService, AgroMetricsDetail (+12 more)

### Community 13 - "AI Chat Widget & RAG Client"
Cohesion: 0.07
Nodes (32): @google/genai@^1.29.0, react-markdown@^10.1.0, @google/genai, react-markdown, ChatWidget(), cn(), defaultGreeting, Message (+24 more)

### Community 14 - "Shared Time & Logging Utils"
Cohesion: 0.16
Nodes (10): now_ist(), today_ist(), fuse_range(), load_fusion_config(), test_reconcile_recent_replaces_recent_with_archive_and_refuses(), Phase 3 — Weather, Weather Fusion with Confidence Scoring, Existing to Target Mapping Table (+2 more)

### Community 15 - "Backend App & Test Harness"
Cohesion: 0.06
Nodes (10): test_api_advisory_endpoints(), test_climate_suitability_verdicts(), test_farm_diagnostic_endpoint(), test_growth_stage_calendar_fallback(), test_growth_stage_engine_gdd_calculation(), test_growth_stage_unmapped_crop_fails_loudly(), test_soil_suitability_compliant_returns_empty_list(), test_soil_suitability_flags_mismatch_and_ph() (+2 more)

### Community 16 - "Advisory Generator & Audit"
Cohesion: 0.10
Nodes (19): describe_weather_code(), compute_advisory_confidence(), AdvisoryContext, build_system_prompt(), _citation(), _computed(), _current_weather(), generate_advisory_response() (+11 more)

### Community 17 - "Market Trend API"
Cohesion: 0.12
Nodes (22): list_crops(), get_latest_prices(), get_market_insight_route(), get_price_trend(), list_markets_for_state(), search_market(), now_utc_iso(), market_key() (+14 more)

### Community 18 - "Farm Diagnostic & Schemes UI"
Cohesion: 0.07
Nodes (27): ACTION_COPY, FarmDiagnosticCard(), Props, todayIso(), CATEGORY_LABELS, GovernmentSchemesCard(), AdvisoryAskRequest, AdvisoryComputedContext (+19 more)

### Community 19 - "Mandi/Weather Implementation Plan"
Cohesion: 0.08
Nodes (26): Implementation Plan v2 — Mandi Price + Weather Data Layer, Definition of Done (Whole Project), data.gov.in Demo-Key Detector, Antigravity Kickoff Prompt, mandi_watch LRU Eviction, Manual Steps for Jinay, On-Demand Weather Path with Daily New-Grid Cap, Phase 1 — Foundation + Live Mandi Ingest (+18 more)

### Community 20 - "Arva Design System"
Cohesion: 0.13
Nodes (30): Design system applied (palette/shape mapping), Design system applied (palette/shape mapping), Agent Prompt Guide, Arva Style Reference (DESIGN.md), Bone #f1efdf canvas, Border Radius tokens, Footer (Forest), Forest Ink #07503f (+22 more)

### Community 21 - "Government Schemes Engine"
Cohesion: 0.09
Nodes (16): list_government_schemes(), answer_scheme_query(), get_all_schemes(), get_scheme_by_code(), AdvisorySource, GovernmentScheme, SchemeAskResponse, test_golden_questions_national_schemes() (+8 more)

### Community 22 - "RAG Document Ingestion"
Cohesion: 0.10
Nodes (16): get_rag_repo(), RagDocument, RagDocumentCreate, chunk_text_semantically(), detect_crop_in_text(), detect_doc_type(), extract_text_per_page(), ingest_document() (+8 more)

### Community 23 - "Weather Ingest Workflow"
Cohesion: 0.06
Nodes (31): concurrency, cancel-in-progress, group, OPENWEATHER_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, job, default (+23 more)

### Community 24 - "Auth Portal & Onboarding UI"
Cohesion: 0.12
Nodes (26): AuthPortal(), CROPS_LIST, INDIAN_STATES_DISTRICTS, SOIL_TYPES, Login(), DEEP_CROPS, FarmerOnboardingModal(), FIELD_SIZE_OPTIONS (+18 more)

### Community 25 - "Ops Health Service"
Cohesion: 0.13
Nodes (10): get_data_layer_health(), get_ops_service(), OpsService, DatabaseHealthInfo, HealthDataResponse, JobHealthInfo, test_health_data_endpoint_structure(), test_health_flips_to_degraded_when_job_artificially_stale() (+2 more)

### Community 26 - "Frontend Architecture v2"
Cohesion: 0.13
Nodes (23): Comparison tool pre-filled from saved farm, Cormorant Garamond (Reckless substitute), Live dataset-health stats (/api/health/data), Architecture — Frontend Design System & MandiLens-Class Market UI (Architecture_Frontend2.md), Update to docs/README.md, Recommended frontend stack, Frontend goals G1-G3, Inline glossary for data literacy (+15 more)

### Community 27 - "Market-Weather Context Service"
Cohesion: 0.17
Nodes (13): get_context_service(), get_market_weather_context(), ContextService, evaluate_signal_condition(), load_signals_config(), ContextMarketWeatherResponse, PriceContextBlock, SignalDetail (+5 more)

### Community 28 - "Margin & Storage Calculators"
Cohesion: 0.11
Nodes (12): get_calculator_service(), get_crop_margin(), get_storage_estimate(), CalculatorService, MarginEstimateResponse, StorageEstimateResponse, test_calculator_service_direct(), test_margin_calculator_known_crop_state() (+4 more)

### Community 29 - "CI Pipeline"
Cohesion: 0.08
Nodes (28): name, runs-on, steps, timeout-minutes, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, name, runs-on (+20 more)

### Community 30 - "Mandi Name Canonicalizer"
Cohesion: 0.15
Nodes (11): Canonicalizer, clean_string(), normalize_lookup_key(), MandiSource, CropScope, TrackedScope, get_mock_scope(), test_canonicalize_commodity_aliases() (+3 more)

### Community 31 - "Data-Layer Plan & Coverage"
Cohesion: 0.12
Nodes (22): Mandi Price History Coverage Report, 50% Coverage Threshold, Markets with <50% Coverage List, All Tracked Crop-Market Pairs at 0% Coverage, Hardcoded Offset 0 Pagination Gap, RLS Deny-by-Default; Backend-Only Supabase Access, Implementation Plan v2 — Mandi Price + Weather Data Layer, Definition of Done (Whole Project) (+14 more)

### Community 32 - "Ingestion Jobs & Resilience Design"
Cohesion: 0.11
Nodes (20): Architecture_Advisory.md, Architecture_Frontend.md, /api/context/market-weather descriptive signals, crop_cost_reference table, Crop margin calculator (DES Cost of Cultivation), DES Comprehensive Scheme for Cost of Cultivation, Architecture — Mandi Price + Weather Data Layer, e-NAM (not usable) (+12 more)

### Community 33 - "Frontend Architecture v1"
Cohesion: 0.13
Nodes (19): Commodity market-pulse grid, Comparison tool pre-filled from saved farm, Crop Margin Calculator, Live dataset-health stats (/api/health/data), Architecture — Frontend Design System & MandiLens-Class Market UI (Architecture_Frontend.md), Update to docs/README.md, Frontend goals G1-G3, Inline glossary for data literacy (+11 more)

### Community 34 - "Location Grid & Stage Recompute"
Cohesion: 0.13
Nodes (15): Grid snapping to 0.1° grid_key, compute_growth_stage(), haversine_distance_km(), snap_to_grid(), GridPoint, main(), _parse_date(), recompute_all_active_stages() (+7 more)

### Community 35 - "Mandi Repository & Snapshots"
Cohesion: 0.12
Nodes (5): get_repo(), filter_market_rows(), MandiRepository, generate_coverage_report(), load_mandilens_snapshot()

### Community 36 - "Data Pruning Jobs"
Cohesion: 0.11
Nodes (12): check_storage_budget(), main(), prune_explore_prices(), prune_forecast_rows(), prune_ingestion_runs(), prune_openweather_rows(), prune_stale_watch(), prune_tier_a_prices() (+4 more)

### Community 37 - "Legacy BFF Proxy Server"
Cohesion: 0.12
Nodes (18): appPromise, Legacy data.gov.in Fetcher (server.ts /api/market), express@^4.21.2, express, buildMarketCacheKey(), createApp(), fetchMarketWithRetry(), filterBackupMarketData() (+10 more)

### Community 38 - "Bhashini Translation"
Cohesion: 0.11
Nodes (11): search_locations(), _bhashini_credentials(), bhashini_translate(), detect_source_language(), is_indic_text(), _pipeline_for(), translate_from_english(), translate_to_english() (+3 more)

### Community 39 - "Frontend Plan v2 Phases"
Cohesion: 0.12
Nodes (22): Commodity market-pulse grid, Crop Margin Calculator, iti-h agri-intelligence suite, Market-level weather, Storage Estimator, WhatsApp share on results, Crop margin calculator UI (/api/market/margin), Frontend definition of done (+14 more)

### Community 40 - "Fix Logs & Revisions"
Cohesion: 0.09
Nodes (23): Mandi market-name cleanup migration (APMC X / X), Frontend Cleanup & Baseline (deletion-only pass), A4 CALENDAR FALLBACK — weather history not backfilled, Decisions D1–D4 (Marketplace, floating chat, crop card, fertilizer), Deletion evidence checklist, Known problems table (W1–G3), Protected features list (Advisor, Weather, Price Trends), R1 Remove legacy weather widget (+15 more)

### Community 41 - "Prune Workflow"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, jobs, prune, name (+15 more)

### Community 42 - "Project Overview & Sources"
Cohesion: 0.11
Nodes (22): Project Overview (.planning), AI-Smart-Agriculture-System, Backend Python Requirements, agmarknet 0.2.2 Dependency, FastAPI Dependency, Supabase Client Dependency, Agmarknet / data.gov.in, DES Cost of Cultivation & WDRA Benchmarks (+14 more)

### Community 43 - "Settings & JWT Config"
Cohesion: 0.10
Nodes (9): get_settings(), Settings, _make_jwt(), test_auth_bypassed_when_secret_unset(), test_auth_cross_user_access_forbidden(), test_auth_expired_token_returns_401(), test_auth_invalid_token_returns_401(), test_auth_missing_header_returns_401() (+1 more)

### Community 44 - "Weather Fusion Config"
Cohesion: 0.09
Nodes (21): abs_mm, bucket_mismatch_is_disagreement, rel, primary_order, future, past_archive, past_recent, today (+13 more)

### Community 45 - "Market Data & Compare Views"
Cohesion: 0.17
Nodes (18): DataFooter(), DataFooterProps, daysAgo(), MandiAutocomplete(), MandiAutocompleteProps, CompareSlot, MandiCompareView(), MandiCompareViewProps (+10 more)

### Community 46 - "Advisory Architecture Engines"
Cohesion: 0.16
Nodes (17): WeatherService.get_summary(), Architecture — Personalized Crop Advisory Layer, Grounded advisory system prompt, AdvisoryContext object, Climate/temperature suitability engine, crop_climate_suitability table, crop_kc_reference table, crop_stage_norms table (+9 more)

### Community 47 - "Tracked Scope & Recon"
Cohesion: 0.11
Nodes (18): crops, aliases, display, key, Lasalgaon, market_aliases, Maharashtra, states (+10 more)

### Community 48 - "Gemini Client & Embeddings"
Cohesion: 0.17
Nodes (9): embed_text(), _extract_text(), generate_text(), l2_normalize(), _thinking_config(), _deterministic_mock_embedding(), get_gemini_embedding(), _load_disk_cache() (+1 more)

### Community 49 - "HTTP Rate Limit Middleware"
Cohesion: 0.12
Nodes (4): client_ip_from_request(), RateLimitMiddleware, reset_rate_limits(), _fresh_rate_limits()

### Community 51 - "Auth & App Context (React)"
Cohesion: 0.15
Nodes (14): App(), AppContext, AppContextType, AppData, AppProvider(), createAppDataFromStorage(), defaultAppData, AuthContext (+6 more)

### Community 52 - "Market Insight UI"
Cohesion: 0.14
Nodes (17): MandiRecentReportsTable(), MandiRecentReportsTableProps, MarketInsightCard(), MarketInsightCardProps, apiCache, CacheEntry, CoverageStats, DateRange (+9 more)

### Community 53 - "Master Spec & Integrity Rules"
Cohesion: 0.15
Nodes (12): MARKET_COVERAGE Guide, Thin Data Threshold (<3 reports), Working Demo Selections (Gorakhpur, Sidhi, Khanna), PROJECT_DETAILS Master Specification, Hybrid RAG (BM25 + pgvector cosine), NASA POWER Agroclimatology, Open-Meteo API, Reciprocal Rank Fusion (k=60) (+4 more)

### Community 54 - "Frontend Plan v1 Phases"
Cohesion: 0.16
Nodes (18): next/og OG image generation, Seven-day price outlook / typical-range, Market comparison tool (2-4 markets), Crop margin calculator UI (/api/market/margin), Frontend definition of done, Implementation Plan — Frontend Design System & Market UI (Implementationplan_Frontend.md), Browse-by-state/Explore search (/api/market/search), Manual steps for Jinay (+10 more)

### Community 55 - "Advisory Query Feedback Loop"
Cohesion: 0.14
Nodes (9): get_query_repo(), format_table_row(), main(), review_feedback(), test_advisory_ask_api_endpoint(), test_advisory_feedback_api_endpoint(), test_assemble_advisory_context(), test_confidence_computation() (+1 more)

### Community 56 - "BM25 Lexical Retrieval"
Cohesion: 0.16
Nodes (5): _cosine_similarity(), BM25Index, reciprocal_rank_fusion(), tokenize(), Hybrid BM25 + dense retrieval with RRF

### Community 57 - "Market Insight Grounding"
Cohesion: 0.17
Nodes (10): _confidence(), _fmt_pct(), format_context_for_prompt(), generate_fallback_market_insight(), generate_market_insight(), audit_number_grounding(), extract_context_numbers(), _walk() (+2 more)

### Community 58 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+10 more)

### Community 59 - "Market API Tests"
Cohesion: 0.19
Nodes (12): _clear_overrides(), _daily_view(), _install(), _row(), test_latest_prices_endpoint(), test_latest_prices_include_flagged(), test_list_markets_endpoint(), test_market_insight_endpoint() (+4 more)

### Community 61 - "Core Data-Layer Schema"
Cohesion: 0.15
Nodes (14): ingestion_runs, locations, locations_grid_idx, mandi_prices, mandi_prices_state_idx, mandi_prices_trend_idx, mandi_watch, mandi_watch_tracked_idx (+6 more)

### Community 62 - "Error Boundary & Dashboard Hooks"
Cohesion: 0.12
Nodes (8): Legacy OpenWeatherMap Usage, react@^19.0.0, react, ErrorBoundary, Props, State, WeatherData, LocationData

### Community 63 - "Mandi Daily Ingestion"
Cohesion: 0.19
Nodes (5): JSONFormatter, setup_logger(), get_watched_pairs(), main(), run_ingestion()

### Community 64 - "Market Search Schemas"
Cohesion: 0.17
Nodes (6): _upsert_watch(), MarketSearchResponse, MarketSearchResult, TestSearchSchemas, TestUpsertWatch, TestWatchedPairs

### Community 65 - "Weather Strip UI"
Cohesion: 0.16
Nodes (13): POPULAR_LOCATIONS, PROVIDER_NAMES, providerName(), WeatherStrip(), WeatherStripProps, WMO_TEXT, AgroMetricsDetail, CurrentWeatherDetail (+5 more)

### Community 67 - "Mandi Ingest Workflow"
Cohesion: 0.12
Nodes (16): DATA_GOV_IN_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, jobs, run, runs-on, steps, timeout-minutes (+8 more)

### Community 68 - "Legacy Prototype Concerns"
Cohesion: 0.14
Nodes (12): Codebase Concerns, Missing Tests Concern, Codebase Integrations, Firebase / Firestore Integration, Google GenAI (@google/genai), JWT & bcryptjs Auth, External Market API Retry & Cache, Onboarding Summary (+4 more)

### Community 69 - "Typography & Tailwind Tokens"
Cohesion: 0.19
Nodes (13): Cormorant Garamond (Reckless substitute), Recommended frontend stack, next/font self-hosting, Noto Sans Devanagari/Gujarati fallback, shadcn/ui primitives, Tailwind CSS v4, CSS Custom Properties (:root), Inter font (+5 more)

### Community 71 - "Dev Guide & Workspace Rules"
Cohesion: 0.15
Nodes (11): AGENTS.md Workspace Rules, CLAUDE.md graphify Rules, LOCAL_DEV_GUIDE, Advisory Rate Limit (20/min, HTTP 429), Farmer Onboarding API (/api/farmer/onboard), 5-Tab Pill Navigation Shell, Farmer Irrigation Log, MandiLens Agmarknet Snapshot (88,852 records) (+3 more)

### Community 72 - "Price Series Utilities"
Cohesion: 0.21
Nodes (6): _change_vs(), generate_date_spine(), is_stale_data(), test_generate_date_spine_continuous(), test_is_stale_data_fresh_vs_stale(), test_is_stale_data_none()

### Community 74 - "Mandi Explore UI"
Cohesion: 0.21
Nodes (12): ALL_CROPS, ALL_STATES, DEEP_CROPS, favKey(), MandiExplore(), MandiExploreProps, MarketCard(), PASTEL_TINTS (+4 more)

### Community 75 - "Grounding & Hallucination Safety"
Cohesion: 0.18
Nodes (9): Advisory confidence (grounded/partial/insufficient), Dosage/chemical-name similarity threshold, Golden question set (20-30 per crop), Safety, grounding & hallucination controls, Post-generation number-grounding check, Advisory Phase 4 — Advisory generation, computed.assumptions listing defaults, R2 Remove Home Crop Suitability card (+1 more)

### Community 76 - "Weather Routing Design"
Cohesion: 0.18
Nodes (10): ERA5-Land reanalysis, locations table, Market-level weather (locations.kind=mandi), Multi-model forecast spread (ecmwf_ifs025, gfs_seamless, icon_seamless), NASA POWER (validator + agro baselines + fallback), Open-Meteo (PRIMARY weather source), Routing by horizon (past-archive, past-recent, today, future), Weather confidence levels (high/medium/low) (+2 more)

### Community 77 - "Market Search LRU Cache"
Cohesion: 0.20
Nodes (3): _enforce_lru_cap(), get_market_search(), TestLRUEviction

### Community 78 - "Bhashini & FAO-56 Notes"
Cohesion: 0.20
Nodes (11): Bhashini multilingual routing (both directions), Deviation: Bhashini access unavailable; Gemini translation abstraction, Branch notes — feature/accuracy-and-bugfix-sweep, Bhashini two-step ULCA flow, FAO-56 Ch.8 daily root-zone water balance, farm_crop_status daily snapshot, Open issue: farmer endpoints have no authentication, Suggested: weather-driven disease risk alerts (Hutton criteria) (+3 more)

### Community 80 - "Advisory Tables & Feedback"
Cohesion: 0.22
Nodes (10): advisory_queries table, farm_crops table, farmer_profile table, farms table, Thumbs up/down feedback loop, Phone number + OTP login, Per-farmer rate limit on /api/advisory/ask, Advisory Phase 1 — Farmer profile & onboarding (+2 more)

### Community 81 - "Weather Fusion Design"
Cohesion: 0.22
Nodes (7): Agro metrics (rain_7d, rain_30d, dry_spell_days, anomalies), config/fusion.yaml (primary order, validators, tolerances, IMD rain buckets), Weather API (/api/weather/current, forecast, history, summary), weather_daily_fused table (served), weather_daily table (raw per source), Weather fusion algorithm (fuse_day), weather_normals_monthly table

### Community 84 - "Market Signal Rules"
Cohesion: 0.22
Nodes (8): rules, condition, evidence_fields, id, name, priority, strength, template

### Community 85 - "Advisory Recon & Disease Plan"
Cohesion: 0.22
Nodes (8): Advisory API contract (/api/advisory/ask, disease-check, feedback, schemes), Disease detection (MobileNetV2 on PlantVillage), PlantVillage dataset, Advisory Phase 0 — Reconnaissance, Advisory Phase 5 — Disease detection, Phase 0 Reconnaissance — Advisory Layer, Anonymous access with district-level defaults, Gemini vision fallback for crops outside PlantVillage

### Community 86 - "RAG & Schemes Design"
Cohesion: 0.25
Nodes (9): gemini-embedding-001 (768-dim), Government scheme section (doc_type=govt_scheme), ICAR Kharif Agro-Advisories, ICAR-KRISHI Research Data Repository, match_rag_chunks RPC, rag_chunks table, rag_documents table, RAG knowledge pipeline (pgvector) (+1 more)

### Community 87 - "Price Trend Chart"
Cohesion: 0.28
Nodes (8): Recharts Chart Library, recharts@^3.8.0, recharts, CustomTooltip(), PriceTrendChart(), PriceTrendChartProps, THIN_DATA_MIN_REPORTS, TrendPoint

### Community 88 - "Calculators UI"
Cohesion: 0.42
Nodes (7): MarketCalculators(), MarketCalculatorsProps, fetchCropMargin(), fetchStorageEstimate(), MarginEstimateResponse, StorageEstimateResponse, fetchWeatherSummary()

### Community 89 - "Market Context Card"
Cohesion: 0.33
Nodes (7): MarketContextCard(), MarketContextCardProps, ContextMarketWeatherResponse, fetchMarketWeatherContext(), PriceContextBlock, SignalDetail, WeatherContextBlock

### Community 90 - "Mandi Pipeline Design"
Cohesion: 0.29
Nodes (7): Name canonicalization via alias maps, Mandi pipeline (canonicalize, validate, reconcile, aggregate), mandi_prices table, Reconcile by source_priority, Quality flags (nonpositive, order_violation, missing_price, outlier), upsert_mandi_prices RPC (priority-aware upsert), v_mandi_daily view (median modal across varieties)

### Community 91 - "Supabase Client & Ref Loader"
Cohesion: 0.36
Nodes (3): _cached_client(), get_supabase_client(), load_advisory_reference_data()

### Community 92 - "Priority Markets Config"
Cohesion: 0.25
Nodes (8): priority_markets, Gujarat, Karnataka, Madhya Pradesh, Maharashtra, Punjab, Rajasthan, Uttar Pradesh

### Community 93 - "Advisory Implementation Plan"
Cohesion: 0.32
Nodes (8): Implementation Plan — Personalized Crop Advisory Layer, Manual PoP extraction of GDD/Kc/soil values, Advisory Phase 2 — Computation engines, Advisory Phase 3 — RAG pipeline, Smart Crop Advisory System — Project Map, Build order and dependency gates, GitHub Actions scheduled jobs, Tech stack (Next.js, FastAPI, Supabase, Gemini, Bhashini)

### Community 94 - "NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, clean, dev, dev:backend, lint, preview, start

### Community 96 - "Advisory Engine Tables"
Cohesion: 0.36
Nodes (7): crop_climate_suitability, crop_kc_reference, crop_soil_suitability, crop_stage_norms, idx_crop_climate_crop, idx_crop_kc_crop, idx_crop_stage_norms_crop

### Community 97 - "Market API & Storage Design"
Cohesion: 0.29
Nodes (7): Attribution and licensing (Agmarknet, CEDA, Open-Meteo, NASA POWER CC BY 4.0), crop_storage_reference table, Frontend integration (PriceTrendChart, PriceContextHeader, WeatherStrip, DataFooter), MandiLens competitor (mandilens.vercel.app), Market API (/api/market/latest, trend, search, margin, storage-estimate), OpenWeatherMap free endpoints (cross-check), Storage estimator (hold-vs-sell)

### Community 98 - "Tier B Coverage & Storage"
Cohesion: 0.38
Nodes (7): data.gov.in Agmarknet daily feed (priority 100), data.gov.in pagination trap and demo-key detector, Mandi Tier B watch list and graduation (LRU cap 300), mandi_watch table (Tier B watch list), Storage budget and retention (prune), Supabase Free tier constraint (500 MB, 7-day idle pause), Tier B — Explore coverage (any crop/market, live pass-through)

### Community 101 - "Legacy Architecture Map"
Cohesion: 0.33
Nodes (4): Codebase Architecture Map, Vercel Serverless API Routing, Codebase Structure Map, Express Proxy + Vite Frontend (Port 3000)

### Community 105 - "Auth Requirements"
Cohesion: 0.40
Nodes (5): Requirements, Gemini AI Recommendations Requirement, JWT Authentication Requirement, PyJWT Dependency, Supabase JWT Farmer Ownership Check

### Community 106 - "Mandi Data Source Catalog"
Cohesion: 0.50
Nodes (4): agmarknet PyPI package 0.2.2 (priority 80), CEDA Agri-Market Data, Ashoka University (priority 50), Kaggle Daily Wholesale Commodity Prices seed (priority 10), Tier A — Advisory coverage (6 crops, pre-ingested, fused weather)

### Community 107 - "SPA Entry & Fonts"
Cohesion: 0.40
Nodes (5): index.html SPA Entry, Indic Multilingual Font Stack (Noto Sans), React Root Mount (/src/main.tsx), Bhashini Indic Translation, Arva Design System

### Community 108 - "Vercel Config"
Cohesion: 0.40
Nodes (4): buildCommand, outputDirectory, rewrites, version

### Community 109 - "Soil Suitability Engine"
Cohesion: 0.50
Nodes (4): crop_soil_suitability table, Soil Health Card aggregate data, Soil-suitability engine, SoilGrids (ISRIC)

### Community 110 - "Price Context Header"
Cohesion: 0.67
Nodes (3): fmtDate(), PriceContextHeader(), PriceContextHeaderProps

### Community 112 - "Tech Stack Map"
Cohesion: 0.67
Nodes (3): Tech Stack Map, React 19 + Vite Frontend Stack, Vercel Deployment (vercel.json)

## Ambiguous Edges - Review These
- `PROJECT_DETAILS Master Specification` → `Missing Tests Concern`  [AMBIGUOUS]
  .planning/codebase/CONCERNS.md · relation: conceptually_related_to

## Knowledge Gaps
- **93 isolated node(s):** `Project Overview (.planning)`, `Planning State`, `Codebase Structure Map`, `Testing State`, `CLAUDE.md graphify Rules` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 835 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WeatherService` connect `Weather Service API` to `Weather Ingestion & Locations`, `Advisory API & Context Assembly`, `Location Grid & Stage Recompute`, `Mandi+Weather Architecture Doc`, `Weather Fusion & Agro Metrics`, `Advisory Architecture Engines`, `Shared Time & Logging Utils`, `Weather Fusion Design`, `Advisory Recon & Disease Plan`, `Market-Weather Context Service`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `Project Overview (.planning)`, `Planning State`, `Codebase Structure Map` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Weather Ingestion & Locations` be split into smaller, more focused modules?**
  _Cohesion score 0.05717852684144819 - nodes in this community are weakly interconnected._
- **Why does `Phase 0 Reconnaissance — Advisory Layer` connect `Advisory Recon & Disease Plan` to `Legacy BFF Proxy Server`, `Settings & JWT Config`, `Weather Service API`, `AI Chat Widget & RAG Client`, `Bhashini & FAO-56 Notes`, `Advisory Architecture Engines`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `Advisory API & Context Assembly` be split into smaller, more focused modules?**
  _Cohesion score 0.05949367088607595 - nodes in this community are weakly interconnected._
- **Why does `today_ist()` connect `Shared Time & Logging Utils` to `Weather Ingestion & Locations`, `Advisory API & Context Assembly`, `Farmer Profiles & Onboarding API`, `Mandi Live Data Sources`, `Mandi Records & Backfill`, `Growth Stage & Irrigation Engines`, `Weather Fusion & Agro Metrics`, `Weather Service API`, `Market Trend API`, `Mandi/Weather Implementation Plan`, `Market-Weather Context Service`, `Data-Layer Plan & Coverage`, `Location Grid & Stage Recompute`, `Mandi Repository & Snapshots`, `Data Pruning Jobs`, `Market API Tests`, `Mandi Daily Ingestion`, `Price Series Utilities`, `Market Search LRU Cache`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `PROJECT_DETAILS Master Specification` and `Missing Tests Concern`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
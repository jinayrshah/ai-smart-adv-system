# Data Integrations Roadmap

Real-world data sources that make the advisor useful beyond a demo. Effort: **S** about a day, **M** about a week, **L** several weeks. Links were found by web search in Nov 2026; confirm each one before building on it.

## Done (Nov 2026)

| Integration | Where | How to run |
|---|---|---|
| IMD district agromet bulletins (Gramin Krishi Mausam Sewa) | `backend/jobs/ingest_imd_agromet.py`, `/api/advisory/agromet-bulletin`, Today panel, advisor context | Scheduled Tue and Fri by `.github/workflows/ingest-agromet.yml`. Manual run: `PYTHONPATH=backend python -m jobs.ingest_imd_agromet --district Rajkot` |
| ISRIC SoilGrids soil estimate | `backend/app/data/soil/soilgrids.py`, `/api/advisory/soil-estimate`, farm setup, crop suitability pH | Called live and cached per point |
| Kisan Call Centre Q&A | `backend/jobs/ingest_kcc.py` (doc type `kcc_qa`, searched by the advisor) | Download a CSV from data.gov.in, then `PYTHONPATH=backend python -m jobs.ingest_kcc --file kcc.csv --state Gujarat` |
| Crop suitability by location | `backend/app/domain/advisory/crop_suitability.py`, `/api/advisory/crop-suitability` | Live in farm setup |

Requires migration `supabase/migrations/20261101000001_rag_agromet_kcc.sql`.

## Phase 2: reach farmers where they are (next 1-2 months)

### 1. WhatsApp advisor with voice (M)
- **Why:** most farmers already use WhatsApp, and voice removes the reading barrier.
- **Build:**
  - Meta WhatsApp Cloud API webhook in FastAPI: `/api/channels/whatsapp`. Verify the request signature.
  - Map the sender's phone number to `app_users.identifier`.
  - Text goes to `/api/advisory/ask`. A photo goes to `/api/advisory/disease-check`.
  - A voice note goes through Bhashini speech-to-text, then the advisor, then Bhashini text-to-speech.
  - Weekly weather and price alerts use approved "utility" message templates.
- **Cost:** replies within the 24-hour customer window are free. Utility templates cost about ₹0.12 each.
- **Needs:** Meta Business verification, a phone number, and a Bhashini key (already in `.env.example`).
- **Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api · https://bhashini.gitbook.io/bhashini-apis/

### 2. IMD district weather warnings as push alerts (S-M)
- **Why:** official hail, heavy rain and heatwave warnings, 24-72 hours ahead.
- **Build:**
  - Poll `mausam.imd.gov.in/api/warnings_district_api.php?id=<district id>` every 3 hours.
  - Store new warnings and alert farms in that district (WhatsApp, or a banner on Today).
- **Needs:** IMD must whitelist the server's static IP. Apply early, since approval takes time.

### 3. Sentinel-2 field health (NDVI) alerts (M)
- **Why:** spots stress before the farmer does ("check the north side of your field").
- **Build:**
  - The farmer draws the field boundary. Store it as a PostGIS polygon in `farms`.
  - Weekly job: Copernicus Data Space Statistical API → mean NDVI per field → `field_ndvi` table.
  - Alert when NDVI falls more than 15% against the field's own trend.
  - Use Sentinel-1 radar when monsoon clouds block the optical image.
- **Cost:** free tier, about 10,000 processing units per month, enough for thousands of fields a week.
- **Docs:** https://dataspace.copernicus.eu · https://documentation.dataspace.copernicus.eu/Quotas.html

## Phase 3: water and selling decisions (2-4 months)

### 4. Groundwater, reservoirs and block water stress (M)
- **Data:**
  - India-WRIS REST API: CGWB well levels, reservoir storage, soil moisture.
  - CGWB block categories (Safe / Semi-critical / Critical / Over-exploited).
- **Use:**
  - Water card on Today.
  - Feed the crop-suitability check, e.g. mark rice "not recommended" in over-exploited blocks without drip.
  - Irrigation advice.
- **Links:** https://indiawris.gov.in · https://cgwb.gov.in/ground-water-resource-assessment-0 · Python client https://github.com/DrJagadeeshG/india-water-data

### 5. eNAM prices beside Agmarknet, and FPO directory (M)
- **eNAM:** dashboard data only, no public API. Scrape the live-price feed politely, or request access via SFAC or API Setu. Show "best nearby mandi after transport cost".
- **FPOs:** parse SFAC's state lists once into an `fpos` table and show "FPOs in your district".
- **Links:** https://enam.gov.in/web/dashboard/live_price · https://sfacindia.com/FPOS.aspx

### 6. Soil Health Card photo to values (S-M)
- **Build:** the farmer photographs the card, OCR plus an LLM extracts N, P, K, pH, EC, OC and micronutrients, and the farmer confirms the values before saving.
- **Effect:** the card then overrides the SoilGrids estimate everywhere.

## Phase 4: better models and coverage (3-6 months)

| # | Item | Effort | Notes |
|---|---|---|---|
| 7 | Train the MobileNetV2 disease model on PlantVillage plus Indian field images | L | `training/train_disease_model.py` exists. Add field datasets: 15 Crop 45 Disease (https://data.mendeley.com/datasets/8fr7grr73p/1) and SoyNet. Until then, photo checks use labelled AI vision. |
| 8 | More crops (pulses, groundnut, onion, sugarcane...) | M per crop | Each needs stages, Kc, soil, climate, seasons and water need in `crop_catalog.json`, with sources. |
| 9 | District yield benchmarks | S | DES crop production (data.gov.in) and the ICRISAT District Level Database: "the district average for soybean is X t/ha". |
| 10 | PMFBY and PM-KISAN deadline reminders | S | Scheme calendar plus alerts; deep-link to the official calculators. No public APIs. |
| 11 | Missed-call voice line for feature phones | M | Exotel or Plivo IVR with Bhashini TTS for the weekly advisory. TRAI DLT registration needed for SMS. |
| 12 | AgriStack village crop-sown data | L | Needs partner onboarding: https://ufsi.agristack.gov.in/apispecs |

## Sources with no public API (request access)
- **No public API, request through API Setu (https://apisetu.gov.in) or the owning ministry:**
  - Soil Health Card
  - PMFBY
  - myScheme
  - eNAM
  - NPSS (National Pest Surveillance System)
- **May open data access later:** IMD's KALP and SANKALP platforms (Jan 2026).

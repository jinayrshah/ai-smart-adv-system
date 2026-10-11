# Branch notes — `feature/accuracy-and-bugfix-sweep`

Base: `dev` @ `637cfc2`. Nine commits, one theme per commit. Backend suite: **155 passed**
offline (was 121 passed / 7 failed on `dev`).

## Before merging

1. **Run the new migrations** (in order):
   - `20261010000000_rag_hybrid_search.sql` — FTS column + `search_rag_chunks_fts` RPC
   - `20261011000000_irrigation_events.sql` — irrigation log (RLS: owner only)
   - `20261011000001_farm_crop_status.sql` — daily stage / water snapshot
   - `20261011000002_mandi_market_name_cleanup.sql` — merges "APMC X" / "X" duplicates
     (**destructive**: deletes the lower-priority row of each duplicate pair; take a backup first)
2. **Set env vars** (see `.env.example`): `JWT_SECRET` (the Express server now refuses to
   start in production without it), `BHASHINI_USER_ID` / `BHASHINI_API_KEY` for translated
   answers, optional `FASTAPI_URL`, `GEMINI_MODEL`, `CORS_ALLOW_ORIGINS`.
3. `npm ci && npx tsc --noEmit && npm run build` — the sandbox this was written in had no
   npm registry access, so the frontend was checked with esbuild (syntax) and a shimmed
   `tsc` (our own types/props), not a full build.

## What changed

### Accuracy
| Area | Before | After |
|---|---|---|
| Irrigation | 7-day ETc − rain; assumed ET0 = 3.5 mm/day when data was missing | FAO-56 Ch. 8 daily root-zone balance from sowing (TAW by soil texture, Zr growth, p adjusted for ETc, Ks, rain < 0.2·ET0 ignored), logged irrigation added back, forecast rain (≥ 60 % prob.) can defer; action + net/gross depth; `insufficient_data` instead of invented ET0 |
| Growth stage | Observed days only; calendar fallback showed a made-up GDD | Upper cut-off (maize 10/30 °C), missing days imputed at ≥ 80 % coverage, progress %, no fake GDD; season weather backfilled from sowing so GDD is actually used |
| Advice context | Unknown crop silently became Wheat; Nashik / 25 °C / 35-day-old sowing assumed silently | 422 for unsupported crops; every default listed in `computed.assumptions` and shown in the chat |
| Market changes | "7d" = vs 4th-last report, "30d" = vs first report (two reports → "+7% / +7%") | vs a real report ~7 / ~30 days earlier; suppressed below 3 reports; table instead of chart |
| Duplicate mandis | "APMC Malegaon" and "Malegaon" as separate cards and series | alias-tolerant queries, merged per day, one card per market, DB cleanup migration |
| Market insight | Express route answered with its own ungrounded Gemini call; prompt said "normal rainfall, no transport disruption" with no data | FastAPI insight reached via the proxy; only real figures; number-audited, deterministic fallback |
| Disease | No model in repo → diagnosis guessed from colour ratios; blank photo → "healthy"; model would get double-preprocessed input | `unavailable` / `rejected` statuses, raw pixels, class list from training, crop-restricted, temperature-calibrated; improved training recipe with test + field metrics |
| RAG | (earlier commit) hybrid BM25 + dense with RRF, real titles, no placeholder vectors | — |
| Translation | Bhashini call skipped the pipeline-config step (always failed); Gemini asked to answer in Hindi *and* the answer then "translated" again | Documented two-step ULCA flow; Gemini always answers in English, Bhashini translates |

### Bugs fixed elsewhere
- Advisor tab crashed for users who had not onboarded; farm card showed "My Farm • Selected
  Crop" / "Sown: Current Season" (wrong field names); chat never sent the crop.
- Disease photo uploads could not pass the Express proxy (multipart rebuilt as JSON).
- All users shared one FastAPI rate-limit bucket (client IP not forwarded); anonymous
  advisory users shared one bucket.
- `/diagnostic` 404'd on in-memory farms (`farm_id` typed `str`); `/stage` passed a grid
  object as the grid key; `/climate` invented 25 °C; dates used UTC instead of IST.
- Daily recompute job crashed on calendar-fallback crops, ignored `--dry-run`, never
  saved anything and was not scheduled (now writes `farm_crop_status`, runs 09:00 IST).
- Generator crashed when no current-weather row existed.
- Soil dropdown saved only the first word ("Sandy" for Sandy Loam).
- Missing i18n keys `profile.settings`, `auth.error` (raw key on the Profile page).
- Auth: hard-coded fallback JWT secret, `Math.random` OTPs, OTPs logged in production,
  un-rate-limited OTP confirm / deprecated OTP routes.
- Market API tests needed a live database (CI always failed them); now use an in-memory fake.

### New features
- Irrigation log (`POST/GET /api/farmer/farms/{id}/irrigation`) + "Log irrigation" in the farm card.
- Marathi and Gujarati UI dictionaries (machine-drafted, **need native-speaker review**),
  Noto Sans fonts for Devanagari / Gujarati / Kannada / Telugu, onboarding language sets the UI.
- Explorer cards open the market in the trend view; real favourites; live calculators
  prefilled from the saved farm size.

## Open decisions for Jinay
- **Personal data in git:** `users.json` (phone numbers + password hashes), `products.json`,
  `history.json` are committed and rewritten at runtime. Recommend `git rm --cached` + `.gitignore`
  (note: that deletes them from collaborators' working copies on pull — back up first).
- **Farmer endpoints have no authentication** — any caller can read/modify any farm by id.
  Needs Supabase JWT verification in FastAPI (larger change, not done here).
- **Disease tab** still uses client-side Gemini vision (ungrounded). Switch it to
  `/api/advisory/disease-check` once a model is trained with the new script.
- Marathi/Gujarati strings need a native check (README §8).

## Suggested next steps (not built)
- Weather-driven disease risk alerts (e.g. Hutton criteria for tomato late blight) — needs
  hourly RH ingestion from Open-Meteo.
- Contextual chunk headers (title + crop) for BM25/embeddings — re-tune the 0.60/0.65
  confidence thresholds on the golden questions afterwards.
- Soil-moisture sensor readings (IoT track) can replace the "field capacity at sowing"
  assumption in the water balance via `reading_source = "iot_live"`.

# Frontend Cleanup & Baseline — run this BEFORE the frontend redesign

**Project:** Smart Crop Advisory System (UI brand: "Smart Agriculture") · **Stack:** Next.js + FastAPI + Supabase
**Put in the repo at:** `docs/frontend/Cleanup_Frontend_Baseline.md`
**Source of this document:** a page-by-page review of 27 screenshots of the running app (Oct 2026), taken after the market/weather and advisory phases were built, with the user's own notes on which pages are new and which are legacy.

---

## 0. What this pass is, in one paragraph

The app currently mixes two generations of UI: **new** work built from the planning docs (Advisor, the new Weather UI, Price Trends) and **legacy** work from before them (Home, Fertilizer, Disease, Market/Marketplace, Learn, History, Profile, the floating chat widget). One legacy weather widget was also left running underneath the new Weather page. A full frontend redesign is coming (`Architecture_Frontend.md`). Before it starts, this pass removes what is provably **dead, duplicate, or superseded** so the redesign begins from a clean, verified baseline — **without touching anything built since the planning docs began.**

**This pass is deletion-only.** No restyling. No new features. No bug fixes in protected pages (those are separate PRs, §8). The only edits besides deletions are the minimal rewires needed to keep the app running after a deletion.

---

## 1. Rules (read first, no exceptions)

1. **Frontend only.** Never edit or delete backend code (FastAPI app, jobs), Supabase migrations/schema, GitHub workflows, `config/*.yaml`, or any `.env*` file. If you find dead backend code, **report it** in the cleanup report — do not delete it.
2. **Snapshot before anything else:** on `dev`, `git tag pre-cleanup-baseline`. Work on a branch `feature/frontend-cleanup`. One PR into `dev`. Never push to `main`, never force-push, never rewrite history.
3. **Nothing is deleted on a hunch.** Every removal follows the evidence checklist in §5.
4. **One commit per removal item** (R1, R2, …) so any single removal can be reverted alone with `git revert`.
5. **If a removal breaks the build, type-check, or any smoke-test item (§6): revert that commit, record it in the report, move on.** Never "fix forward" by editing protected code.
6. **When unsure whether something is protected, treat it as protected and ask.**
7. **Do not rename routes, API paths, or env vars.** The only string changes allowed are the UI label in decision D1 (§4).
8. **Do not install or add dependencies.** Analysis tools run via `npx` and are not added to `package.json`.
9. **The repo wins for facts (file paths, component names); this file wins for policy (what is protected).** If they conflict, stop and report.
10. **Do NOT use `FILE_STRUCTURE.docx` or `architecture.pdf` if you see them anywhere.** They describe a different (Node/Express/Mongo) project and are not this repo's layout.

---

## 2. Page-by-page inventory (from the screenshots)

| Page / area | Generation | What's on it | Verdict |
|---|---|---|---|
| **Home** | Legacy | Greeting hero, "AI Command Center → Crop Suitability" card, Temperature/Humidity tiles (shows "LOCATION DENIED" yet displays Nashik), 4 quick-action cards, Recent Activities | KEEP-LEGACY, minus R2 |
| **Advisor** | **New** | 4-step "Personalized Crop Advisory Setup" modal; farm card; growth stage (GDD), water balance (ETc), soil status, thermal match; grounded chat; government schemes panel | **PROTECT** |
| **Fertilizer** | Legacy | Standalone form (crop, soil, location, N/P/K) → DAP recommendation | KEEP-LEGACY (D4) |
| **Disease** | Legacy | Upload leaf photo → currently returns "Failed to detect plant disease" | KEEP-LEGACY (do not fix here) |
| **Market** | Legacy | "Farmer Marketplace" (Browse / My Listings / Sell, product cards) — **not** the mandi-price feature | KEEP-LEGACY (D1) |
| **Weather** | **New** + legacy duplicate | New "Weather Intelligence & Agro Climatology" UI; **below it**, an old widget (city dropdown, "Use My Current Location", fallback card, "5-Day Forecast") | **PROTECT** new, **REMOVE** old (R1) |
| **Price Trends** | **New** | Crop/State/Market bar, price headline, trend chart, context layer, margin + storage calculators, mandi logistics weather, staleness banner, "Mandi Explorer" | **PROTECT** |
| **Learn** | Legacy | "Learning Center", 10 articles, search, category chips | KEEP-LEGACY |
| **History** | Legacy | "Your History" modal: ALL / DISEASE / SOIL / FERTILIZER tabs | KEEP-LEGACY, minus R4 check |
| **Profile** | Legacy | Name, location, farm type, password change | KEEP-LEGACY |
| **Floating chat** ("Farmer Assistant") | Legacy | Bottom-right chat bubble on every page | KEEP-LEGACY (D2) |
| **Header, bottom nav, language switcher** | Legacy shell | Shared by every page | KEEP (shared) |

"KEEP-LEGACY" = leave working and untouched; the redesign replaces these page by page. Do not polish them in this pass.

---

## 3. PROTECTED — do not delete, rename, restyle, or "tidy"

Find these by the visible strings below (grep the repo for them) and map each to its files in Step 0.

**Advisor (new)**
- Modal strings: `PERSONALIZED CROP ADVISORY SETUP`, `Step 1: Farmer Profile & Language`, `Step 2: Farm Location & Coordinates` (incl. `Weather Grid Snap`), `Step 3: Soil & Irrigation Details` (incl. `I have a Soil Health Card`), `Step 4: Active Crop & Sowing Date`, `Finish Onboarding & Personalize`, `Skip / Continue Anonymously`
- The six crop options: **Wheat, Tomato, Cotton, Soybean, Rice, Maize** (the deep-advisory crops — this is the answer to the project's "which 6 crops" question)
- `Precision Farm Profile Active`, `Edit Farm`, `Physiological Stage & Precision Agronomy`, `CALENDAR FALLBACK`, `CURRENT GROWTH STAGE`, `WATER BALANCE & ETC`, `SOIL & NUTRIENT STATUS`, `THERMAL & CLIMATE MATCH`
- `Personalized Agronomic Advisor`, `SUGGESTED AGRONOMIC QUESTIONS`
- `National Agricultural Welfare Schemes`, `Ask Scheme Specific Question (Grounded RAG)`

**Weather (new)**
- `Weather Intelligence & Agro Climatology`, `CURRENT OBSERVATION`, `AGRO-CLIMATOLOGY METRICS`, `MULTI-SOURCE FUSED DAILY HORIZON`, `Detailed Inspection`, `Area Estimate Notice`, `Explore any village/district…`, `Preset Tracked Mandis…`, all confidence badges

**Price Trends (new)**
- `Price Trend & Fluctuation` + 7d/30d/90d/180d toggle, `Context Layer: Market Arrivals & Local Weather`, `Decision Calculators & Mandi Logistics` (`Crop Margin Calculator`, `Storage Estimator`), `Mandi Logistics & Arrival Weather`, `Showing last available data`, the "Last fetched / Sources" footer and Agmarknet attribution line, `Mandi Explorer`

**Everything shared or underneath**
- All backend and data-layer code, migrations, jobs, workflows, config, env files
- Auth/session handling, the API client layer, i18n setup (language switcher + dictionaries), the global layout shell
- **Any API client function, hook, or type used by anything above — even if it looks unused from where you're standing**

---

## 4. Decisions (defaults apply; Jinay can change a default before sending this file)

| ID | Item | Default | Alternative | Why it's a decision |
|---|---|---|---|---|
| D1 | "Market" tab = Farmer Marketplace (listings/selling) | **KEEP untouched.** Change only the nav *label* to "Marketplace" so it stops colliding with "Price Trends" | Remove the whole feature | It isn't one of the four core features and its demo listings show Karnataka sellers with a phone number. But it works, so removal is the owner's call, not ours |
| D2 | Floating "Farmer Assistant" chat | **KEEP untouched; do not extend** | Retire it, or point it at the grounded advisory endpoint (redesign) | It overlaps the Advisor's grounded chat and, from the UI, shows no sources |
| D3 | Home → "Crop Suitability" card | **REMOVE the card (R2)** | Keep until redesign | Unsourced claim shown to everyone |
| D4 | Fertilizer page | **KEEP untouched** | Merge into Advisor / remove (redesign) | It's the only standalone fertilizer feature right now |

---

## 5. Approved removals

### R1 — Legacy weather widget on the Weather page (duplicate)
**Evidence:** it renders below the new weather UI and conflicts with it: city dropdown reads "Bangalore" while the card shows "nashik" or "mumbai"; card shows `Clear Sky (Fallback)` with 25°C / 5 km/h / 60% / UV Moderate (placeholder-looking values); an "AI Agricultural Insight" box saying `Weather data currently unavailable. Showing seasonal averages.`; an empty `5-Day Forecast` heading.
**Signature strings to grep:** `Use My Current Location`, `Clear Sky (Fallback)`, `AI Agricultural Insight`, `5-Day Forecast`, `Showing seasonal averages`, `Weather data currently unavailable`.
**Remove:** the component, its mount point on the Weather page, and its frontend-only helpers/data (hard-coded city list, fallback weather values), plus any frontend API client function used *only* by it.
**Hidden-consumer check (important):** the Home page shows Temperature/Humidity tiles for Nashik and may call the same legacy weather service. Before deleting any shared client/hook/service, grep every consumer. **If Home (or anything else) uses it: do not delete the shared piece.** Remove only the widget. If repointing Home to the new weather endpoint (`/api/weather/…`) is a trivial, frontend-only change, you may do it in the same commit and say so in the report; otherwise leave it and report.
**Do not touch:** the OpenWeather adapter in the backend data layer — OpenWeather is still a validator in the new fusion pipeline. A legacy *backend* weather route that nothing calls any more: **report only.**
**Done when:** the Weather page shows exactly one weather UI from top to bottom.

### R2 — Home: "AI Command Center → Crop Suitability" card
**Evidence:** it says *"Rice or Maize are ideal now. The moderate temperature (23°C) and good moisture levels are perfect for their growth."* — no source, no farm context, and "good moisture levels" has no data behind it. It also appears while the page says `LOCATION DENIED`. This breaks the project's rule: no source, no claim.
**Remove:** the card in the Home UI only. Leave any backend route it calls (report it). Leave the "Live Analysis" label's neighbours (Temperature/Humidity tiles, quick-action cards) untouched.

### R3 — Dead-code sweep (after R1 and R2)
Run, **report first, delete second:**
- `npx knip` (unused files, exports, dependencies) and ESLint's unused-vars/imports rules.
- Delete only items with **zero** references that are **not** on the protected list and not framework-convention files (Next.js route files, `layout`, `loading`, `error`, `middleware`, config files — these look "unused" to tools but aren't).
- Do **not** run any auto-fix mode. Review each item by hand.
- Do **not** remove dependencies; list unused ones in the report for Jinay.
- Translation keys: remove only keys used exclusively by components you deleted, and only after grepping. When in doubt, leave them (unused keys are harmless).

### R4 — History: orphan "SOIL" filter tab (verify first)
No Soil page exists in the nav. **Check whether any code path writes a `soil` history entry.** If none does, remove the tab. If something does (or old records exist that the tab displays), leave it and report.

### R5 — Fake or placeholder data in the frontend
This project forbids fake data. Grep the frontend for `Fallback`, `mock`, `dummy`, `placeholder data`, `seasonal averages`, `lorem`. **Report every hit.** Delete only hits that belong to code removed in R1–R4. Everything else: report, do not touch.

---

## 6. Procedure

**Step 0 — Read-only recon (no edits).**
1. Tag the baseline (§1.2). Run build, type-check, lint; record results. **Errors that already exist are not yours to fix** — list them.
2. Write `docs/frontend/cleanup_inventory.md`: route → page component → files; each component's importers; each API client function → which pages call it; env vars the frontend reads; the exact files behind every protected string in §3.
3. For R1–R5, list the files you propose to delete and the evidence from the §5 checklist.
4. **STOP.** Show Jinay the inventory and the proposed deletion list. Wait for "go".

**Evidence checklist — required for every deletion:**
1. What exactly is it (paths, exports, route)?
2. Who imports or calls it? (grep symbol names, signature strings, route/API paths)
3. Is any consumer protected or on a KEEP-LEGACY page? If yes → don't delete; repoint only if trivial and frontend-only, else leave and report.
4. Delete in its own commit.
5. Rebuild, type-check, lint, run the smoke test (§7); compare with the Step 0 baseline.

**Steps 1–5:** R1, R2, R3, R4, R5 in that order, one commit each.

**Step 6 — Report.** Write `docs/frontend/cleanup_report.md`: per removal (what, files deleted, consumers checked, verification result); items skipped and why; backend dead code found (report only); pre-existing build/lint errors; any new problems you noticed.

---

## 7. Smoke test — run after every commit

| # | Check | Pass condition |
|---|---|---|
| 1 | Home | Loads, no console errors, tiles render, no Crop Suitability card (after R2) |
| 2 | Advisor onboarding | Modal opens; steps 1–4 complete; farm card + four engine cards render |
| 3 | Advisor chat + schemes | Suggested questions send; scheme panel opens |
| 4 | Weather | Exactly one weather UI; fused daily horizon + detailed inspection render |
| 5 | Price Trends | Wheat / Maharashtra / Malegaon loads; chart, context layer, both calculators compute; Mandi Explorer lists markets |
| 6 | Fertilizer | Submitting the form returns a recommendation |
| 7 | Disease | Page loads. (The "Failed to detect plant disease" error is **pre-existing** — not a regression) |
| 8 | Marketplace | Browse loads |
| 9 | Learn, History, Profile | Each loads; History modal opens |
| 10 | Floating chat | Opens and sends a message |
| 11 | Language switch | EN → HI works on Advisor onboarding |
| 12 | Build / type-check / lint | No new errors vs. baseline |

---

## 8. Known problems — NOT part of this pass

Spotted in the screenshots. Do not fix here; they belong to the next PRs. Order of work overall: **PR-1 this cleanup → PR-2 bug fixes (`Revisions_MarketWeather.md` + the "bugfix" rows below) → PR-3+ redesign (`Implementationplan_Frontend.md`).** `Revisions_MarketWeather.md` §1.1 (remove the duplicate weather widget) is done by R1 — skip it there.

| ID | Where | Problem | Goes to |
|---|---|---|---|
| W1 | Weather | Overlapping badges and labels: "Medium Confidence" over the AGRO-CLIMATOLOGY header; "Humidity / Wind / 1h Rain" collide; "Baseline" over "N/A" | Bugfix PR (`Revisions` §1.2) |
| W2 | Weather | "Area Estimate Notice" renders in a ~60px column, wrapping word by word, with the "Sources:" line floating far right | Bugfix PR |
| W3 | Weather | Dense, jargon-heavy ("Phase: Today", "Validators Cross-checked: None…") | `Revisions` §4 / redesign |
| A1 | Advisor | Farm card header shows literal placeholders **"My Farm • Selected Crop"** and **"Sown: Current Season"** instead of "Tomato" and "2026-08-27" | Bugfix PR |
| A2 | Advisor | Schemes panel: Eligibility / How-to-Apply columns ~110px wide, wrapping word by word; scheme names truncated ("Pradhan Mantri…"); the "Ask scheme question" input is clipped by the bottom nav | Bugfix PR / redesign |
| A3 | Advisor | Onboarding name ("jinay") differs from the account name ("xyd"); phone is collected but no verification step is visible | Report to Jinay |
| A4 | Advisor (data) | **"CALENDAR FALLBACK"**: growth stage can't use GDD because weather history since sowing (27 Aug) isn't stored for this grid | Backend: backfill weather history from sowing date when a farm is created |
| P1 | Price Trends | Market field is still styled like a plain text input (Crop and State show dropdown chevrons) — the searchable-picker fix is **not confirmed** | `Revisions` §2.1 (verify) |
| P2 | Price Trends (data) | Duplicate markets under different spellings: "APMC Malegaon" + "Malegaon", "Shahada" + "APMC Shahada" (same price, same date) | Backend name canonicalization |
| P3 | Price Trends | "+7% (7d)" and "+7% (30d)" computed from only 2 reports; chart shows 2 isolated dots | `Revisions` §2.7 |
| P4 | Price Trends (data) | Footer shows only `data.gov.in (Daily Live): 2` — no backfilled history for Wheat/Malegaon, although Wheat is a deep-advisory crop | Backend: run/verify backfill |
| P5 | Price Trends | Calculators default to 2 acres; the saved farm says 3.0 | `Revisions` §2.7 |
| P6 | Price Trends | Two overlapping selectors (top bar and "Mandi Explorer") on one page | `Revisions` §2.7 |
| H1 | Home | "LOCATION DENIED" yet shows Nashik data; "Marketing" label vs. "Market" nav | Redesign |
| F1 | Fertilizer | Crop is free text; N/P/K have no units (Advisor uses kg/ha); soil list ("Black") differs from the Advisor's ("Black Cotton"); dose has no cited source; asks for data the farm profile already holds; two redundant buttons | Redesign (D4) |
| DS1 | Disease | Generic "Failed to detect plant disease" with no cause or retry; no crop selection; the model rebuild (Advisory Phase 5) isn't done | Advisory Phase 5 |
| PR1 | Profile | Page title shows the raw translation key **`profile.settings`**; legacy fields (city, farm type) duplicate the new farm profile — two sources of truth | Bugfix + redesign |
| HI1 | History | Raw developer keys shown to users (`cropType`, `soilType`, `n`, `p`, `k`); no advisor/price/weather entries; "Clear History" is a large red button (confirmation unknown) | Redesign |
| L1 | Learn | Category chips cut off ("AI Farmin…"); a stray empty scrollbar track under the chips; static, unsourced articles | Redesign |
| G1 | Global | Every page uses a different content width (Home ~430px, Profile ~325px, Weather ~370px, Fertilizer ~800px, Price Trends ~840px+); a 10-item bottom tab bar (labels wrap) on a desktop viewport | Redesign (Phase 1 shell) |
| G2 | Global | Two chat experiences (floating vs. Advisor) with different grounding | Redesign (D2) |
| G3 | Privacy | Marketplace demo listings show a phone number (+91 6363005110). If real, replace with a dummy before any public demo | Jinay |

---

## 9. Definition of done

- [ ] Weather page shows exactly one weather UI; the legacy widget and its frontend-only helpers are gone.
- [ ] Home no longer shows the unsourced Crop Suitability claim.
- [ ] `knip` / ESLint findings are reported; only provably unreferenced, non-protected items were deleted.
- [ ] Every smoke-test item (§7) passes, or any failure is documented as pre-existing.
- [ ] `git diff pre-cleanup-baseline` touches **no** backend, migration, workflow, config, or env files.
- [ ] The PR diff contains no changes to any protected feature in §3.
- [ ] `cleanup_inventory.md` and `cleanup_report.md` exist and match what was actually done.

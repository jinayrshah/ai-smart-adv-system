# Revisions — Market & Weather UI (Round 1, post-Phase-5 QA)

**Companion files:** `Architecture_MarketData_Weather.md`, `Implementationplan_MarketData_Weather.md`, `Architecture_Frontend.md` — this file doesn't replace them, it's a punch list against what's already built. Where a fix needs a design decision not covered here, the architecture file's own rules win.

**Context for Antigravity:** phases 0 through 4B are built and functioning — the price trend chart, multi-source weather fusion, the context layer, the margin/storage calculators, and market-level weather are all confirmed working correctly by hand-checking the displayed numbers against the spec. This round is bug fixes and UX gaps found by actually using it, not a redesign.

**Scope rule (same as `Architecture_Frontend.md` §0):** items 1-2 and 5 below are frontend-only — don't touch backend/data logic to fix them. Items 3 and 4 need small, scoped backend additions, called out explicitly where that's true. If a fix seems to need touching anything outside what's named in a given item, stop and ask rather than improvising.

---

## Priority 1 — Bugs (fix first, before anything else in this file)

### 1.1 Duplicate legacy weather widget still present
> **If `Cleanup_Frontend_Baseline.md` has been run first, this item is already done (its R1). Skip to 1.2.** Run the cleanup file before this one.

A second, older weather card (location dropdown + "Use My Current Location" + a simple current-conditions card + a generic "AI Agricultural Insight" box + "5-Day Forecast" header) renders on the same page, below the new multi-source weather UI. This is leftover from before the Phase 3 weather rebuild and should have been removed, not left running alongside the replacement.

- [ ] Find and delete this component and its route/section entirely — confirm by searching the codebase for its container text, e.g. `"AI Agricultural Insight"` and `"Use My Current Location"`, to make sure every instance is removed, not just the one that's visible.
- [ ] Confirm nothing else in the app still imports or links to it before deleting.
- [ ] **Acceptance:** the weather page shows exactly one weather UI, start to finish, no second card appears on scroll.

### 1.2 Text overlap / layout collisions
Two confirmed instances on the weather page:
- The "Medium Confidence" badge overlaps the "AGRO-CLIMATOLOGY" section header.
- In the "Vs. Normal (30d)" metric card, the word "Baseline" overlaps "N/A".

- [ ] Fix the positioning/z-index or flex/grid layout causing both — likely the same root cause (a badge positioned absolutely without accounting for the header's actual width, or a card not sized for its content at some screen width).
- [ ] Check all confidence badges and metric cards across the weather page at a few viewport widths (including mobile) for the same pattern — if it's one component used in multiple places, fix it once at the source, not per-instance.
- [ ] **Acceptance:** no overlapping text anywhere on the weather page at mobile, tablet, and desktop widths.

---

## Priority 2 — Missing pieces

### 2.1 Market (mandi) selector — free text to real selection

Right now Market is a plain text field requiring an exact, correctly-spelled match the user has no way to know in advance. Crop and State are already working dropdowns — Market needs to reach the same bar.

**Build a searchable market picker**, not a free-text field:
- [ ] As the user types, query the existing `/api/market/search` endpoint (already built, `Architecture_MarketData_Weather.md` §10.1) scoped to the selected state, and show matching market names as selectable suggestions — standard autocomplete, no new backend endpoint needed, this one already exists.
- [ ] Once a state is selected, the market field should never require the user to already know a name — either autocomplete-as-you-type (above) or a full dropdown of markets with reported data for that state.
- [ ] **Acceptance:** a user who has never seen a mandi name before can find and select a valid one without leaving the page or guessing spelling.

**Now specced in detail, having actually seen MandiLens's `/markets` page (not just inferred from metadata as in the last round) — build a proper browsable index, not just an autocomplete field:**
- [ ] A `/markets`-equivalent page: every tracked + graduated-Explore-tier market/crop pair in one filterable list, so discovery happens *before* the user commits to a specific trend page.
- [ ] Filters: state, district, commodity, market, variety, and — reusing fields this project already computes — data freshness and reporting consistency. These aren't new data, they're `mandi_prices.fetched_at` and the existing coverage calculation already shown on the trend page, just exposed as filter controls here too.
- [ ] Each row: a small sparkline of recent prices, latest price range (min-max), report date, and a freshness badge ("Fresh · 0 days" style — the existing freshness concept, just restyled as a compact badge for a list view instead of the fuller card on the detail page).
- [ ] Grid/list view toggle and sort-by-newest are nice-to-have polish, not required for v1 — skip if time-constrained, the filtering and discovery are what actually matter.
- [ ] **Acceptance:** a user who has never seen a mandi name before can browse to one by state/district/commodity without typing anything, then land on its existing trend page.

### 2.2 Price unit conversions

Currently shows ₹/Quintal only.

- [ ] Add ₹/kg alongside every price figure shown to the farmer (1 quintal = 100 kg — simple division, no new data needed) — latest price, trend chart tooltip, margin calculator, storage calculator.
- [ ] Optional, lower priority: ₹/tonne (1 tonne = 10 quintals) if it's easy to add alongside the above — skip if it adds real effort for little benefit.
- [ ] **Acceptance:** every price figure a farmer sees has a kg-equivalent visible or available on demand (toggle, or shown alongside — either is fine), not quintal-only.

### 2.3 AI-generated market insight (Gemini)

Not present anywhere currently — the only "AI Insight" text found was a generic fallback string in the legacy widget being removed in 1.1, not a real generated insight. Build a real one, with the same grounding discipline already established for the advisory chat (`Architecture_Advisory.md` §17): **it may only phrase numbers that are already computed and displayed on the page — it must never introduce a new fact, number, or prediction.**

```python
# app/data/mandi/insight.py (or wherever market-layer services live)
def generate_market_insight(context: dict) -> str:
    """
    context = exactly what's already rendered on the page for this crop/market:
    latest price, 7d/30d % change, coverage %, margin calc result (if run),
    storage calc result (if run), weather signals from the context layer,
    confidence levels. Nothing here should be a number the farmer can't
    already see elsewhere on the same page.
    """
    prompt = f"""Summarize the following market information for a farmer in 2-3 short,
plain sentences. Use ONLY the figures given below. Do not add any number, fact, or
prediction that is not explicitly present in this data. Do not forecast future prices.

DATA:
{format_context_for_prompt(context)}
"""
    return gemini_generate(prompt)  # gemini-2.5-flash, same key already in the env file
```

- [ ] New endpoint, e.g. `GET /api/market/insight?commodity=&market=&state=` — assembles the same context object already used for the context layer (`Architecture_MarketData_Weather.md` §10.4) and the calculators, and returns the generated text alongside a `confidence` value inherited from the underlying data (don't invent a new confidence scale for this — reuse what the context layer already computes).
- [ ] Frontend: render this **below the raw numbers it's summarizing**, not above or instead of them — clearly labeled (e.g. "AI Summary" or similar, styled distinctly/lower-key per `Architecture_Frontend.md`'s token system) so it reads as a convenience layer over verifiable data, not a new authority.
- [ ] If the underlying context is `degraded` or has low coverage (as in the Malegaon/Wheat example — 7% coverage), say so plainly in the generated text rather than writing around it — the same "insufficient confidence → say so" rule from the advisory layer applies here.
- [ ] **This is not a change to the "no ML price prediction" non-goal** (`Architecture_MarketData_Weather.md` §1) — it narrates existing computed numbers, it does not forecast new ones. Keep that distinction intact in the prompt and don't let it drift into prediction over time.
- [ ] **Acceptance:** the generated text never contains a number that isn't independently visible elsewhere on the same page — spot-check this directly, don't just assume the prompt is obeyed.

### 2.4 Trust and completeness details — data this project already has, just not shown

A closer look at MandiLens's market detail page surfaced several small trust-building details that cost nothing new to build — they're all already-computed or trivially-computable from data this project already stores:

- [ ] **Expose `quality_flag` as a visible column**, not just internal filtering logic. Add a "Recent observations" raw data table (date, min, modal, max, source, `quality_flag`) to the market detail page — when a row's flag is `ok`, show "—" (nothing to flag); when it's `outlier`/`order_violation`/etc., show it plainly. This is the exact column MandiLens calls "Statistical flag" — same idea, and we already compute this value (`Architecture_MarketData_Weather.md` §9.1), it just isn't surfaced anywhere in the UI yet.
- [ ] **Show data-completeness stats per market/crop pair**: first reported date on file, and the largest gap (in days) between reports. Both are a straightforward query over existing `mandi_prices` rows — no new computation design needed, just a small aggregate query and two numbers on the page.
- [ ] **Show which varieties were aggregated into a market-day record.** `v_mandi_daily` already aggregates across varieties (median modal price) — but the UI doesn't currently say which varieties went into that number. A short "Varieties included: X, Y" line next to the aggregated price closes that gap.
- [ ] **Acceptance:** a skeptical user can verify, from the page itself, what's been excluded/flagged and how complete the series is — without needing to ask or guess.

### 2.5 Export and share

- [ ] **"Download CSV"** on the trend page and the comparison tool — export exactly what's currently displayed (the date-price series, or the comparison table). Reuses existing query results; no new backend logic, just a client-side or simple endpoint-side CSV serialization of data already being fetched.
- [ ] **"Share view"**-style link (a URL encoding the current crop/state/market/date-range selection) so a result can be sent to someone else and reopen the same view — standard query-param-based deep linking, not a new feature category.

### 2.6 Comparison tool — explicit assumptions language

When building the comparison tool from `Architecture_Frontend.md` §3, match MandiLens's explicit disclosure pattern rather than a vaguer caveat: state plainly, next to the result, exactly which costs were and weren't included — e.g. *"Transport, commission, handling, quality, grade, taxes, and spoilage are not included unless you entered them."* Naming the specific categories left out is more honest and more useful than a generic "estimates only" line, and it's a small copy change, not new logic.

### 2.7 Price Trends page — findings from the full-page review (Oct 2026 screenshots)

The data on this page is real and correctly sourced. The problems are thin data, duplicate rows, and presentation — not wrong numbers.

- [ ] **Verify 2.1 actually landed.** In the screenshots the Market field is still styled like a plain text input (Crop and State show dropdown chevrons; Market doesn't). Type "Mal" and confirm suggestions appear. If they don't, 2.1 is not done. For testing meanwhile, valid Maharashtra wheat markets visible in the Mandi Explorer: Malegaon, Shahada, Telhara, Achalpur, Amalner, Pathardi, Kalamb (Dharashiv).
- [ ] **Honest thin-data states.** When a window has fewer than 3 reports: don't draw a line chart (two isolated dots looks broken) — show a compact table of the reports plus "Only N reports in the last 30 days." Suppress the % change, or label it "based on N reports." Never show identical 7d and 30d changes that come from the same two points (currently "+7% / +7%").
- [ ] **Backfill hasn't covered this pair.** The footer shows `Sources: data.gov.in (Daily Live): 2` — no backfilled rows at all, although Wheat is a deep-advisory crop. This is a data issue, not a UI one. Check with:
  ```sql
  select source, count(*), min(arrival_date), max(arrival_date)
  from mandi_prices
  where commodity ilike 'wheat' and market ilike '%malegaon%'
  group by source;
  ```
  If only `datagov_live` appears, run the backfill (`Implementationplan_MarketData_Weather.md` Phase 2: `agmarknet` package first, CEDA for older history) for all six deep crops × tracked markets. Scripts use **pandas**.
- [ ] **Duplicate markets.** "APMC Malegaon" and "Malegaon", "Shahada" and "APMC Shahada" appear as separate cards with identical prices and dates. Fix in the canonicalization alias map (`Architecture_MarketData_Weather.md` §4.1): strip a leading/trailing "APMC", case-fold, collapse punctuation. Add an API-level dedupe as a safety net — one card per (state, district, canonical market, commodity).
- [ ] **One market-selection model.** Today the page has two selectors (top bar and Mandi Explorer). Make Explorer cards drive the top view — clicking a card loads that crop/market — and make the top Market field a searchable select fed from the same list.
- [ ] **Prefill from the saved farm.** The margin calculator defaults to 2 acres; the saved farm says 3.0. For a logged-in farmer with a farm, prefill field size, and default the crop to the active farm crop when it is one of the six; always allow override. Logged-out visitors keep manual defaults.
- [ ] **Calculate live.** Replace the "Recalculate Margin / Recalculate Storage Math" buttons with debounced recalculation on input change.
- [ ] **Efficiency.** Cache fetches per (crop, state, market) with a client cache (use SWR or TanStack Query — whichever the repo already has) so revisiting a view doesn't refetch; lazy-load the below-the-fold panels (context layer, calculators, mandi logistics) behind skeleton loaders.
- [ ] **Staleness banner wording.** "The mandi feed has not updated within the last 36 hours" mixes up two things. Show them separately, in plain language: "Latest report from this market: 22 Sep (15 days ago)", and only when the pipeline itself is late, "Our daily price update is delayed."
- [ ] **Explorer stars.** Every card shows a filled orange star with no stated meaning. Make it a real favorite toggle (visible on/off states) or remove it.
- [ ] **Acceptance:** with two reports in 30 days the page shows a table and an honest message, not a near-empty chart or a repeated "+7%"; no market appears twice; the six deep crops have backfilled history confirmed by the query above.

---

## Priority 3 — Tools and techniques worth adopting (from a deeper MandiLens teardown)

A second round of research (Perplexity's writeup of MandiLens's stack + their own screenshots) surfaced some genuinely useful technique ideas. **Caveat up front: MandiLens doesn't publish their model code — everything below about their exact ML internals is informed inference from a third party, not confirmed fact.** Treat the pattern as worth learning from, not the specific algorithm claims as verified.

- [x] **Use pandas for all backfill/ETL scripts (decided — not Polars).** The data here is small (tracked crops × a few states, tens of thousands of rows), the jobs run on a schedule so nobody waits on them, and pandas is the library AI coding agents write most reliably. Revisit Polars only if profiling shows a specific pandas job is genuinely too slow. Applies to `jobs/backfill_mandi.py`, the CEDA/Kaggle loaders, and any future forecast job.
- [ ] **A real technique for the "typical range / outlook" feature**, if it gets built (this was already left as an open Phase 0 decision in `Implementationplan_Frontend.md`, not re-deciding it here, just giving it a concrete, well-reasoned option): MandiLens's apparent approach is a **precomputed, not live-served**, short-horizon estimate — train on historical data with a **chronological** (time-respecting, no future-leakage) train/test split, produce a point estimate plus an uncertainty range, and export it as a static artifact on a schedule (their own docs describe exactly this: no runtime inference service). This fits this project's existing patterns well — it's a GitHub Actions scheduled job (same pattern as every other job in this project), not a live model server, and the chronological-evaluation discipline is the same "don't claim more certainty than you have" standard already used everywhere else here. If this gets built, scikit-learn (already free, already standard) is a reasonable choice, and the output should carry the same `confidence`/uncertainty framing as everything else in this project, not a bare number.
- [ ] **Do not adopt the Node.js/Express/MongoDB stack described in the uploaded architecture document.** That document is a generic, inferred "how you could build something like this" writeup, not MandiLens's confirmed internals, and it doesn't match this project's actual, deliberately-chosen stack (FastAPI, Supabase/Postgres) or anything already designed across the other architecture files. The useful part of that document is the *pipeline shape* (fetch → clean → feature-engineer → forecast → export → serve) as a pattern, already covered by the scheduled-job design throughout this project — not the specific technology choices, which should be ignored.

---

## Priority 4 — Weather page clarity (the UI is dense and hard to parse)

The underlying data is correct and complete — confidence, sources, validators, grid resolution caveats are all there, which is good. The problem is presentation: everything is shown at equal visual weight in technical/debug language ("Phase: Today", "Primary Source: open_meteo", "Validators Cross-checked: None (Single-source or pending validation window)"), which reads like an internal debug view rather than a farmer-facing product. This is exactly the gap `Architecture_Frontend.md` exists to close — if that design-system pass hasn't been applied to this page yet, that's likely the root cause, not a new bug to hunt down separately.

- [ ] Rewrite the "Detailed Inspection" card's labels into plain language. Examples:
  - "Primary Source: open_meteo" → something like "Main data source: Open-Meteo weather service"
  - "Validators Cross-checked: None (Single-source or pending validation window)" → something like "Not yet double-checked against another source" (keep the honesty, drop the internal terminology)
  - "Phase: Today" doesn't need to be shown as raw internal state at all — the card already says the date
- [ ] Establish real visual hierarchy: the current observation (temperature, rain) should read as the primary, large content; confidence/source/validator detail should be secondary — smaller, or behind a tap/click ("why this confidence level?"), not presented at the same weight as the headline numbers.
- [ ] The "Area Estimate Notice" (ERA5-Land grid resolution explanation) is good, honest content — keep the substance, but it doesn't need to be a permanently-visible paragraph; consider collapsing it behind an info icon/tooltip next to the relevant numbers, consistent with reducing page density without losing the honesty this project is built on.
- [ ] Apply this pass using the actual token system and component patterns in `Architecture_Frontend.md` (§4's component mapping, §6's restraint rule) — this is a styling/copy pass, not a data or logic change, so it falls under that file's frontend-only scope boundary.
- [ ] **Acceptance:** show the weather page to someone who hasn't been following this project's technical design and ask them what today's conditions are and how sure the app is — they should be able to answer both without needing any term explained.

---

## Definition of done for this round

- [ ] No duplicate weather UI anywhere in the app.
- [ ] No overlapping text at any tested viewport width.
- [ ] A user with no prior knowledge of mandi names can find and select a valid market.
- [ ] Every farmer-facing price shows a kg equivalent.
- [ ] A real, grounded AI summary appears below the numbers on the market page, never contradicts them, and is honest when data is sparse.
- [ ] A browsable markets index exists and lets a user go from "I don't know any mandi names" to a specific trend page without typing a guess.
- [ ] Quality flags, completeness stats, and included varieties are visible on the market detail page, not just computed internally.
- [ ] Thin-data states are honest (no line chart or % change built from fewer than 3 reports), and no market appears as a duplicate card.
- [ ] The six deep-advisory crops have backfilled history, confirmed by the check query in §2.7.
- [ ] The weather page is readable by someone outside this project without a glossary.

# Architecture — Frontend Design System & MandiLens-Class Market UI

**Project:** Smart Crop Advisory System · **Depends on:** all three prior docs (this is the visual/interaction layer over `Architecture_MarketData_Weather.md`, `Architecture_Advisory.md`, `Architecture_IoT.md`) — it changes no backend contract, only how the existing API responses get presented.
**Version:** v1 · 2026-10-01
**Sources:** the four uploaded design-token files (extracted from **arva.com** via refero.design, "Arva — Style Reference"), plus live analysis of **mandilens.vercel.app** and its `/compare` page.

Put this file and its companion `Implementationplan_Frontend.md` in `docs/frontend/`. This resolves the "not yet written" placeholder in `docs/README.md` §3 — update that file once this lands (see the end of this doc).

---

## 0. Operating rules for Antigravity

1. Read this file and `Implementationplan_Frontend.md` fully before touching any styling.
2. **The brief is pinned — don't redesign it.** The uploaded `DESIGN.md`/`tokens.json`/`theme.css`/`variables.css` are an already-complete, already-specific design system (colors, type scale, spacing, radius, named components, do's/don'ts). Your job is applying it correctly across this app's actual screens, not inventing a new one.
3. **This is a style reference, not a brand to copy.** Arva is a real, live company (arva.com). Use their color palette, type pairing, shape language, and layout patterns — never their name, wordmark, logo, copy, or photography. This app ships under its own name and identity (§3 flags the one place this matters most: the header logo lockup).
4. **Fonts need a substitution decision before anything else** — §5 explains why, resolve it in Phase 0.
5. Follow the frontend-design skill's restraint guidance throughout (§6) — specifically: no fade-in-on-scroll on every section, no numbered (01/02/03) markers on content that isn't actually a sequence, one deliberate motion moment rather than decoration everywhere.
6. Free tier only, consistent with every other doc in this project.
7. **Hard scope boundary — this is not optional.** Work under this doc touches frontend files only: UI components, pages, styles, client-side data-fetching that calls *existing, already-documented* endpoints. It never edits FastAPI route handlers, Supabase migrations/schema, the data-layer/advisory/IoT engine code, or GitHub Actions workflows. If a frontend task seems to need a backend change (a missing endpoint, a field the API doesn't return), **stop and ask the user before touching anything outside the frontend** — don't make the change yourself just because it's convenient mid-task. This exists specifically so a frontend rebuild can never regress already-working backend phases, by construction, not by care alone.
8. Do all frontend-phase work on its own branch (`feature/frontend-phase-N`, same convention as every other subsystem) with its own PR into `dev` — never push styling changes directly. Before the user merges, the PR diff should contain no files outside the frontend directory; if it does, that's a signal to stop and explain why, not to proceed.

---

## 1. Goals, non-goals

**Goals**
- G1. Apply the Arva-derived token system consistently across the *entire* app — landing page and every feature (mandi prices, weather, advisory, IoT) — not just a marketing page bolted onto a differently-styled product.
- G2. Build a market/mandi-price experience that matches MandiLens's polish and trust-building patterns, then goes past it using data only this project has (farmer accounts, saved farm locations, weather, advisory context).
- G3. Ship an accessible, responsive baseline — this is a quality floor, not a stretch goal (frontend-design skill's phrase).

**Non-goals**
- Not rebuilding MandiLens's exact feature set 1:1 for its own sake — §4 is about which of its patterns earn a place here and which don't fit this project's actual data.
- Not using every token/component in `DESIGN.md` on every screen — it's a system to draw from, not a checklist to exhaust.

---

## 2. MandiLens — what it's actually doing, in depth

Read directly off the live site (not a paraphrase of its marketing — this is what's actually built):

**Structure:** a search-first landing page ("Find a market or commodity"), immediately followed by live dataset-health stats (88.9K prepared records, 6 states, 79 districts, 121 markets, 14 commodities, a timestamp down to the minute), then a **"Browse by state"** grid where each state card shows district/market/commodity counts *and* a reporting-consistency ratio ("24/24 series reported within 2 days"), then a **"Commodity market pulse"** grid — one card per commodity showing the latest price *range* across all reporting markets plus a freshness badge ("Fresh · 0 days").

**The navigation is task-first, not feature-first:** a "What you can do" section lists *Explore mandi reports / Compare markets / Study price history / Inspect arrivals and varieties / Understand seasonality / View the seven-day outlook / Inspect and download data* — each one sentence, each a direct link. This is a genuinely good pattern: it's organized around what a visitor is trying to accomplish, not around the site's internal feature names.

**An inline glossary does real work:** a numbered "Understanding a mandi report" section defines *Minimum / Maximum / Modal / Aggregated representative price / Arrivals / Variety / Report date / Data freshness / Reporting consistency* in plain language, right on the landing page, before the visitor needs to understand a chart. This is the single most transferable idea here — it teaches data literacy inline instead of assuming it.

**"Trust is part of the interface"** is the site's explicit stated philosophy, backed by four concrete principles: *Source* (AGMARKNET 2.0, cited), *Validation* (invalid/duplicate/out-of-range rows excluded, with reasons recorded), *Aggregation* (variety rows become documented market-day records; **missing reports are never zero-filled**), *Limitations* (represented markets aren't complete geographic coverage; prices aren't bids). That bolded phrase is worth pausing on — **it's the exact same principle already built into this project's `mandi_prices` design**: gaps render as `null`, never interpolated, never silently filled. MandiLens arrived at the same honesty-first design independently; that's a strong signal this project's existing approach (`Architecture_MarketData_Weather.md` §9.1's "gaps are gaps") is the right one, not just internally consistent.

**The comparison tool** (`/compare`, confirmed from its page description — the actual table renders client-side): compares **2 to 4 markets on one common date** (which can be an observed historical date *or* a forecast date, tying into their 7-day outlook), and — this is the detail worth noting most — **lets the visitor enter their own quantity and cost assumptions**, turning a raw price comparison into a "what would I actually net at each market" comparison.

**The seven-day outlook** is presented with explicit "uncertainty and reliability context" rather than as a bare prediction, and their seasonality feature is described as "compar[ing] monthly medians without turning them into unsupported predictions" — consistently careful, hedge-forward language throughout the whole site, not just on one page.

**What MandiLens structurally cannot do:** it has no accounts, no saved locations, no crop tracking, no weather, no advisory. Every comparison starts from zero — the visitor picks markets and types in numbers fresh, every visit. That's the opening.

---

## 2b. iti-h — a second competitor, a different shape

iti-h (iti-h.com) is a broader, more commercial "agri-intelligence suite": Field Monitoring, Weather Forecasts, Mandi Prices, Price Analytics, Market Briefs, plus three calculators (Arbitrage, Crop Margin, Storage Estimator). Unlike MandiLens, **it does have accounts** — its dashboard explicitly offers to "define farm parameters, track crop price gainers, and configure custom alerts" once registered, and it ties weather to a specific mandi ("daily arrivals, and localized weather") rather than only to a farm.

Two things worth being honest about: its own mandi dashboard returned no transaction data when checked (could be a client-side-rendering artifact of a static fetch, same as MandiLens's `/compare` page — not a confirmed verdict either way), and **it shows no visible sourcing or methodology anywhere on the page** — no AGMARKNET/data.gov.in citation, nothing like MandiLens's trust section. Its branding ("Premium," an *arbitrage* calculator, a romanized-Hindi locale tag rather than native Devanagari) reads toward a commercial/trader audience more than smallholder farmers.

**What's genuinely worth taking:** the Crop Margin Calculator and Storage Estimator are both real gaps in what this project had designed — added in `Architecture_MarketData_Weather.md` §9b. Market-level weather (as distinct from farm-level) is the same addition, §9b.3. A WhatsApp share action on price/weather/advisory results is a small, high-fit addition neither competitor's analysis required inventing — just worth doing, added to §4 below.

**Where this project still wins even against the more feature-complete competitor:** sourcing transparency (neither competitor shows it as clearly as this project's architecture already requires) and genuine farmer-specific personalization tied to real saved farm data, not just an account shell.

---

## 3. What to take, what to exceed

| MandiLens pattern | Take it? | How it lands here |
|---|---|---|
| Live dataset-health stats on landing | **Take it** | Pull straight from `/api/health/data` (`Architecture_MarketData_Weather.md` §10.3) — this project already computes exactly this |
| Browse-by-state with reporting-consistency ratio | **Take it, narrowed** | This project tracks a bounded crop/state scope by design (§2.1 of the data-layer doc) — show consistency for *your* tracked scope plus the Explore tier, not try to cover all of India's states on one screen |
| Commodity market-pulse grid | **Take it** | Maps directly onto `v_mandi_daily` — one card per tracked crop, latest range, freshness badge sourced from `mandi_prices.fetched_at` |
| Task-first "what you can do" nav | **Take it** | Same idea, phrased around this project's actual tasks: *Ask for advice / Check prices near me / See the forecast / Scan a leaf* |
| Inline glossary teaching data literacy | **Take it, extend it** | Do the same for weather terms (ET₀, confidence) and advisory terms (growth stage, GDD) — this project already has more jargon to explain than MandiLens does |
| "Trust is part of the interface" transparency section | **Take it — already earned** | This project's confidence badges, source citations, and "gaps are gaps" design are the *same idea*, already built into the data layer. Surface it as visibly as MandiLens does; don't let good backend honesty go unseen in the UI |
| Comparison tool, 2-4 markets, one date | **Take it** | Base case: same UX shape |
| ...with the visitor's own quantity/cost assumptions | **Take it, then exceed it** | MandiLens asks the visitor to type these in blind every time. **This project has `farms.field_size_acres` and a saved farm location already** (`Architecture_Advisory.md` §6) — pre-fill quantity from the farmer's own field size, and estimate transport distance from the farmer's saved farm to each candidate market automatically. A logged-in farmer should never have to re-enter what the system already knows about their farm. |
| Seven-day price outlook with reliability framing | **Reconsider, don't dismiss** | This project's data-layer doc explicitly lists "no ML price prediction" as a non-goal — and that's still right for anything model-based. But MandiLens's own hedge-forward language ("without turning them into unsupported predictions") suggests theirs may be a simple trend/seasonal-median method, not heavy ML either. A lightweight, clearly-labeled equivalent — e.g., "typical range for this commodity in this month, from N years of history" sourced straight from `weather_normals_monthly`-style aggregation applied to `mandi_prices` — fits the existing confidence-badge language without violating the non-goal. Worth a real decision in Phase 0 of the implementation plan, not a silent skip. |
| Data/methodology/limitations pages | **Take it** | This project doesn't have an equivalent yet — add one; the content is largely already written across the other three architecture docs' "Risks" sections, it just needs a public-facing page |
| No accounts, no personalization | **The actual opening** | Every comparison, every "is this good for my crop" question, every price check can be pre-contextualized by the farmer's saved farm, tracked crops, and live weather — this is the single biggest thing this project can do that MandiLens structurally cannot |
| *(from iti-h, §2b)* Crop Margin Calculator | **Take it, with real sourcing** | Government DES cost-of-cultivation data × this project's own mandi prices — `Architecture_MarketData_Weather.md` §9b.1. iti-h shows no sourcing for theirs; this project's version is citable. |
| *(from iti-h)* Storage Estimator | **Take it, hedge-forward** | §9b.2 — same uncertainty-labeled register as MandiLens's outlook, not a bare recommendation |
| *(from iti-h)* Weather tied to a specific market, not just a farm | **Take it** | §9b.3 — no new engine, a second call site for the existing weather service |
| *(from iti-h)* Arbitrage Calculator | **Skip** | Fits a trader audience, not this project's smallholder-farmer focus — deliberately not building this |
| WhatsApp share on results | **Take it (my own addition, not from either competitor)** | Cheap, high cultural fit for the actual audience — a share action on price/weather/advisory cards, built with the Web Share API or a `wa.me` link |

---

## 4. The design system, applied

Everything below is already fully specified in the uploaded files — this section is about *where it goes*, not re-deriving it.

**Palette role mapping (already defined in `DESIGN.md`):** Forest Ink (`#07503f`) for header/nav/footer/section banners; Bone (`#f1efdf`) as the page canvas — **never pure white as the base**, per the system's own explicit "Don't"; the four pastel tiles (sky/peach/sage/ash) rotate as card surfaces within a single row; Vivid Lime (`#e8fe85`) stays reserved for one high-energy use — in this app, that's the natural home for a genuinely time-sensitive callout (a fresh price alert, a "irrigate today" advisory flag), not a general accent color. Scarcity is the point — the system's own philosophy section says it "earns attention through scarcity."

**Shape language:** pill buttons (100px radius) everywhere, 20px cards, 33px inputs, no sharp corners on interactive elements, no box-shadows — elevation comes from surface-color shifts (bone → white → pastel → forest), not shadows. This applies exactly as much to a weather forecast card or an advisory chat bubble as it does to a marketing CTA — one shape language across the whole app is what makes it feel like one product instead of a landing page bolted onto a dashboard.

**Mapping Arva's named components onto this app's actual screens:**

| Arva component (from `DESIGN.md`) | Used here for |
|---|---|
| Full-Bleed Hero with Photography | Landing page only — a real field/crop photo, not stock-looking agtech imagery |
| Pill CTA Button (filled/outline) | Primary/secondary actions everywhere: "Ask for advice," "Compare markets," farmer onboarding steps |
| Pastel Quilt Card | The commodity market-pulse grid (§3); weather's 7-day forecast strip (one pastel per day, rotating sky/peach/sage the way MandiLens rotates market cards); advisory's "computed values" panel (`Architecture_Advisory.md` §2 idea 1) |
| Forest Section Banner (dark interstitial, 2×2 icon grid) | The "Trust is part of the interface" equivalent section; a disease-detection result's "what to do next" block |
| Input Field (33px radius) | Farmer onboarding, the compare tool's date/market pickers |
| Section Divider Header (serif headline, left-aligned, no decoration) | Every feature page's top-of-page intro — exactly what MandiLens's own "Understanding a mandi report" headline does |

**The one place brand identity actually matters:** the "Header Logo Lockup" component is specified as "white lowercase 'arva' wordmark with a green triangular leaf icon." Keep the *treatment* (lowercase wordmark + simple leaf-adjacent mark on the forest header) — replace the name and icon with this project's own. Confirm the actual product name in Phase 0 (it may still be informally "Smart Crop Advisory System" / SIH25010-derived — worth deciding a real short name now that it has a real design system).

---

## 5. Fonts — a licensing decision, not a styling one

`DESIGN.md` already documents this, and it needs an explicit decision before Phase 1, not a silent default:

| Token font | Status | What to actually use |
|---|---|---|
| Inter | Free (Google Fonts / Fontsource) | Use as-is, no substitution needed |
| Reckless / RecklessLight | **Arva's real commercial display serif — not freely licensable** | Use the system's own documented substitute: **Cormorant Garamond** (free, Google Fonts) is the closest free match for the "unhurried editorial serif" role; GT Sectra and Source Serif Pro are the other two documented substitutes if Cormorant Garamond doesn't feel right in testing |
| FKGrotesk, Helvetica | Minor, low-usage tokens in the extraction (12-16px only) | Not worth a paid license for this little usage — drop them and let Inter cover those sizes, or substitute a free grotesque (e.g., Archivo) if the distinction matters once you see it in context |

**One more font-related decision this project specifically needs that Arva's reference doesn't cover:** neither Inter nor Cormorant Garamond has Devanagari or Gujarati glyphs. Since `Architecture_Advisory.md` §15/§15.1 already commits this app to real Hindi/Marathi/Gujarati UI text, the font stack needs a script fallback — **Noto Sans Devanagari** (Hindi, Marathi) and **Noto Sans Gujarati** (Gujarati), both free, both designed to pair reasonably with a wide range of Latin sans fonts — layered into the CSS `font-family` stack so non-Latin text doesn't silently fall back to a system default that breaks the visual consistency this whole doc is about. This is a real gap between last turn's multilingual work and this turn's design work — closing it here.

---

## 6. Motion — restrained, not decorative

The frontend-design skill is explicit that "fade-and-slide-up entrances on each section and hover transitions on every card" is the generic, over-used default, not sophistication — and MandiLens's own site doesn't lean on scroll animation either; its polish comes from information clarity and consistent shape language, not motion. Apply the same discipline here:

**One deliberate moment, not motion everywhere.** Good candidates for this project's *one* orchestrated moment: the landing page hero's initial load (photograph + headline + two pill buttons settling into place once, on first paint) — pick one, not several.

**Motion that answers an action, not motion that decorates a scroll:**
- A price or weather number that updates (new data arrived) transitions smoothly rather than jump-cutting — this shows *what changed*, which is exactly the skill's stated bar for when motion earns its place.
- Expanding a market card in the comparison tool, opening the advisory chat's sources panel, a disease-detection result revealing its confidence and treatment text — all fine, because they're responses to what the farmer just did.
- **Skip:** fade-in-on-scroll for every landing-page section, hover-lift on every card, staggered list-item entrances. These read as templated regardless of how smoothly they're implemented.

---

## 7. Tooling — and one naming confusion to clear up first

**"Framer" is ambiguous and it's worth being precise, since the wrong choice here means building on the wrong tool entirely:**
- **Framer (the product, framer.com)** is a hosted, no-code website builder — you design visually in their editor and they host the result. It does **not** integrate with this project's actual FastAPI backend, Supabase data, or farmer auth — it's built for marketing sites, not a data-driven app with live prices, weather, and personalized advisory. **Don't use this for the app.**
- **Motion (formerly "Framer Motion," now the `motion` npm package)** is a React animation library that installs directly into this Next.js codebase (`npm install motion`) and animates real components with real data. **This is almost certainly what you actually want**, and it's what §6's restrained motion moments above should be built with.

**Recommended stack for this layer:**
- **Tailwind CSS v4** — `theme.css`'s `@theme { ... }` block is already written in Tailwind v4's CSS-first theme syntax; it drops into the project's global CSS largely as-is (confirm the exact import setup in Phase 0 against whatever Tailwind version, if any, is already configured).
- **`motion`** (React) — for the restrained interaction moments in §6.
- **shadcn/ui** — not a look, a set of accessible, unstyled component primitives (dialogs, dropdowns, form inputs) that get fully restyled with these tokens rather than built from scratch. Standard, free, pairs naturally with Tailwind.
- **`next/font`** — self-host Inter, Cormorant Garamond, and the two Noto Sans script fonts through Next.js's font loader for proper `font-display` behavior and no layout shift, rather than a runtime Google Fonts `<link>`.
- Vercel's built-in OG image generation (`next/og`) — MandiLens uses exactly this for its social preview images; free, already available given the project deploys to Vercel, worth the same small polish touch here.

---

## 8. Risks and honest notes

| Risk | Note |
|---|---|
| The Bone canvas color (`#f1efdf`) is close to a color the frontend-design skill itself flags as an overused "AI-generated" tell (`~#F4F1EA`) | Fine here — it's a deliberate, sourced choice from a real brand's actual extracted system, not a default reached for blind. Worth knowing, not worth avoiding. |
| MandiLens's numbered "01–09" glossary and this project's own component docs both use numbered markers on content that isn't strictly sequential | The frontend-design skill advises against this outside real sequences. Use plain definition-list styling (term + description, no numbers) for the glossary; reserve numbering for things that actually are steps (e.g., the 4-stage Source→Validation→Aggregation→Limitations trust section, which *is* a logical sequence). |
| Reusing Arva's literal brand assets (name, wordmark) would be a real problem, not just a style nitpick | §0 rule 3 and §4's brand note cover this — flagging again because it's the one mistake here that isn't just aesthetic. |
| A from-scratch design system this detailed is easy to apply inconsistently across a team/multiple sessions | Keep `theme.css`/`tokens.json` as the single source Antigravity reads before styling anything, every time — don't let ad-hoc hex values creep in |

---

## 9. Update to `docs/README.md`

Once this file and its implementation plan exist, `docs/README.md` §3's "Not yet written" note for a frontend doc is resolved — add `Architecture_Frontend.md` + `Implementationplan_Frontend.md` to the document table, and add a line to §8 (multilingual strategy) cross-referencing this file's §5 font note (Noto Sans Devanagari/Gujarati fallback), since that's a direct dependency between the two.

---

## 10. References
- Uploaded: `DESIGN.md`, `tokens.json`, `theme.css`, `variables.css` — Arva (arva.com) style extraction via refero.design, captured 2026-06-03
- mandilens.vercel.app (landing page and `/compare`) — live analysis, this document's §2
- iti-h.com/services/price-discovery/mandi-prices-india — live analysis, this document's §2b
- `/mnt/skills/public/frontend-design/SKILL.md` — restraint, motion, and "generic AI tell" guidance applied throughout §6 and §8

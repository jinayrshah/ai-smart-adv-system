# Implementation Plan — Frontend Design System & Market UI

**Companion file:** `Architecture_Frontend.md` — source of truth. Depends on the other three subsystems existing enough to have real API responses to design against — this can start visually (tokens, components) before that, but the data-driven pages need real endpoints.

---

## Kickoff prompt (paste into Antigravity once)

```
You are implementing the frontend design system for my Smart Crop Advisory System, using
a specific design token system I've provided (extracted from a real site via refero.design)
and patterns analyzed from a competitor, MandiLens.

1. Read docs/frontend/Architecture_Frontend.md and Implementationplan_Frontend.md fully.
2. Read docs/README.md if you haven't already this session — this frontend layer spans
   all three other subsystems (data-layer, advisory, iot).
3. Critical rule: the uploaded design system is a STYLE reference from a real company
   (Arva) — use their colors/type/shapes, never their name or logo. Confirm this project's
   own name/wordmark with me in Phase 0 if it isn't already decided.
4. Critical rule: this work is frontend-only. Never edit backend routes, Supabase
   migrations/schema, or the data-layer/advisory/IoT engine code — the other subsystems
   are already built and working, and this redesign must not regress them. If a page needs
   something the API doesn't already provide, stop and tell me instead of adding it
   yourself.
5. Start with Phase 0 (recon + the font-licensing decision), then stop and wait for "go
   phase N" before building anything.
```

---

## Manual steps for Jinay

- [ ] Confirm the project's actual product name — the header wordmark needs a real name, and "Smart Crop Advisory System" is a description, not a brand (§4 of the architecture file). Decide this before Phase 2.
- [ ] Sanity-check the free font substitutes in a real layout before committing — Cormorant Garamond reads differently from Reckless at large sizes; look at it rendered before assuming it's a perfect swap (Architecture §5).
- [ ] Have a Hindi/Marathi/Gujarati speaker glance at Noto Sans Devanagari/Gujarati rendering next to the Latin type once real translated strings exist — script pairing can look off even when each font is individually fine.

---

## Phase 0 — Recon + the decisions that block everything else

**Do**
1. Record in `docs/frontend/recon.md`: is Tailwind already configured (and which version)? What UI primitives, if any, already exist? Is there already a logo/name in use anywhere in the repo?
2. **Font decision** (Architecture §5): confirm Cormorant Garamond as the Reckless substitute (or pick an alternative from the documented options), confirm dropping FKGrotesk/Helvetica tokens in favor of Inter, confirm the two Noto Sans script fonts for Hindi/Marathi/Gujarati.
3. **Outlook decision** (Architecture §3's "seven-day outlook" row): decide now whether this project adds a lightweight, clearly-labeled typical-range feature, or skips it entirely. Don't let it default silently either way.
4. Product name/wordmark (manual step above) — get an answer or a placeholder to move forward with.

**Acceptance**
- [ ] `recon.md` complete, all four decisions above have an explicit answer (even a placeholder), `git diff` empty.

---

## Phase 1 — Tokens and base primitives

**Tasks**
- [ ] Drop `theme.css`'s `@theme { ... }` block into the project's global CSS (Tailwind v4 CSS-first config) — adjust only if Phase 0 found a different Tailwind setup already in place.
- [ ] Load fonts via `next/font`: Inter, Cormorant Garamond (or the chosen substitute), Noto Sans Devanagari, Noto Sans Gujarati — set up the font-family fallback stacks so script text doesn't silently drop to a system default.
- [ ] Install `motion` and `shadcn/ui`; initialize shadcn with no default theme (these tokens replace it).
- [ ] Build the base primitives styled to the token system: pill button (filled + outline variants), input (33px radius), the four pastel card surfaces, the forest section-banner wrapper — as reusable components, not page-specific CSS.
- [ ] A small internal style-guide page (`/dev/styleguide` or similar, not linked from nav) rendering every primitive against the token system — this is what Phase 2+ pages get built from, and it's the fastest way to self-check against `Architecture_Frontend.md` §8's risk list before it's baked into real pages.

**Acceptance**
- [ ] Style-guide page renders all primitives correctly on mobile and desktop.
- [ ] Keyboard focus is visible on every interactive primitive (frontend-design skill's quality floor).
- [ ] Devanagari and Gujarati sample text renders correctly next to Latin text on the same page.

---

## Phase 2 — Landing page

**Tasks**
- [ ] Full-bleed hero: real field/crop photography (not the reused Arva photo), headline in the serif substitute, two pill CTAs, one deliberate entrance motion moment (Architecture §6) — and only one.
- [ ] Live dataset-health stats section, sourced from `/api/health/data` (real numbers, not placeholders — this is meant to do what MandiLens's landing stats do).
- [ ] "What you can do" task-first section, rewritten for this project's actual four features (Architecture §3's table).
- [ ] Glossary section for this project's own jargon (confidence, growth stage, GDD, ET₀ — not just MandiLens's price terms) — plain definition-list style, no numbered markers (Architecture §8).
- [ ] "Trust is part of the interface" equivalent section, surfacing this project's already-built honesty properties (gaps are gaps, confidence badges, cited sources) — the backend work is done, this phase is making it visible.

**Acceptance**
- [ ] Every stat on the landing page is live data, not a hardcoded placeholder.
- [ ] Lighthouse accessibility score checked, not assumed.
- [ ] No fade-in-on-scroll stacked across multiple sections (Architecture §6) — spot check against the skill's explicit warning.

---

## Phase 3 — Market/mandi pages (the MandiLens-class feature)

**Tasks**
- [ ] Commodity market-pulse grid — pastel quilt cards, sourced from `v_mandi_daily` (`Architecture_MarketData_Weather.md`).
- [ ] Browse-by-state/Explore search (Tier B, `/api/market/search`) with the freshness/coverage framing MandiLens uses.
- [ ] Price trend chart (`/api/market/trend`) restyled to the token system — gaps render as visible gaps, not interpolated (already the backend's behavior; this is just not breaking it in the chart component).
- [ ] **The comparison tool** — 2 to 4 markets, one shared date, built to exceed MandiLens per Architecture §3: pre-fill quantity from the logged-in farmer's `farms.field_size_acres` when available, estimate transport distance/cost from their saved farm location to each candidate market automatically, and fall back to MandiLens's manual-entry pattern gracefully for a farmer with no saved farm (or no login at all).
- [ ] Data/methodology/limitations pages — content drawn from the other three architecture docs' existing "Risks" sections, written for a public audience.
- [ ] If Phase 0 decided to build the typical-range "outlook" feature: implement it now, with the same hedge-forward, uncertainty-labeled language MandiLens uses — otherwise skip and move on.
- [ ] **Crop margin calculator UI** (`/api/market/margin`, data-layer Phase 4B) — show `cost_year` plainly, never imply the cost figure is current-season.
- [ ] **Storage estimator UI** (`/api/market/storage-estimate`) — for a non-storable crop, show why it's unavailable rather than hiding the entry point with no explanation.
- [ ] **Market-level weather panel** on a market's own page, pulling the same weather components used on the farmer dashboard but pointed at the market's `location_id` (data-layer §9b.3) — reuse the component, don't rebuild it for this context.
- [ ] **WhatsApp share** action on price/weather/advisory result cards (Web Share API with a `wa.me` fallback) — small, do it here while building these cards rather than retrofitting later.

**Acceptance**
- [ ] The comparison tool, used while logged in with a saved farm, visibly requires less manual entry than MandiLens's equivalent — this is the concrete, demonstrable "better than them" moment, so it should be checkable, not just claimed.
- [ ] The same tool works sensibly for a logged-out or no-farm-saved visitor (graceful degradation, not a dead end).
- [ ] Margin and storage tools each handle their "no data" case visibly and honestly rather than erroring or showing a blank state.

---

## Phase 4 — Weather, advisory, and IoT pages restyled

**Tasks**
- [ ] Weather: 7-day forecast strip as rotating pastel cards, confidence badges styled per the token system's existing card language (not a generic colored dot — use the same visual grammar as everything else).
- [ ] Advisory: chat UI in the token system, the sources/computed-values panel (`Architecture_Advisory.md` §2 idea 1) as a forest-banner-style expandable section, disease-detection results with the confidence-aware phrasing already specified there.
- [ ] IoT: device management UI, live-reading freshness display ("updated 6 minutes ago") — same visual language as the weather confidence badges, since they're the same underlying idea (Architecture_IoT.md §4).
- [ ] One consistency pass across all four features: confirm the same pill/card/banner shapes and the same restrained motion approach are used everywhere, not just on the pages built first.

**Acceptance**
- [ ] A farmer moving between market, weather, advisory, and IoT screens experiences one visual language, not four differently-styled features.
- [ ] Confidence/freshness indicators look and behave consistently across weather and IoT, since they're the same concept in both.

---

## Phase 5 — Polish and critique pass

**Tasks**
- [ ] Run the frontend-design skill's self-critique explicitly: screenshot key pages, check against `Architecture_Frontend.md` §8's risk list (numbered markers, motion overload, brand-asset reuse) one more time with fresh eyes.
- [ ] Full responsive pass, mobile-first (this app's real users are on phones far more than desktops).
- [ ] Reduced-motion media query respected for all `motion` animations.
- [ ] OG image generation (`next/og`) for social sharing, matching MandiLens's own polish touch.

**Acceptance**
- [ ] Every page works at a small mobile viewport without horizontal scroll or clipped content.
- [ ] `prefers-reduced-motion` actually disables the hero entrance and other motion.

---

## Definition of done

- [ ] The same token system (colors, type, shape, restrained motion) is visibly one system across landing page and all four features.
- [ ] The market comparison tool does everything MandiLens's does, plus the personalization MandiLens structurally can't offer.
- [ ] Fonts are fully free/self-hosted, including working Devanagari and Gujarati fallback.
- [ ] Nothing in the shipped product uses Arva's actual name, wordmark, or photography.

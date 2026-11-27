# End-to-End Improvement Plan

Written 2026-11-27 for an executing agent (Opus) working in this repo. Work through the phases in order. Each task lists the files, the change, and how to check it is done. One pull request per phase, against `dev` (the default branch).

## Ground rules for the executor

- Follow `CLAUDE.md`: run `graphify query "<question>"` before grepping or reading code, and run `graphify update .` after code changes.
- Keep the project's core rule: **never let the LLM invent a number that matters**. Every number shown to a farmer comes from computed data or a cited source (`backend/app/domain/advisory/audit.py`).
- Don't touch `docs/submission/` (the college submission files).
- Run these before every commit, and paste the results into the PR:
  ```bash
  cd backend && SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= python -m pytest -q
  npx tsc --noEmit && npm run build
  ```
- Don't change production data, Supabase, or GitHub secrets. Write new SQL migrations, but the owner runs them.

## Where things stand (checked 2026-11-16)

- **Stack:** React 19 + Vite + Tailwind (`src/`) served by Express (`server.ts`, which handles login and proxies `/api/*`), FastAPI (`backend/app`), Supabase Postgres + pgvector, Groq then Gemini for AI, and GitHub Actions cron jobs for ingestion.
- **Size:** about 24k lines of app code. `tsc` passes and `vite build` passes, but the JS bundle is 1.15 MB (346 KB gzipped) in a single chunk.
- **Backend tests:** 166 pass and 12 fail when run with dummy Supabase env vars (the CI setup). The failures are in `test_farmer_onboarding.py`, `test_farmer_auth.py`, `test_accuracy_upgrades.py`, `test_advisory_engines.py` and `test_context.py`. The cause is that `FarmerRepository` (`backend/app/data/farmer/repository.py:47`) treats any configured `SUPABASE_URL` as persistent, so tests call the network and get a 503. CI is probably red for the same reason.
- **Strong parts, so keep them:** the agronomy engines (GDD, FAO-56 water balance, soil, climate, suitability), weather fusion, mandi canonicalisation, the grounding audit, the honest "unavailable" states, and the golden-question tests.

---

## Phase 0: Get CI green and remove risky leftovers (about 1 day)

**0.1 Fix the 12 failing tests.**
In `backend/tests/conftest.py`, add an autouse fixture that makes `FarmerRepository` non-persistent and in-memory for tests. Either inject a fake client (`backend/tests/fake_supabase.py` already exists), or set `_persistent=False` when `SUPABASE_URL` is the CI dummy host. Also fix `test_context.py::test_context_service_rule_evaluation_and_capping`, which returns `price=None` and probably has the same root cause in the mandi repo.
*Done when:* `pytest -q` passes fully offline, and CI is green on `dev`.

**0.2 Make tests fast and offline.**
supabase-py retries failed reads with back-off, so every offline Supabase call in a test waited over a minute and the CI job hit its 10-minute limit. Tests should skip the retry wait and route outbound traffic to a dead local proxy. (`httpx2` in `requirements.txt` is the real successor to `httpx` and what Starlette's TestClient prefers, so keep it.)

**0.3 Remove unused npm dependencies.**
Nothing in `src/`, `server.ts` or `api/` imports `firebase`, `@google/genai`, `multer`, `@types/multer`, `cors` or `react-is`. Remove them, regenerate `package-lock.json`, and rename the package from `react-example` to `smart-agri-advisory`.

**0.4 Pin the Python version and add a lint step.**
CI uses Python 3.12. Add `ruff` (backend) and the existing `tsc --noEmit` as required CI steps. Add `asyncio_default_fixture_loop_scope = "function"` to a `backend/pytest.ini` to silence the warning.

## Phase 1: Security fixes (about 2 days, highest value)

**1.1 Users can make themselves admin.**
`server.ts:419-429` (`/api/auth/update-profile`) accepts `role` from the request body. Drop `role` from what the client can set, and add a test.

**1.2 Delete the deprecated OTP login routes.**
In `server.ts:357-404`, `/api/auth/send-otp` and `/api/auth/verify-otp` have no attempt counter, and `verify-otp` logs in or creates any account. In production the OTP is never delivered, so the only way in is guessing. Remove both routes and the `demo-user-9999999999` special case. Check that `src/services/authService.ts` doesn't call them.

**1.3 Add ownership checks to advisory routes.**
`/api/advisory/ask`, `/diagnostic`, `/disease-check` and `/queries/{id}/feedback` accept any `farm_id` or `farmer_id` with no auth (`backend/app/api/routes/advisory.py`), so anyone can read another farm's diagnostic. Reuse `require_self_or_dev` from `backend/app/core/auth.py`. Resolve the caller, load the farm, and return 403 if the caller doesn't own it. For feedback, check that the query belongs to the caller. Add tests next to `test_farmer_auth.py`.

**1.4 Enforce the upload size limit.**
`DISEASE_MAX_UPLOAD_BYTES` is defined in `config.py` but never used. In `/disease-check`, reject uploads over the limit with a 413 and check the content type. Also cap Express JSON bodies with `express.json({ limit: '1mb' })`.

**1.5 Stricter password rules.**
Register only checks that a password exists. Require at least 8 characters, matching the reset flow. Also stop the unauthenticated reset-request route from revealing whether an account exists: always return `ok`.

**1.6 Move OTP and rate-limit state out of memory.**
The OTP map and rate limiters live in memory (`server.ts:143`, `backend/app/core/rate_limit.py`, `backend/app/domain/advisory/ratelimit.py`). On Vercel serverless they reset per instance. Move OTPs to a Supabase table (`password_reset_otps`, new migration), keep the rate limits, and write down the limitation. Wiring up real SMS or email delivery for reset is out of scope; leave a clear TODO and an env flag.

**1.7 Remove the local `users.json` fallback in production.**
When `NODE_ENV=production`, Supabase must be the only account store, so fail loudly instead of silently writing to `/tmp`. Keep the file fallback for local dev only.

## Phase 2: Repo hygiene (about half a day)

- Delete exact duplicates: `Architecture_Frontend2.md` and `Implementationplan_Frontend2.md` are byte-identical to the non-2 files. The root `Architecture_MarketData_Weather.md` and `Implementationplan_MarketData_Weather.md` duplicate files in `docs/data-layer/`; keep the `docs/` copy.
- Move the remaining root design docs into `docs/` (`DESIGN.md`, `PROJECT_DETAILS.md`, `MARKET_COVERAGE.md`, `LOCAL_DEV_GUIDE.md`), and fix the links in `README.md`.
- Remove binary junk from git: `docs/fixesbyclaude/*.bundle` (three identical copies), `*.zip`, and `*.pdf`. Also remove the stale `ralph/prd.json` (a Firebase migration plan the app no longer follows) and the out-of-date `.planning/` notes, which say there are no tests and the app uses Firestore. `.planning/` is gitignored, yet tracked, so untrack it.
- `data/mandilens/` (33 MB) is a seed snapshot. Move it to a GitHub Release asset or Supabase Storage, and have `jobs/load_mandilens_snapshot.py` download it. Ask the owner before deleting it from git.
- Remove the AI Studio comment and the `DISABLE_HMR` block from `vite.config.ts`.
- Root `theme.css`, `variables.css` and `tokens.json` aren't imported by `src/`. Either wire them into `src/index.css` or delete them.

## Phase 3: Backend quality and reliability (3 to 4 days)

**3.1 Clean up the AI provider layer.**
`backend/app/core/gemini.py` holds both Groq and Gemini despite its name. Rename it to `app/core/llm.py`, with a `Provider` interface and the `GroqProvider` and `GeminiProvider` classes, and keep a re-export so imports don't break. Check the default model ids in `config.py` (`gemini-flash-lite-latest`, `gemini-3-flash-preview`, and the hard-coded fallback `gemini-3.8-flash`) against the live model lists in `jobs/check_ai.py`. Add a timeout and circuit-breaker test.

**3.2 Add conversation memory to the advisor.**
`AdvisoryAskRequest` has no chat history, so each question stands alone ("what about the next spray?" fails). Add optional `history: list[{role, text}]` (last 6 turns, length-capped) to the schema, pass it into `build_system_prompt` in `generator.py`, and send it from `AdvisorView.tsx`. Keep the audit running only on the new answer.

**3.3 Split the large route file.**
`advisory.py` has 578 lines and 17 endpoints. Split it into `routes/advisory/{agronomy,ask,schemes,disease}.py`, and move the repeated `assemble_advisory_context` retry into a helper.

**3.4 Use dependency injection consistently.**
Advisory routes use module globals (`weather_service`, `farmer_repo`), while market and weather use `Depends`. Switch them to `Depends` so tests can override them, then delete the global-patching in tests.

**3.5 Structured errors and logging.**
Add one exception handler that returns `{error, code, request_id}`. Add a request-id middleware, and have Express forward it. Stop putting raw exception text in 4xx and 5xx responses (`detail=f"... {exc}"` in `disease-check`), since it leaks internals.

**3.6 Persist the embedding cache in the database.**
`query_embeddings_cache.json` (2.4 MB) is rewritten on disk at runtime (`embeddings.py:61`), which fails on read-only or serverless filesystems. Make the write best-effort (it already is) and add a Supabase `embedding_cache` table as the main store.

**3.7 Health and readiness.**
Extend `/health` into `/health/ready`, which checks the Supabase reachability, LLM key presence and model file presence, without making paid calls.

## Phase 4: Frontend quality (3 to 4 days)

**4.1 Code splitting.**
Lazy-load each tab with `React.lazy` in `src/App.tsx` (Advisor, Prices, Weather, Farm), and put `recharts` in its own chunk. *Target:* initial JS under 400 KB (about 130 KB gzipped).

**4.2 Finish translations.**
Many strings in components are hard-coded English (for example, `DataFooter.tsx` and `PriceContextHeader.tsx` have no `t()` calls). `kn.json` and `te.json` are missing 15 keys that `en.json` has. Extract the strings, fill the gaps (mark machine translations for review), and add a CI script that fails if any locale is missing keys from `en.json`.

**4.3 Type safety.**
`App.tsx` stores the farmer profile as `any`. Generate TypeScript types from FastAPI's OpenAPI (`openapi-typescript`) into `src/lib/api/types.ts` and use them in `src/lib/api/*`. Delete `frontend/lib/api/market.ts`, a one-line stray outside `src/`, after checking it's unused.

**4.4 Unify the API client.**
The token is read from `localStorage` in five places. Make one `apiFetch()` in `src/lib/api/client.ts` that adds the token, handles 401 by logging out, and turns errors into readable messages.

**4.5 Frontend tests.**
Add Vitest + React Testing Library with tests for `farmerProfile.ts` normalisation, the auth flow, and the Advisor send and render loop. Add Playwright smoke tests (login, onboarding, ask a question) against a mocked API. Add both to CI.

**4.6 Accessibility and mobile.**
Run an a11y pass: icon-only buttons need `aria-label`, chart data needs a text fallback, and tap targets should be at least 44 px. Most farmers use cheap Android phones, so test at 360 px width.

## Phase 5: Deployment you can reproduce (2 days)

- Vercel only runs Express and the frontend. The FastAPI host isn't documented anywhere (`FASTAPI_URL`). Add `backend/Dockerfile` and a `docker-compose.yml` (frontend, backend, and local Postgres with pgvector) so the whole app runs with one command.
- Document one backend host (Render, Fly or Railway free tier) in `docs/DEPLOY.md`, with the env var list.
- Apply migrations with the Supabase CLI (`supabase db push`) instead of pasting into the SQL editor, and add a CI check that the migrations apply to a throwaway Postgres.
- Add Sentry (or similar) error reporting behind an env flag on both servers.
- Make every ingestion workflow fail visibly when a job writes 0 rows, and add a weekly data-freshness check that opens an issue.

## Phase 5b: Design and demo polish (3 to 4 days, before Phase 6)

Checked 2026-11-27 with screenshots of every screen at 390 px and 1280 px. The visual style (`DESIGN.md`) is already clean and consistent on Today, Advisor and Farm. The problems are about **getting to the value fast** and **trusting what you see**, which is what a judge looks at in the first 2 minutes.

**D1. One-tap demo farm (biggest win).**
Today a new user must fill a long, required form (name, location search, state, district, soil, crop, sowing date) before seeing anything. Add a **"Try with a sample farm"** button on the sign-in page and at the top of farm setup. It creates an account with a realistic farm (for example, cotton in Surat, sown 1 Jul, drip irrigation) and lands on Today with everything filled in. Keep the full form for real farmers, but make it a 3-step wizard (Where → Crop → Soil, optional) with progress dots instead of one long sheet.
*Done when:* a judge goes from the URL to a full Today screen in under 15 seconds without typing.

**D2. Never show an empty card in a demo.**
With no data, cards say "–", "No forecast on file" or "Prices are unavailable right now". Keep the honesty, but:
- Make the live deployment always have data: the ingestion jobs run on a schedule, and a one-off backfill covers the demo districts.
- Give each empty state one clear next step ("Weather loads in about a minute after setup. Refresh" or "Pick a nearby mandi").
- Use skeleton placeholders while loading instead of spinners, so screens don't jump.

**D3. Show the "why" behind every number.**
Grounded, auditable advice is the project's main difference from a plain chatbot, but it's hidden. Add a small **"How we know"** link on each Today card that opens a short sheet: the stage from growing degree-days since sowing, water from the FAO-56 balance with its inputs, the price source and date. In Advisor answers, show sources as tappable chips and the confidence as a coloured badge, not a grey line.

**D4. Prices screen: same look, less clutter.**
Prices uses a different visual style (green section titles, boxed toolbars, a disabled Refresh button) and opens empty ("Choose a mandi"). Default to the mandi nearest the farm with the farm's crop, put the trend chart first, and move Compare and the calculators behind tabs or "More". Remove "Share View" unless it works without login.

**D5. A desktop layout for laptops and projectors.**
Judges usually see the app on a laptop or projector. On screens wider than 1024 px, move the tab bar from the bottom into the header (or a left rail), and use a two-column Today. Keep the bottom bar on phones.

**D6. A short first-run guide.**
On the first visit to Today, show 3 dismissible coach marks: your crop's stage, ask the advisor (text or photo), switch language. Store the dismissal per user.

**D7. Finish the language story.**
Translate every screen, not just the Advisor (see 4.2). Put the language switch on the sign-in page and in the first-run guide, since multilingual support is a headline feature. Check that long Hindi and Telugu strings don't break buttons.

**D8. Name, icon and polish.**
- Give the app a short name and icon instead of the generic "Smart Agriculture", and use it in the title, favicon and PWA manifest.
- Add page transitions under 200 ms, with reduced motion respected.
- Keep tap targets at 44 px or more.
- Check text contrast against WCAG AA.

**D9. Demo script.**
Add `docs/DEMO.md`: a 3-minute path for presenters (sample farm, then Today and "How we know", a question in Hindi with a follow-up, a leaf photo, then the price trend), plus a backup set of screenshots in case the network fails on stage.

## Phase 6: Product features (pick in order; each is its own PR)

1. **Voice questions and spoken answers in the Advisor.** Bhashini is already configured (`translation.py`). Add a mic button: speech to text, then the advisor, then text to speech. This removes the reading barrier.
2. **Offline PWA.** Add a manifest and a service worker that caches the app shell and the last Today screen, with a clear "offline, data from <time>" label. Rural connectivity is patchy.
3. **Alerts.** Turn IMD warnings and price moves into a Today banner first, then web push. Use the plan in `docs/ROADMAP_data_integrations.md` §2.
4. **More crops.** Only 6 crops are supported. Add 4 major ones for the existing mandi states (groundnut, onion, chilli, sugarcane) through `crop_catalog.json` and ICAR documents, following the "Adding a crop" steps in `README.md`.
5. **Disease model.** No model file ships (`backend/models/` is missing), so leaf checks always use the vision LLM fallback. Train with `training/train_disease_model.py`, publish the `.keras` file as a release asset, download it at deploy time, and report the field-test accuracy in the UI's "how sure" text.

**Future scope (not planned now):** WhatsApp channel, as in `ROADMAP_data_integrations.md` §1. It needs Meta Business verification by the owner.

## Phase 7: Measure answer quality (ongoing, starts with Phase 3)

- Turn `test_golden_questions.py` into a scored eval: 50 real farmer questions across crops, languages and states, each with expected facts. Run it nightly against the live LLM (a manual workflow, with secrets) and record groundedness, refusal accuracy and latency.
- Run `jobs/review_advisory_feedback.py` weekly and file thumbs-down answers as eval cases.

---

## Order and effort at a glance

| Phase | Effort | Why this order |
|---|---|---|
| 0 CI green | 1 day | Every later change needs a working safety net |
| 1 Security | 2 days | Real holes: self-admin, the OTP bypass, other farmers' data |
| 2 Hygiene | 0.5 day | Makes the repo readable before refactors |
| 3 Backend | 3-4 days | Advisor memory is the biggest quality win for users |
| 4 Frontend | 3-4 days | Speed on cheap phones, full regional languages |
| 5 Deploy | 2 days | The full stack can be run and recovered |
| 5b Design and demo | 3-4 days | Judges see value in the first 2 minutes |
| 6 Features | 1-2 weeks each | Voice and offline first: they suit the users best |
| 7 Evals | ongoing | Proves answers are improving, not just changing |

## Decisions the owner needs to make

- Whether to move `data/mandilens/` (33 MB) out of git (Phase 2).
- Which backend host to use (Phase 5).

# Deploying

The app runs in three places:

| Part | Where | What it serves |
|---|---|---|
| Frontend + login server (`server.ts`) | **Vercel** | The React app, `/api/auth/*`, and a proxy for every other `/api/*` call |
| FastAPI backend (`backend/`) | **Render** (`render.yaml`) | Advisor, prices, weather, farm data |
| Database | **Supabase** | Postgres + pgvector |

Scheduled data jobs (prices, weather, IMD bulletins) run in GitHub Actions and write straight to Supabase.

## 1. Supabase (once)

1. Open the project in the Supabase dashboard, then **SQL Editor**.
2. Run each file in `supabase/migrations/` that hasn't been run yet, in name order. To see which tables exist, check **Table Editor**: for example, `app_users` comes from `20261101000000_app_users.sql`.
3. Under **Project Settings → API**, copy the **Project URL** and the **service_role** (or `sb_secret_…`) key.

## 2. Backend on Render

1. Sign in at render.com with GitHub, and allow it access to `ai-smart-adv-system`.
2. Go to **New → Blueprint**, pick the repo, and leave the branch on `dev`. Render reads `render.yaml`.
3. Fill in the values it asks for:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | From step 1 |
   | `JWT_SECRET` | A long random string. **The same value goes on Vercel.** |
   | `PROXY_SHARED_SECRET` | Another long random string. **The same value goes on Vercel.** |
   | `CORS_ALLOW_ORIGINS` | Your Vercel URL, e.g. `https://ai-smart-adv-system.vercel.app` |
   | `DATA_GOV_IN_KEY`, `OPENWEATHER_API_KEY` | Your data keys |
   | `GROQ_API_KEYS`, `GEMINI_API_KEY` | AI keys (Groq is tried first) |
   | `BHASHINI_USER_ID`, `BHASHINI_API_KEY` | Optional, for answers in regional languages |

   To make a random string, run `openssl rand -hex 32`.
4. Deploy. When it's live, check these URLs:
   - `https://<service>.onrender.com/health` should return `{"status":"ok"}`.
   - `https://<service>.onrender.com/health/ready` should show `supabase`, `llm` and `auth` as `true`.

On the free plan, the backend sleeps after 15 minutes with no traffic, and the next request takes 30 to 60 seconds. The Starter plan (about $7 a month) stays awake.

## 3. Frontend on Vercel

The project is already connected. Under **Project → Settings → Environment Variables (Production and Preview)**, set:

| Key | Value |
|---|---|
| `FASTAPI_URL` | `https://<service>.onrender.com` (no trailing slash) |
| `JWT_SECRET` | Same as on Render |
| `PROXY_SHARED_SECRET` | Same as on Render |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Same as on Render (accounts are stored in Supabase) |

Then redeploy: **Deployments → … → Redeploy**. Set **Settings → Git → Production Branch** to `dev`, or to whichever branch is the default.

## 4. GitHub Actions secrets (data jobs)

In the repo, under **Settings → Secrets and variables → Actions**, add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_GOV_IN_KEY` and `OPENWEATHER_API_KEY`. Then go to the **Actions** tab and run `ingest-mandi` and `ingest-weather` once by hand, so there is data before the first scheduled run.

## 5. Smoke test

1. Open the Vercel URL, create an account, and set up a farm.
2. On **Today**, check that you see the crop stage, weather and a mandi price.
3. In **Advisor**, ask a question, then a follow-up such as "and the next stage?".
4. In **Prices**, open a crop trend.

If a screen says the backend is unavailable, check `FASTAPI_URL` on Vercel and `/health/ready` on Render.

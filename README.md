# NextReport

Automated ad performance reporting for Meta Ads. Upload a CSV, get a fully
branded PowerPoint report with AI-written insights in minutes.

Internal engine: **NextReport Engine (NRE v1)** — a TypeScript port of the
tested `meta_ads_report_v4.js` Apps Script (see `reference/`), covering
column auto-detection, data-first objective detection, MTD-Daily-CSV
aggregation, account health scoring, and native PPTX generation from the
`ADS_TEMPLATE_V2` template.

## Local development

```bash
npm install                # also runs `prisma generate` via postinstall
cp .env.example .env       # fill in DATABASE_URL and AUTH_SECRET at minimum
npx prisma migrate dev     # creates tables in your local Postgres
npm run dev
npm test                   # 110 tests covering the NRE engine, PPTX and AI modules
```

Requires a local PostgreSQL instance (or point `DATABASE_URL` at any hosted
Postgres — Supabase, Neon, etc.).

## Deploying to Vercel

### 1. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. If using Supabase, use the **pooled** connection string and append `?pgbouncer=true` (or use the direct connection with `sslmode=require`). |
| `AUTH_SECRET` | Yes | Random secret for NextAuth session signing. Generate with `openssl rand -base64 32` — do **not** reuse the dev placeholder from `.env.example`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Only if using "Continue with Google" | From a Google Cloud Console OAuth client. Add `https://<your-domain>/api/auth/callback/google` as an authorized redirect URI. Leave blank to disable Google login (email/password still works). |
| `NEXTAUTH_URL` | Recommended | Your production URL, e.g. `https://nre-plum.vercel.app`. |
| `BLOB_READ_WRITE_TOKEN` | Yes (for report downloads to work) | **Don't set this by hand.** Go to the project's **Storage** tab → **Create Database** → **Blob**, then connect it to this project — Vercel injects the token automatically. Without this, generated reports are written to local disk, which doesn't survive between serverless invocations, so downloads will fail. |
| `STORAGE_DIR` | No | Local-dev-only fallback path; unused when `BLOB_READ_WRITE_TOKEN` is set. |

Groq/Gemini API keys are **not** environment variables — each client profile
in the app has its own key fields (Client page → "AI insight writing"
section), matching the spec's "user provides their own keys" v1 design.

### 2. Database migrations

`postinstall` only runs `prisma generate` (builds the typed client) — it does
**not** apply migrations. Run once against your production database before
first use, and again after any future schema changes:

```bash
DATABASE_URL="<your production URL>" npx prisma migrate deploy
```

### 3. Deploy

Push to the connected branch — Vercel builds automatically. Confirm the
build log shows `Generated Prisma Client` (from `postinstall`) before
`next build` starts.

## Project structure

```
prisma/schema.prisma       Auth (User/Account/Session) + Client + Report models
src/lib/nre/                NextReport Engine — the ported business logic
src/lib/pptx/                OOXML .pptx generation engine (no external deps)
src/lib/ai/                  Groq-primary/Gemini-fallback insight writing
src/app/(dashboard)/         Authenticated app (clients, reports)
src/app/api/                 Route handlers
templates/                   .pptx report templates
reference/                   Original Apps Script + spec (source of truth)
```

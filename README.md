# NextReport

Automated ad performance reporting for Meta Ads. Upload a CSV, get a fully
branded PowerPoint report with AI-written insights in minutes.

Internal engine: **NextReport Engine (NRE v1)** — a TypeScript port of the
tested `meta_ads_report_v4.js` Apps Script (see `reference/`), covering
column auto-detection, data-first objective detection, MTD-Daily-CSV
aggregation, account health scoring, and native PPTX generation from the
`ADS_TEMPLATE_V2` template.

Upload accepts `.csv`, `.tsv`, `.txt`, `.xlsx`, `.xls`, and `.ods` — file type
is detected from content (magic bytes), not the extension. Delimiter (comma/
tab/semicolon), text encoding (UTF-8/UTF-16), and BOMs are all auto-detected;
for Excel workbooks, a sheet named "MTD Daily CSV" (or "Period CSV" for that
upload slot) is used if present, otherwise the first sheet with data. See
`src/lib/nre/parse-file.ts`.

After a report is generated, users can **Download PPTX** (as before) or
**Get Google Slides Link**, which uploads the generated file to the user's own
Google Drive with `mimeType: application/vnd.google-apps.presentation` (Drive
converts it to an editable Slides file automatically), sets sharing to
"Anyone with the link can view", and returns that link — opened in a new tab
and shown inline to copy. This needs the `drive.file` OAuth scope (the app
can only see/manage files it creates, nothing else in the user's Drive), so
"Continue with Google" always requests it and always shows the full consent
screen (`prompt=consent`) — that's deliberate: it's the only way to
reliably get a refresh token back on every sign-in, which the Slides feature
needs to call the Drive API outside the login request itself. A user who
only ever signed up with email/password sees a "Connect Google Drive" prompt
in place of the link the first time they try it. See `src/lib/google-drive.ts`
and `src/app/api/reports/[id]/slides/route.ts`.

## Local development

```bash
npm install                # also runs `prisma generate` via postinstall
cp .env.example .env       # fill in DATABASE_URL, AUTH_SECRET, BLOB_READ_WRITE_TOKEN
npx prisma migrate dev     # creates tables in your local Postgres
npm run dev
npm test                   # 155 tests covering the NRE engine, PPTX, AI, and Drive modules
```

Requires a local PostgreSQL instance (or point `DATABASE_URL` at any hosted
Postgres — Supabase, Neon, etc.). Report generation also requires
`BLOB_READ_WRITE_TOKEN` locally (see the storage row below) — everything else
works without it.

## Deploying to Vercel

### 1. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. If using Supabase, use the **pooled** connection string and append `?pgbouncer=true` (or use the direct connection with `sslmode=require`). |
| `AUTH_SECRET` | Yes | Random secret for NextAuth session signing. Generate with `openssl rand -base64 32` — do **not** reuse the dev placeholder from `.env.example`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Only if using "Continue with Google" (required for "Get Google Slides Link") | From a Google Cloud Console OAuth client. In that client's **Authorized redirect URIs**, add `https://<your-domain>/api/auth/callback/google` for **every** domain the app is served on (production domain and any Vercel preview/`.vercel.app` URL still in use) — a domain missing here is the most common cause of Google sign-in failing right after the account picker. In the same Google Cloud project, the **Google Drive API** must also be explicitly enabled (APIs & Services → Enable APIs → "Google Drive API") — an OAuth client alone doesn't turn it on, and every Drive upload call fails with a 403 until it is. Leave the env vars blank to disable Google login entirely (email/password still works; "Get Google Slides Link" will show a "Connect Google Drive" prompt with no way to complete it). |
| `NEXTAUTH_URL` | Recommended | Your production URL, e.g. `https://nextreport.in`. After changing this (or any env var), **redeploy** — Vercel serverless functions don't pick up updated environment variables until the next deployment. |
| `BLOB_READ_WRITE_TOKEN` | Yes | **Don't set this by hand on Vercel.** Go to the project's **Storage** tab → **Create Database** → **Blob**, then connect it to this project — Vercel injects the token automatically. Works with the store set to **private** access (the app never generates a public/signed URL — it authenticates server-side with this token on every read). There is no local-disk fallback (Vercel's serverless functions have no writable filesystem), so report generation fails without this in every environment, including local dev — run `vercel env pull .env` after connecting Blob storage to get the same token locally. |

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

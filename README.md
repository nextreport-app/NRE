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

The report upload wizard is a 5-step flow: **Upload → Campaigns → Dates →
Preview → Generate**. After the CSV validates, step 2 lists every campaign
found and lets the user exclude any before it reaches the NRE engine at all
(`src/lib/nre/campaigns.ts`); step 3 picks the weekly window that drives the
campaign/ad-set/chart slides — "last 7 days ending yesterday" (default),
"previous 7 days", or a custom range validated against the CSV's own date
bounds, with a soft confirmation if it's over 7 days. MTD is never affected
by that choice — it's always the full reporting month through yesterday,
computed and shown automatically (`src/lib/nre/date-range.ts`,
`resolve-date-selection.ts`). Both choices are saved per client and pre-fill
the next upload. The campaign preference is stored as the *excluded* set
(`Client.lastDeselectedCampaigns`), not the selected one — a campaign the
user explicitly unchecked stays unchecked next time, but a brand new
campaign that didn't exist in any previous upload defaults to selected,
the same as every other campaign the user never excluded.

Every signup gets a 7-day free trial (`User.trialEndsAt`, no card required)
with full access. Subscribing to **Starter** (₹999/mo, up to 5 clients) or
**Professional** (₹2,499/mo, unlimited) is handled by Razorpay Checkout —
see `/pricing` and `/billing`, `src/lib/razorpay.ts`, and
`src/app/api/payments/`. Every payment is re-verified server-side against
Razorpay's HMAC-SHA256 signature before a plan changes; the frontend
reporting success is never trusted on its own. Once a trial expires (or a
subscription is cancelled) without an active plan, adding new clients and
generating reports are blocked — `src/lib/subscription.ts` and
`subscription-guard.ts` are the single source of truth for that gate, both
in the UI (paywall screen) and re-enforced in the API routes themselves.

A plan can also change server-to-server via `src/app/api/payments/webhook/`
(Razorpay dashboard → Settings → Webhooks), independent of the browser-side
Checkout flow — this is the authoritative path if a user's connection drops
right after paying. It verifies every request against
`RAZORPAY_WEBHOOK_SECRET` (a third Razorpay secret, separate from the API
key pair above) before trusting anything in the payload, resolves which
user a `payment.captured` event belongs to (by `razorpayCustomerId`, then
by `userId` in the order's notes), and derives the plan from the amount
actually captured rather than from any client-supplied value. A
`payment.failed` event is logged only — it never changes a plan.

`/pricing` detects the visitor's currency client-side (fetching
`ipapi.co` directly from the browser, so it sees the visitor's real IP,
not the server's) — India shows INR/Razorpay, everywhere else shows USD
and, since Stripe isn't wired up yet, a waitlist form instead of a real
Subscribe button (`src/lib/currency.ts`, `components/currency-pricing.tsx`,
`components/waitlist-form.tsx`). A manual INR/USD switcher overrides
detection, and detection failing or timing out defaults to USD. Waitlist
emails are saved to `WaitlistEntry` via `POST /api/waitlist` (public, no
auth — most visitors here are anonymous); re-submitting the same email
updates its plan/country instead of creating a duplicate row.

## Local development

```bash
npm install                # also runs `prisma generate` via postinstall
cp .env.example .env       # fill in DATABASE_URL, AUTH_SECRET, BLOB_READ_WRITE_TOKEN
npx prisma migrate dev     # creates tables in your local Postgres
npm run dev
npm test                   # 587 tests covering the NRE engine, PPTX, AI, Drive, and billing modules
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
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Yes (for subscription billing) | From the Razorpay dashboard (Settings → API Keys). `.env.example` ships this repo's **test mode** key pair (`rzp_test_...`) for local/staging use — generate and switch to a **live mode** key pair before accepting real payments. `RAZORPAY_KEY_SECRET` is read server-side only (`lib/razorpay.ts`, `api/payments/verify`) and must never be duplicated into a `NEXT_PUBLIC_`-prefixed variable. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes (for subscription billing) | Same value as `RAZORPAY_KEY_ID` — Razorpay's key ID is a publishable identifier the Checkout script needs client-side, unlike the secret. Set both together (and both to the matching live/test pair) whenever you rotate keys, or Checkout will open under one Razorpay account while orders are created under another. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes (for subscription billing) | A **separate** secret from the key pair above — shown once when you create the webhook in the Razorpay dashboard (Settings → Webhooks → Add New Webhook, URL `https://<your-domain>/api/payments/webhook`, subscribed to at least `payment.captured` and `payment.failed`). Read server-side only (`api/payments/webhook`); left blank, the endpoint rejects every request with a 500 rather than silently accepting unverified ones. Re-copy and update this if the webhook is ever recreated — Razorpay does not let you view an existing webhook's secret again after dismissing the creation dialog. |

Groq/Gemini API keys are **not** environment variables — each client profile
in the app has its own key fields (Client page → "AI insight writing"
section), matching the spec's "user provides their own keys" v1 design.
Razorpay keys, by contrast, **are** platform-level environment variables
(one Razorpay account collects payment for every user's subscription), not
configured per client or per user.

### 2. Database migrations

`postinstall` only runs `prisma generate` (builds the typed client) — it does
**not** apply migrations. Run once against your production database before
first use, and again after any future schema changes:

```bash
DATABASE_URL="<your production URL>" npx prisma migrate deploy
```

A forgotten migration is the most common cause of a generic "This page
couldn't load — A server error occurred" screen: Prisma queries select every
column on a model by default, so a field that exists in the deployed code's
schema but not yet in the actual database table (e.g. after pulling a new
zip) makes the query fail outright. `npx prisma migrate status` (with
`DATABASE_URL` set to the production database) shows whether any migrations
are pending. Every page now has an `error.tsx` boundary showing an "Error
reference" digest instead of Next.js's bare default message — pass that
digest along when reporting a server error so it can be matched to the exact
failure in Vercel's function logs.

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
src/lib/subscription.ts      Trial/plan status + gating rules (lib/subscription-guard.ts enforces them server-side)
src/lib/razorpay.ts           Razorpay client + payment signature verification
src/app/(dashboard)/         Authenticated app (clients, reports, billing)
src/app/api/                 Route handlers
templates/                   .pptx report templates
reference/                   Original Apps Script + spec (source of truth)
```

# NextReport — Codex migration brief

**Product:** [nextreport.in](https://nextreport.in)  
**Audience:** Codex (or any engineer taking over the reporting engine and wizard)  
**Last updated:** 25 October 2026 (IST)  
**Purpose:** Full background on what we built, why accuracy is the business, where we stand today, what failed repeatedly (especially Meta API + CPR/metrics), and where to look first to fix architecture—not another layer of patches.

---

## 0. Read this first

NextReport is a **B2B SaaS for digital marketing agencies**. Agencies upload **day-grain ad exports** (primarily **Meta Ads Manager CSV**), run them through **NextReport Engine (NRE)**, and get **client-ready PowerPoint decks**, **live share links**, optional **Google Slides / Drive**, and **AI-written narrative** (optional user API keys).

**One wrong number on a slide can lose a client.** The founder is **not confident** that every report is correct today. Regression tests pass on **frozen fixtures**, but **real-world CSV shapes, API payloads, and multi-campaign accounts** still produce wrong **results counts**, **cost per result (CPR/CPL)**, **MTD combined totals**, or **objective labels** often enough that accuracy work remains the **#1 product risk**.

This document is intentionally long. It merges product context, wizard UX, engine mechanics, launch scope, OAuth work, and **years of failed Meta API parity attempts** (50+ PRs on the integration branch alone).

---

## 1. Business context and north star

| Principle | Detail |
|-----------|--------|
| **Customer** | Agencies reporting Meta (and eventually Google/TikTok) to brands |
| **Promise** | Numbers that match **Ads Manager** (or are explainable when API ≠ export) |
| **Revenue** | INR Razorpay subscriptions (Agency/Professional), 7-day trial, no card |
| **Live today (marketing)** | **Meta CSV** reporting only — see `docs/META_LAUNCH_SCOPE.md` |
| **Visible but “launching soon”** | Google Ads, TikTok, GA4 website, Meta Marketing API sync in wizard |
| **Accuracy** | Non-negotiable; engine bugs are existential, not “polish” |

---

## 2. Technology stack

| Layer | Choice |
|-------|--------|
| App | **Next.js 16** (App Router), React 19, TypeScript |
| Auth | **NextAuth v5** (credentials + optional Google sign-in behind flag) |
| DB | **PostgreSQL** via **Prisma** (Supabase-hosted in prod) |
| Files | **Vercel Blob** (generated PPTX), optional Drive upload |
| Hosting | **Vercel** (serverless, cron, `CRON_SECRET` job worker) |
| Billing | **Razorpay** (INR); USD waitlist without Stripe self-serve |
| Engine | **NRE v1** — TypeScript port of `reference/meta_ads_report_v4.js` |
| Tests | **Vitest**; release gate `npm run test:objective-regression` |
| PPTX | Template fill (`src/lib/pptx/`), not live Google Slides API editing |

**Monorepo:** single app at repo root (`nextreport-webapp`). Internal engine lives under `src/lib/nre/`.

---

## 3. Repository map (where logic lives)

```
src/
  app/                    # Routes: marketing, dashboard, wizard pages, API routes
  components/
    report-upload-wizard/ # 4-step ads wizard (Meta/Google/TikTok)
    website-report-wizard.tsx
  lib/
    nre/                  # *** REPORTING ENGINE ***
      report-data.ts      # buildReportData — main deck assembly (~thousands of lines)
      objective.ts        # Objective / result-type detection (extended heavily)
      meta-objective-dictionary.ts
      result-type-map.ts
      columns.ts, parse-csv.ts, parse-file.ts
      available-metrics.ts, slot-assignment.ts, packs.ts
      csv-report-reconciliation.ts, cpr-parity.ts
      meta-api-sync/      # Meta Insights → synthetic CSV (parity attempts)
      report-engine/      # Platform adapter facade
      fetch-*-report-rows.ts
    meta-api.ts           # Graph API client
    ad-platform-api-sync.ts  # AD_PLATFORM_API_SYNC_ENABLED gate
    meta-launch-scope.ts  # Platforms / report types / marketing copy
    pptx/                 # Slide rendering
    ai/                   # Optional insights generation
docs/
  META_LAUNCH_SCOPE.md
  platform-parity.md
  ga4-reporting-architecture.md
  launch-readiness-audit.md
  google-oauth-verification-demo.md
  CODEX_MIGRATION_BRIEF.md  # this file
reference/
  meta_ads_report_v4.js   # Original Apps Script truth (partial)
prisma/schema.prisma      # User, Client, Report, OAuth tokens, etc.
```

---

## 4. What we built (feature inventory)

### 4.1 Core (Meta CSV — production promise)

- Multi-client workspaces (currency, timezone, logo, template theme light/dark)
- **Report upload wizard** (4 steps — see §6)
- Report types: weekly, monthly, yesterday, comparison, historical, day breakdown, quarter, YTD, creative (see §7)
- **Campaign selection** (exclude list persisted per client)
- **Objective detection** per campaign + combined MTD table buckets
- **8-card metric packs** on campaign slides + optional continuation slide for 9+ metrics
- **Weekly window** + **MTD** + **last-30-day chart** (weekly report)
- **Previous month** optional row (upload stored on client)
- **CSV verification** on preview (spend/results/CPR scopes — see §11)
- PPTX download, share link (`/r/[token]`), optional Slides via Drive OAuth
- White-label branding (cover + share header modes)
- Report history, retention settings, duplicate client
- Razorpay billing, trial paywall on **generate** APIs

### 4.2 Integrations (built, not all “live” in marketing)

| Integration | Connect UI | Wizard / data | Notes |
|-------------|------------|---------------|--------|
| Meta Marketing API | Account + wizard (gated) | `meta-api-sync/*` → synthetic CSV | **Parity still broken on real accounts** (§12) |
| Google Ads API | Account | CSV + API sync route | OAuth verification in progress |
| TikTok API | Account | CSV-shaped pipeline | Geo gate removed (2026); still beta |
| GA4 | Account + website wizard | **Forked** from NRE ads pipeline | `docs/ga4-reporting-architecture.md` |
| Google Drive | Account | Post-generate save | Same Google Cloud client as login (separate from Ads/GA4 clients) |
| Google sign-in | Gated `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED` | NextAuth | Waiting on verification |

### 4.3 Not built / removed / deferred

- PDF export removed from product flow (legacy `pdfPath` may exist on old rows)
- Share link **revoke/rotate** UI missing
- GA4 async job queue / publish parity with ads reports (see GA4 doc)
- LinkedIn, retail media, etc. — out of scope (`docs/integration-roadmap.md`)
- Stripe USD self-serve — waitlist only

---

## 5. Where we stand today (October 2026)

### 5.1 Production posture

- **`main`** includes multi-platform **UI visibility** (#580) and **Google OAuth privacy copy** (#581).
- **Customer-facing claim:** Meta CSV is **live**; API sync and other platforms are **launching soon**.
- **`AD_PLATFORM_API_SYNC_ENABLED`** defaults **false** on prod — wizard “Sync from API” disabled with copy; Account OAuth connect still works for demos.
- **Google OAuth verification:** rejected once on demo video (insufficient scope usage proof); new Loom + test credentials required — see `docs/google-oauth-verification-demo.md`.

### 5.2 Founder confidence level

| Area | Confidence |
|------|------------|
| Meta CSV on **well-known fixtures** | Moderate (CI green) |
| Meta CSV on **arbitrary agency exports** | **Low** — new column shapes, multi-objective MTD, ad-set grain still surprise us |
| Meta API sync vs manual CSV | **Low** — Credit Firm and similar accounts drove 50+ PRs; still not trusted for production |
| CPR / CPL display vs spend÷results | **Mitigated but not proven** — golden tests + reconciliation; historical production incidents |
| Google / TikTok | Early parity phases complete in code; less battle-tested than Meta |
| GA4 website | Separate pipeline; API path works when property linked |

### 5.3 Release gate (must run before prod deploy)

```bash
npm run test:objective-regression
```

Includes: meta/google/tiktok objective regressions, dictionary consistency, CPR golden, Credit Firm dual-export parity, CSV reconciliation MTD multi-objective, meta CSV export profile, GZ Australia cases.

**Passing CI does not mean all real accounts are fixed** — fixtures encode past bugs, not the full search space.

---

## 6. Ads report wizard — four steps (current UI)

Entry: **`/clients/[id]/reports/new`**. Steps are **1–4** (README’s old “5-step” description is stale).

### Step 1 — Report setup & import (`import-step.tsx`)

**Report setup (top of step 1):**

- Pick **report type** (primary: Weekly, Monthly, Yesterday; secondary under “More report types”: Comparison, Historical, Day breakdown, Quarter, YTD, Creative).
- Pick **platform**: Meta, Google Ads, TikTok, or **Google Analytics** (switches wizard to website mode via `chooseWebsitePlatform()` → `wizardKind === "website"`).

**Import:**

- **CSV** (default): upload MTD day-wise export (`.csv`, `.tsv`, `.xlsx`, … — see `parse-file.ts`).
- **API** (Meta/Google/TikTok): only when `AD_PLATFORM_API_SYNC_ENABLED=true`; otherwise toggle shows “Launching soon”.
- **Analyze** → server `analyze` route: validation, platform detection, date bounds, campaign list seed.
- Optional **previous month** file on client; optional **Meta manual reference CSV** when API sync (hybrid merge for Results column).
- **CSV date guidance** banners (month boundaries, day-1 uploads, timezone = client timezone).
- Platform beta notices for Google/TikTok/GA4.

**Outputs of step 1:** validated file handle (or API artifact), `detectedPlatform`, campaigns preview data, report type locked in wizard state, session prefs (`platform-storage.ts`).

### Step 2 — Campaigns (`campaigns-step.tsx`)

- Lists campaigns found in CSV (and ad-set expansion per campaign where enabled).
- User **excludes** campaigns; exclusions persist as `Client.lastDeselectedCampaigns` (exclusion model, not allowlist).
- Schedule indicators / objective hints on campaign rows (Meta Ad Reporting parity work).
- For some report types, date selection lives here or carries from step 1 (weekly custom range, comparison periods, etc.).

### Step 3 — Metrics (`metrics-step.tsx`)

- Per-campaign **objective** display (detected or overridden); user can reset objective memory.
- **8 metric chips** from **packs** (`packs.ts`) + CSV-aware availability (`available-metrics.ts`).
- User can add metrics from CSV columns (9th+ → continuation slide rules).
- Pack engine locks core slots; LPV vs link clicks vs website leads conflicts were recurring bug class.

### Step 4 — Generate (`generate-step.tsx`)

- **Preview** fetch: builds `ReportData` preview JSON + **CSV verification** (`csv-report-reconciliation.ts`).
- User confirms; **Generate** enqueues job (or sync path) → PPTX to blob, share token, optional AI insights.
- Success: download, share link, Drive folder save, email hooks.
- Leave guards on steps 2–4 (beforeunload, in-app link capture).

**Website GA4 wizard** (`website-report-wizard.tsx`): embedded from step 1 GA4 card or standalone `/clients/[id]/reports/website/new`. Date preset, client kind, breakdowns, CSV or API source, preview/generate — **does not use** `buildReportData()`.

---

## 7. Report types (what each delivers)

Defined in `src/lib/nre/wizard-report-type-copy.ts` and `meta-launch-scope.ts`.

| Type | User-facing intent | Engine / deck behavior (Meta-centric) |
|------|-------------------|----------------------------------------|
| **WEEKLY** | Last week + MTD + L30 chart | Campaign slides for **selected 7-day window**; MTD row on combined table; last-30-day chart slide; optional previous month comparison row |
| **MONTHLY** | Month to date | MTD-focused deck; no “last week” slide set |
| **DAILY** (“Yesterday”) | Single day | Yesterday-only campaign slides |
| **COMPARISON** | Period A vs B | Two windows per campaign + comparison table (`buildComparisonReportData`) |
| **HISTORICAL** | Multi-month | Month-by-month slides + overview (`buildHistoricalReportData`) |
| **DAY_BREAKDOWN** | One row per day table | **Meta-only** at API (`reports/route.ts` rejects other platforms) |
| **QUARTER** | Quarter to date | QTD date clamp on CSV rows |
| **YTD** | Jan 1 – yesterday | YTD aggregation |
| **CREATIVE** | Ad-level CSV | Requires ad-grain export; different validation |

**Date logic:** client **timezone** drives “yesterday”, MTD boundaries, weekly caps (`date-range.ts`, `resolve-date-selection.ts`). Weekly user range does **not** shrink MTD — MTD is always month-through-yesterday in client TZ.

---

## 8. CSV ingestion pipeline

1. **Upload** → `parse-file.ts` (magic bytes, sheet names “MTD Daily CSV”, encoding).
2. **Column auto-map** → `columns.ts` / platform variants (`google-columns.ts`, `tiktok-columns.ts`, `ga4-columns.ts` for website).
3. **Validate** → `validate.ts` (required spend column, date column, row grain).
4. **Analyze route** returns campaigns, date span, warnings, platform coercion via `coerceLaunchPlatform`.
5. **Build** → `buildReportData()` in `report-data.ts` (or platform adapter entry).

**Two Meta export “profiles”** (critical for parity):

- **Ads Reporting** export vs **Campaigns screen** export — different columns and Result indicator behavior; tests like `credit-firm-dual-export-parity.test.ts` and `meta-csv-export-profile.test.ts` encode differences.
- **Ad-set grain vs campaign grain** — MTD summing and objective grouping bugs often come from mixed grain or wrong row filter.

**Hybrid Meta API import:** optional manual CSV merged over API sync for Results/CPR columns (`merge-reference-manual-csv.ts`, note in share JSON: `META_HYBRID_API_CSV_IMPORT_NOTE`).

---

## 9. Campaign detection

- Campaign names from CSV `Campaign name` column (normalized in `campaigns.ts`).
- **Heuristics** on campaign name when Result type column is blank or ambiguous (`campaign-name-heuristics.ts`): website leads, meta form, messaging, reach, quote request, purchases, etc.
- **Continuation pairs** — some campaigns split across slides when metric count > 8.
- **Reach** campaigns: special aggregation (`reach-aggregation.ts`); reach must not be summed like clicks across ad sets incorrectly.
- **Credit Firm pattern:** website submission leads with LPV noise in other columns — dedicated regression tests.

---

## 10. Objective detection (hardest Meta logic)

**Primary module:** `src/lib/nre/objective.ts` (1800+ lines, evolved from Apps Script + many production bug reports).

**Supporting:**

- `meta-objective-dictionary.ts` — CSV label ↔ canonical objective, API action maps (`META_API_ACTION_TO_CSV`).
- `result-type-map.ts` — Result type string → objective + cost label.
- `detect-objective.ts` — wizard-facing detection entry points.
- `meta-campaign-objective-matrix.json` — reference matrix.

**Priority chain (conceptual):**

1. Explicit **Result type** column on rows (when present and trustworthy).
2. Dedicated metric columns (website leads, form leads, purchases, messaging, etc.).
3. **Dominant signal** in Results column vs raw action columns — many bugs came from picking LPV or stray `lead` actions over true optimization event.
4. Campaign name heuristics when CSV is sparse.

**Known failure modes (still recur in the wild):**

- **Mixed ad sets** under one campaign with different optimization events → wrong bucket in **Combined Total** MTD row.
- **Purchases vs Initiate Checkout vs Add to Cart** — ratio and Results-column matching (Part 7 fixes in tests; new exports break again).
- **Meta form leads** vs **website leads** misclassification.
- **Messaging** campaigns picking link clicks.
- **Custom conversions** (`offsite_conversion.custom.*`) — API vs CSV diverge heavily (Credit Firm).
- **Blank Result type** on some days but actions[] noisy — API sync mapper tries to mimic Ads Manager “Results column only” (`manual-export-mapper.ts`).

**User override:** objective memory / reset on metrics step — does not fix systemic detection if user doesn’t intervene.

---

## 11. Metrics, packs, and PPT chips

**Packs (`packs.ts`):** exactly **8 keys** per objective/performance goal (spend, reach, impressions, result, cost-per-result, CTR, two secondaries). Examples: `leads_website`, `traffic_landing_page_views`, `sales_purchase`, `leads_meta_form` (locked Instant Form 8).

**Slot assignment (`slot-assignment.ts`, `available-metrics.ts`):**

- Maps pack keys → CSV columns via dictionaries (`meta-dictionary.ts`, dynamic-metrics).
- **CSV-aware packs** — drop chips without data; don’t swap in wrong objective’s metrics (Issue 1: LPV campaign showing CLICKS ALL).
- **9th metric** → continuation slide; hard cap until third slide exists.
- **Weighted CTR/CPC** blending for some scopes (tests: `belle-ctr-cpc-blend.test.ts`).

**CPR on slides:**

- Display CPR should equal **spend ÷ results** on same slide (`cpr-parity.ts`, `assertCampaignSlideCprParity`).
- **MTD combined row** multi-objective CPR uses spend basis rules (`cpr-spend-basis.ts`) — frequent source of “green CSV verify but wrong MTD CPL” reports.

---

## 12. Preview, generate, and CSV verification

**Preview:** `POST .../reports/preview` builds report JSON without saving PPTX (or lightweight render).

**CSV verification (`csv-report-reconciliation.ts`):**

- Compares aggregated CSV totals to preview deck for scopes: account, campaign, MTD, sometimes weekly window.
- Status: `ok` | `mismatch` | `skipped`.
- User can still generate on mismatch (with UX warning) — business choice; verification is advisory.

**Generate:** `POST .../reports` → job queue `dispatch-report-generation-job.ts` → worker `api/jobs/generate-report` (requires `CRON_SECRET` bearer — was P0 blocked by auth proxy redirect; fixed per launch audit).

**PPTX:** `renderPptx` / `fill-tags.ts` — platform-specific labels (Google retext rules, TikTok template fork).

---

## 13. Meta Marketing API sync — what we tried and why it still fails

### 13.1 Design intent

**Do not** build a parallel math path. Pipeline is:

```
Meta Insights API → manual-export-mapper (pick Results like Ads Manager)
                 → synthetic CSV (same headers as manual export)
                 → parseCsv → buildReportData (identical to upload)
```

Entry: `src/lib/nre/meta-api-sync/` (`fetch-meta-report-csv.ts`, `insight-engine.ts`, `manual-export-mapper.ts`, `api-csv-normalize.ts`, `merge-reference-manual-csv.ts`, diagnostics).

Wizard calls `POST /api/clients/[id]/reports/sync-api` (gated by `AD_PLATFORM_API_SYNC_ENABLED`).

### 13.2 Why Graph API ≠ Ads Manager CSV

Documented in code comments and tests — not a single bug, a **structural** problem:

| Issue | Detail |
|-------|--------|
| **Results vs actions[]** | Ads Manager “Results” uses **costed** `results[]` + `cost_per_result[]` pairs. API often exposes richer `actions[]` with uncosted or duplicate signals. |
| **Custom conversions** | `custom.*` in actions without paired costed results → blank or wrong in Ads Manager; mapper must not invent leads (Credit Firm live panels). |
| **Website submission leads** | Stray `lead`, `onsite_conversion.lead_grouped`, `fb_pixel_lead` on **zero-result days** (API noise) — breaks objective if summed naively. |
| **Ad-set vs campaign level** | Insights fetched at ad-set daily grain; dedupe/rollup must match how user exported CSV. |
| **Reach** | Campaign-period reach vs summed daily reach — separate fetch `fetch-campaign-period-reach.ts` for wizard parity attempts. |
| **Hybrid reference CSV** | Product workaround: upload manual CSV alongside API so Results/CPR come from file. |

### 13.3 Credit Firm (canonical pain account)

Fixtures under `src/lib/nre/__tests__/fixtures/dc-credit-firm*.csv` and tests:

- `credit-firm-dual-export-parity.test.ts` — Reporting vs Campaigns export same week.
- `dc-credit-firm-api-parity.test.ts` — synthetic insights → API CSV → compare to manual.
- `credit-firm-uploaded-csv-parity.test.ts`, `credit-firm-strict-results`, zero-results PRs on branch history.

**Outcome:** tests pass on fixtures; **live API sync still reported wrong CPR/results** in production iterations — hence 50+ PRs and founder distrust.

### 13.4 `pickResultAction` / `pickManualExportResult`

Core selection in `manual-export-mapper.ts` (~900 lines). Logic branches for:

- Website leads vs meta form vs messaging vs reach vs quote vs purchases.
- Costed vs uncosted custom conversions.
- When to return **blank** Results for a day (Ads Manager shows blank).

**Any change here ripples to CPR, objectives, and CSV verify.**

### 13.5 What Codex should do (Meta API)

1. **Pick a single reference account** (Credit Firm + 2–3 others) and define **acceptance metrics** per day/campaign: Results, CPR, spend — compared to manual CSV download same window.
2. **Instrument** mapper output vs manual row-by-row diff tool (not only end-to-end deck).
3. Consider **formal spec** of “Ads Manager Results column semantics” from Meta docs + empirical CSV — code tries to encode this implicitly today.
4. Evaluate whether **API path should remain** or **CSV-only + OAuth for account picker** until Meta provides a reporting export API equivalent.
5. **Do not** add more heuristic branches without shrinking total branch count (refactor to tables + provenance logging).

---

## 14. CSV engine issues (non-API)

These burned **weeks** independent of API:

| Theme | Symptoms | Key files |
|-------|----------|-----------|
| **CPR ≠ spend/results** | Slide shows $41.74 vs $37.67 math | `cpr-parity.ts`, `report-data.ts` MTD row |
| **MTD multi-objective** | Purchases inflated when ad sets disagree | `getResultGroups`, tests `csv-report-reconciliation-mtd-multi-objective` |
| **Wrong objective on slide 2** | Chart legend / combined total mismatch | `objective.ts`, `slot-assignment.ts` |
| **Weekly vs MTD date overlap** | Double-count or wrong window | `resolve-date-selection.ts`, stale CSV tests |
| **CTR/CPC blended** | Account-level vs summed campaign | blended formulas, scope tests |
| **Previous month row** | Wrong comparison when PM file stale | `previous-month-data`, sync from API |
| **Timezone** | Off-by-one on month boundary | client TZ in all date helpers |
| **Two export profiles** | Campaigns table vs Reporting | `meta-csv-export-counting.ts` |
| **AI insights wrong numbers** | Narrative contradicts slide | `generate-insights.ts` guards; still risk if AI enabled |

**Architectural concern:** `report-data.ts` and `objective.ts` are **monoliths**. Logic duplicated between preview, generate, share, and reconciliation. Small changes fix one report type and break another.

---

## 15. Google Ads, TikTok, GA4 (short)

- **Unified pipeline** for Meta/Google/TikTok ads: `platform-reporting.ts`, `report-engine/platform-adapter.ts`, `buildReportData` with Google slots (`buildGoogleSlots`).
- **Google API sync** fetches limited GAQL columns — Display/Video extras often need CSV (`integration-roadmap.md` gaps).
- **TikTok** uses Meta-shaped CSV + `tiktok-result-type.ts` (not Meta `pickResultAction`).
- **GA4** fork — see `docs/ga4-reporting-architecture.md`; do not merge into `buildReportData`.

---

## 16. Bugs and risks documented but not fully closed

From `docs/launch-readiness-audit.md` and codebase (verify current status on `main`):

| ID | Issue | Status |
|----|-------|--------|
| P0-1 | Cron/worker blocked by proxy redirect | Fixed (verify on prod) |
| P0-2 | CPR display trust | Mitigated + regression; **real CSV spot-check still required** |
| P0-4 | CRON_SECRET scope too broad | Open design risk |
| P0-5 | `allowDangerousEmailAccountLinking` | Open security/product decision |
| P1-1 | Google sign-in verification | External blocker |
| P1-2 | Drive OAuth test users | External blocker |
| P1-4 | Weak share tokens | By design; no revoke UI |
| P2 | Share token rotation, GA4 async jobs | Not done |

**Meta API production parity:** treated as **open P0 product** despite tests.

**Docs drift:** `README.md` wizard step count; `integration-roadmap.md` TikTok India hide (code now shows TikTok all regions per `visitor-geo.ts`).

---

## 17. Pending product / engineering work

1. **Engine accuracy audit** — Codex primary mandate (this brief).
2. **Meta API:** either fix mapper + prove parity or disable/mark hybrid-only.
3. **Google OAuth** — verification video + test credentials (`docs/google-oauth-verification-demo.md`).
4. **`AD_PLATFORM_API_SYNC_ENABLED`** — prod policy when API trusted.
5. **Google Ads API** Basic Access / developer token (separate from OAuth verification).
6. **Platform “launching soon”** → live marketing when confidence matches Meta CSV bar.
7. **Share link security** (optional password, revoke).
8. **GA4 delivery parity** (async generate, publish PDF path).
9. **Reduce monoliths** — extract pure functions + golden row-level diff CLI for every deploy.

---

## 18. Testing strategy (for Codex)

```bash
npm test                                    # full suite (large)
npm run test:objective-regression             # pre-deploy gate
npm run test:api-routes                       # API integration tests
```

**Golden fixtures:** `src/lib/nre/__tests__/fixtures/` — never delete; add new accounts as bugs are found.

**When fixing engine:**

1. Add fixture CSV (or API snapshot JSON) from failing production report.
2. Add test that fails before fix.
3. Run full objective regression — Meta changes often break Google/TikTok dictionary tests.

---

## 19. Environment variables (operational)

See `.env.example`. Critical groups:

- **Database:** `DATABASE_URL`
- **Auth:** `AUTH_SECRET`, `AUTH_GOOGLE_*` (login), `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED`
- **Meta API:** `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION`
- **Google Ads OAuth:** `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, optional `GOOGLE_ADS_DEVELOPER_TOKEN`
- **GA4 OAuth:** `GA4_CLIENT_*` or reuse Google Ads client
- **Feature flags:** `AD_PLATFORM_API_SYNC_ENABLED`, `BETA_HIDE_PRICING` (false)
- **Jobs:** `CRON_SECRET`
- **Billing:** Razorpay keys, webhook secret
- **Admin:** `ADMIN_EMAILS` (full Professional override for listed emails)

---

## 20. Codex mission statement (recommended)

1. **Treat NRE as a financial reporting system**, not a slideshow generator.
2. **Map data lineage** for one metric (e.g. Website Leads CPR on MTD row): CSV cell → row filter → objective bucket → aggregation → slide → verification check.
3. **Split** `buildReportData` / `objective.ts` into testable pure modules with one aggregation path used by preview, generate, and reconciliation.
4. **Meta API:** row-level diff against manual CSV; reduce `manual-export-mapper.ts` complexity or replace with spec-driven table.
5. **Expand fixtures** from every founder-reported bad report; fail CI on any CPR/objective mismatch.
6. **Document invariants** (e.g. “CPR display = spend/results unless REACH”) in one `ENGINE_INVARIANTS.md` enforced by tests.

---

## 21. Related documents

| Doc | Use |
|-----|-----|
| `docs/META_LAUNCH_SCOPE.md` | What is “live” vs launching soon |
| `docs/platform-parity.md` | Google/TikTok pipeline phases |
| `docs/ga4-reporting-architecture.md` | GA4 fork decision |
| `docs/launch-readiness-audit.md` | P0/P1 checklist Oct 2026 |
| `docs/google-oauth-verification-demo.md` | Loom script for Google |
| `docs/google-oauth-test-users.md` | Drive/login test users |
| `reference/meta_ads_report_v4.js` | Legacy behavior reference |

---

## 22. Handoff note from Cursor agent (25 Oct 2026 IST)

The team merged **#580** (visible multi-platform UI, API sync gated) and **#581** (privacy policy + OAuth-friendly beta copy). **Google OAuth verification** is waiting on a **new demo video** and **active test login**, not on missing UI.

The **founder’s primary ask for Codex** is not OAuth—it is **reporting correctness**: Meta CSV and especially **Meta API synthetic CSV** still diverge from Ads Manager on real accounts; **CPR/objective/MTD** logic is dense, regression-tested only on known fixtures, and **architecture has grown faster than abstraction**.

Start with **`objective.ts`**, **`report-data.ts`**, **`manual-export-mapper.ts`**, and **`csv-report-reconciliation.ts`**. Read **`credit-firm-dual-export-parity.test.ts`** as the narrative of what “done” looks like—and ask why production still disagrees when that test passes.

---

*End of migration brief.*

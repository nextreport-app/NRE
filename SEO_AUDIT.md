# Technical SEO, performance, analytics and reporting audit

Audit date: **4 November 2026 (Asia/Calcutta)**. Baseline: `4545484`. Work is on `fix/seo-performance-reporting`; **not deployed**.

## 1. Executive summary

The codebase already had a sitemap, robots route, canonical metadata, Organization/WebSite/SoftwareApplication schema, a deferred GA4 loader, lazy video facades, and timezone-aware reporting dates. There were specific gaps rather than a missing SEO implementation.

**FIXED:** two indexable help pages and the Open Graph image were behind the login proxy; unknown document URLs went to login; the guide alias used a temporary redirect; sitemap lastmod dates changed without content edits; placeholder case studies inherited indexability; stale location cache could override current country; CSV currency did not control report/PPT formatting consistently; GA cookies lacked an opt-in/privacy disclosure; small carousel tap targets and an oversized logo hurt mobile accessibility/delivery.

**PASS, local production build:** 14 canonical sitemap URLs; 24 HTTP/SEO verification groups; public page metadata and server-rendered H1s; desktop/mobile layout checks; one GA initialization after consent using a dummy ID and intercepted vendor request; INR only for India by default, USD for other tested countries; actual AUD PowerPoint XML with an INR client default; Sydney/India midnight and DST boundary calculations.

**NEEDS ACCESS:** deployed responses, PageSpeed/CrUX, production environment configuration, DNS verification, Google Search Console, and GA4 account settings. Outbound requests to nextreport.in, www.nextreport.in, Google documentation and PageSpeed returned **workspace gateway/tunnel 403**. This does **not** demonstrate an origin/CDN 403 or a Googlebot problem. There is no Google account connector available in this workspace.

## 2. Discovery / inventory

| Item | Evidence / result |
|---|---|
| Framework | Next.js 16.4.3 App Router, React 19.2.4, TypeScript, Tailwind 4 (`package.json`) |
| Routing | `src/app`, grouped authenticated dashboard, token-based client views, API route handlers; `src/proxy.ts` uses NextAuth |
| Hosting | Vercel configuration/cron, private Vercel Blob for uploads/reports, PostgreSQL with Prisma 7 |
| CMS | No external CMS integration found. Marketing/help content lives in React/source files. Report summaries are application data, not indexable CMS articles. |
| Canonical origin | `https://nextreport.in`, from `src/lib/seo.ts` |
| Public registry | `PUBLIC_SITEMAP_ROUTES`: 14 public documents after adding metrics/objectives guides |
| Inventory | 37 page routes + 77 API handlers + 4 framework metadata/assets = 118 routes in `SEO_ROUTE_MATRIX.json` |
| Tracking | One GA4 component at root; no separate GTM container or other manual gtag/event installation found. Google Ads/GA4 OAuth connectors are reporting data integrations, not website measurement. |
| Local configured names | `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`; values deliberately not recorded |
| Optional integration names | `GA_MEASUREMENT_ID`, `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`; verification names added to `.env.example`. Production values/configuration were not accessed. |

## 3. P0 / P1 / P2 issue register

No independently confirmed production-wide P0 crawl outage was observed: live access is blocked from this execution environment. Account-access requirements are not presented as proven failures.

| Priority | Status | Issue / action / evidence |
|---|---|---|
| P1 | FIXED | `/help/metrics`, `/help/objectives`, `/opengraph-image` hit the login guard. Explicit public routes added. Local guide pages and image now return 200, image Content-Type verified. |
| P1 | FIXED | Unknown document paths redirected to login instead of a real 404. Known private namespaces and API routes remain session-gated, with a second authentication guard in the dashboard layout; Next handles unknown document URLs. Local missing URL is 404. |
| P1 | FIXED | CSV currency was replaced by the saved client currency. Explicit ISO evidence now drives wizard, preview, verification, background rendering, charts and share formatting. No FX conversion. Mixed currencies are rejected. Actual AUD PPT XML tested. |
| P1 | FIXED | Current non-India country could lose to a cached India location, plus redundant ipapi lookup/hydration differences. Edge country now outranks cached country; explicit user choice remains an override; initial SSR/hydration agree. Eight country tests, zero redundant geo requests. |
| P1 | FIXED | GA4 could load without opt-in, contrary to cookie-policy wording. Optional tag now waits for consent, allows withdrawal, suppresses private routes, disables advertising signals, validates ID, and sanitizes initial URL/referrer. Vendor requests were intercepted, never sent to a real property. |
| P1 | NEEDS ACCESS | GA4 Enhanced Measurement history behavior, automatic form events, actual page_view delivery, redaction, unwanted referrals, Google signals/account settings and retention cannot be certified without the stream/account. No manual SPA page_view was added, to avoid duplicating Enhanced Measurement. See event plan. |
| P1 | NEEDS ACCESS | Production GA4 ID/property correctness, GSC ownership, submitted sitemap, URL Inspection, manual actions/security issues, GA4-GSC linking and indexing coverage. Optional verification metadata alone is not ownership proof. |
| P1 | FIXED | Placeholder case studies had no explicit noindex. They now have a self-canonical and noindex; robots permits fetching the noindex. They remain outside sitemap. No customer results/ratings were invented. |
| P1 | FIXED | Missing explicit www canonical-host redirect and private/staging indexing defense. Added 308 www→apex redirect, private/token/API X-Robots-Tag, dashboard authentication/metadata and Vercel preview noindex/disallow. Host redirect tested locally. Production HTTPS/CDN behavior needs live verification. |
| P2 | FIXED | Sitemap used `new Date()` for every lastmod. Removed false modification dates; genuine content revision metadata can be introduced later. Small sitemap needs no index/partitioning. |
| P2 | FIXED | Three hreflang aliases pointed at one URL without separate localized documents. Removed speculative hreflang; English/global canonical remains. |
| P2 | FIXED | Social/JSON-LD readiness: OG asset public, graphite OG/theme-color, safe `<` escaping in JSON-LD, visible breadcrumbs matching existing schema, footer links to both help guides. |
| P2 | FIXED | Mobile 8px carousel dots became 44px click targets without enlarging the visible dots; wizard dots also gained usable hit areas. Menu control is 44px. Inline contact link has a persistent underline. |
| P2 | FIXED | 1048px logo delivered for a 48px slot (~20KiB avoidable transfer). Navigation now uses Next image sizing/optimization. |
| P2 | FIXED | Optional public proof counts queried DB on every configured visit. Counts now use a 60-second, email-keyed server cache and return null on failure; authentication/report data are not cached publicly. Production latency benefit is not measured here. |
| P2 | FIXED | Timezone dropdowns implied permanent standard time (Sydney AEST, Calgary MST). Labels now identify both standard/daylight names while preserving the intentional picker catalogue. Invalid placeholders/fixed offsets are rejected by client validation before they can break report generation. |
| P2 | FIXED | Five unused Next scaffold SVGs removed after reference search. They were not downloaded by pages; no speed gain is claimed from deleting them. |
| P2 | FAIL (baseline) | Repository-wide lint is not clean: baseline 22 errors / 102 warnings; initial changed run 22 errors / 101 warnings. Existing hook-effect rules and unrelated code need a separate cleanup. New analytics/currency/verifier modules pass scoped lint. |
| P2 | NEEDS ACCESS | Actual ownership/availability of configured social profile URLs and third-party YouTube assets. Network-restricted external thumbnails are not treated as proven production failures. |

## 4. Crawlability, canonical and content findings

- **PASS (local):** sitemap XML validation, exactly 14 registered absolute production URLs, no auth/token/placeholder aliases, robots reference, unique titles/descriptions, one server-rendered H1 per sitemap route, canonical consistency, valid embedded JSON-LD, and links to every registered public document.
- **FIXED:** `/download` now 308 redirects to `/help/download`; www host requests 308 redirect to `https://nextreport.in/...`. Next retains trailing-slash normalization. HTTP→HTTPS at Vercel remains **NEEDS ACCESS**, not locally claimed.
- **PASS:** tracking/query variants use the page canonical. No pagination/filter indexable templates or multiple regional URL sets exist, so pagination/hreflang work is **NOT APPLICABLE**.
- **PASS:** login/signup/reset utilities and shared client reports are not sitemap content. Private routes have noindex defenses; robots is not an authentication mechanism.
- **FIXED:** the design-preview route remains deliberately noindex/excluded. Placeholder case studies remain public examples, explicitly noindex until genuine customer evidence is approved.
- **PASS:** primary text, navigation and conversion links are in server HTML; baseline and updated public templates did not depend on delayed JS for their H1/content.
- Sitemap generation follows the explicit route registry at build/revalidation. New public routes must be added to that registry and linked; there is no CMS content feed to auto-discover. Omitted lastmod is preferable to a fabricated deployment/request timestamp. Google ignores sitemap priority/changefreq as ranking controls.

## 5. Route-level matrix

Every page route is listed below. Four framework utility routes (`/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/favicon.ico`) also return 200 locally and are inventoried in the JSON; they are not HTML sitemap pages. All 77 API routes, file locations and classifications are individually recorded in [SEO_ROUTE_MATRIX.json](SEO_ROUTE_MATRIX.json). Private/account routes were inspected in code, not traversed using an authenticated production account. Local alias status in the browser table follows redirects; the verifier separately confirms the initial 308.

| Route | Classification | Sitemap | Local evidence |
|---|---|---|---|
| `/account` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/admin/metrics` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/admin/support` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/billing` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients/[id]/edit` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients/[id]` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients/[id]/reports/[reportId]/copy` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients/[id]/reports/new` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients/[id]/reports` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients/[id]/reports/website/new` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients/new` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/clients` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/support` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/about` | Indexable public | Yes | 200 |
| `/book-demo` | Indexable public | Yes | 200 |
| `/case-studies` | Placeholder examples (noindex) | No | 200 |
| `/contact` | Indexable public | Yes | 200 |
| `/dashboard` | Private / authenticated workspace | No | Code inspection; authenticated/live check needed |
| `/data-deletion` | Indexable public | Yes | 200 |
| `/download` | Permanent redirect to /help/download | No | 200 |
| `/feedback` | Indexable public | Yes | 200 |
| `/forgot-password` | Authentication utility (noindex) | No | Code inspection; authenticated/live check needed |
| `/help/download` | Indexable public | Yes | 200 |
| `/help/metrics` | Indexable public | Yes | 200 |
| `/help/objectives` | Indexable public | Yes | 200 |
| `/how-it-works` | Indexable public | Yes | 200 |
| `/light-preview` | Design utility (noindex) | No | Code inspection; authenticated/live check needed |
| `/login` | Authentication utility (noindex) | No | Code inspection; authenticated/live check needed |
| `/` | Indexable public | Yes | 200 |
| `/pricing` | Indexable public | Yes | 200 |
| `/privacy` | Indexable public | Yes | 200 |
| `/r/[token]` | Client-token view (public read-only, noindex) | No | Code inspection; authenticated/live check needed |
| `/refer` | Indexable public | Yes | 200 |
| `/reset-password` | Authentication utility (noindex) | No | Code inspection; authenticated/live check needed |
| `/signup` | Authentication utility (noindex) | No | Code inspection; authenticated/live check needed |
| `/terms` | Indexable public | Yes | 200 |
| `/verify-email` | Authentication utility (noindex) | No | Code inspection; authenticated/live check needed |
## 6. Structured data / search appearance / sitelinks

| Check | Status / evidence |
|---|---|
| Organization, WebSite, SoftwareApplication | PASS in source and local HTML JSON parsing; organization/site names, domain/logo/support email match existing site configuration. No invented review or rating. |
| Offer prices | PASS against `plan-pricing.ts`: Agency/starter INR 799 / USD 9 monthly catalogue. INR and USD are actual offered billing choices. |
| FAQ | Pricing FAQ content corresponds to visible questions; removed an unrendered How-It-Works FAQ schema block. Corrected a stale unlimited-client claim and the outdated 4 MB-only upload wording. This is **not** a claim of Google FAQ rich-result eligibility; FAQ rich results are generally restricted to authoritative government/health sites. |
| HowTo | Existing step markup is semantic structured data; Google retired HowTo rich results. No ranking/rich-result promise is made. |
| Software rich-result eligibility | NEEDS ACCESS / external Rich Results validation. No ratings/reviews are fabricated to satisfy eligibility. Valid Schema.org markup alone does not qualify a page for every Google presentation. |
| BreadcrumbList | Existing pricing/how-it-works hierarchy now has matching visible breadcrumb navigation. |
| Article / Product ecommerce / LocalBusiness | NOT APPLICABLE unless genuine articles, ecommerce products or a customer-facing local business are introduced; no speculative types/address facts added. |
| Site name / favicon / OG | PASS code/local: explicit site identity, favicon variants, public OG image; graphite social asset. External sharing/debugger fetch requires live access. |
| Sitelinks | Descriptive crawlable main/footer/help links, canonicals and hierarchy support discovery. **Google selects sitelinks algorithmically; they cannot be manually enabled or guaranteed.** |

Official follow-up references (network-blocked here, not presented as fetched validation):
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- https://developers.google.com/search/docs/appearance/structured-data/software-app
- https://developers.google.com/search/docs/appearance/sitelinks

## 7. Mobile, performance and backend evidence

Lighthouse 13.6.0, local `next build` + `next start`, Chromium, fresh lab runs. The comparison uses the final three idle mobile runs (99, 99, 98; median 99) and the final desktop run. A shared-machine busy run scored 96; all runs are retained in the evidence JSON. These are **not production measurements, not CrUX p75, and not a field INP measurement**. Timing variation between individual lab runs is normal.

| Profile | Performance before → after | Accessibility before → after | SEO | LCP before → after | TBT before → after | CLS before → after |
|---|---|---|---|---|---|---|
| Mobile | 98 → 99 | 93 → 100 | 100 → 100 | 1.1s → 1.0s | 130ms → 131ms (median) | .049 → .049 |
| Desktop | 100 → 100 | 93 → 100 | 100 → 100 | .3s → .3s | 10ms → 10ms | .025 → .025 |

Mobile TBT varies by lab run; the final idle median is about 131ms versus a 130ms single-run baseline. The 230ms busy-run result is retained as well. Neither TBT nor a Lighthouse score is used as a substitute for field INP. GA was not configured for these Lighthouse runs; real consented-vendor workload also requires production checks. Evidence summary: [SEO_PERFORMANCE_EVIDENCE.json](SEO_PERFORMANCE_EVIDENCE.json).

48 browser combinations: homepage, pricing, CSV guide, contact, demo and how-it-works; widths 320/390/768/1440; dark/light. No horizontal overflow or browser exceptions; mobile menu interaction checked. Third-party video thumbnails remain subject to blocked external networking here; local image/frame structure is present. Public document audit separately covered all 14 sitemap pages, the placeholder, alias and missing route.

Existing useful optimizations preserved: next/font self-hosted Inter/Geist, hashed static assets, lazy click-to-play video iframes, code splitting, cached parsed uploads/previews and bounded report work. The `.next/cache` directory is development/build/image acceleration state (about 1.6GB in this long-lived workspace), not an automatically downloaded public payload. Purging it would make cold rebuilds/repeat processing slower. No uploads, generated reports, user data, templates or production caches were deleted. Sample PPTX is fetched on explicit download, not a page-load dependency.

Root layout reads the visitor's edge country; public HTML is request-dependent, so indiscriminate full-page caching would risk wrong geography/session content. Only non-sensitive optional proof counts received a short server cache. Production TTFB, regional DB/Vercel latency, CDN headers and field CWV (LCP ≤2.5s, INP ≤200ms, CLS ≤.1 at p75) remain NEEDS ACCESS.

## 8. Pricing, CSV currency, timezone and report output

- **PASS / FIXED:** country IN defaults INR; every other country maps USD. Browser tests with IN/US/AU/GB/CA/FR/NZ/BR verified correct selection, no hydration errors, and no redundant ipapi requests even with cached India. A deliberate currency-selector choice still overrides defaults.
- **FIXED:** financial CSV headers (e.g. `Amount spent (AUD)`) and account-currency columns provide ISO evidence. USD, AUD, INR, CAD, EUR and JPY are regression-covered; supported ISO currencies beyond the client dropdown display an explicit code prefix rather than a guessed symbol. Meta `CPC (all)` is not mistaken for Albanian lek (`ALL`).
- **PASS:** a bare `$` is ambiguous. If no ISO evidence exists, the configured client currency is the fallback. No currency or timezone is inferred from the operator's country/campaign name. No monetary amounts are converted.
- **FIXED:** currency is retained through analyze/resume, standard/other report preview/generation, reconciliation, job serialization and standard PPT rendering/share extras. Mixed primary/previous-period currencies are rejected in standard/comparison assembly. The upload validator rejects mixed account-currency exports.
- **PASS:** an INR client with AUD input produces `A$150` in real PPT slide XML and no rupee content in that regression deck. INR budget pacing is disabled for that mismatched report, never relabelled as AUD.
- **PASS:** the supplied Southaven CSV still parses/validates with 67,914 rows and USD detection; it is not committed as a new fixture.
- **PASS:** client IANA timezone drives calendar today/yesterday, presets and accounting. At `2026-11-03T15:30Z`, yesterday is Nov 2 in Kolkata and Nov 3 in Sydney. The Sydney DST transition is also covered. Date-only labels use explicit UTC formatting to avoid a browser-zone date shift.
- **NEEDS MANUAL CONFIGURATION:** the client workspace timezone must match the ad account. CSVs without timezone metadata cannot reveal it reliably. An Indian operator reporting an Australian account should choose its actual Australian timezone; Australia has several zones. Daylight/standard labels were clarified without changing timezone values.

## 9. GA4 and GSC status

See [ANALYTICS_EVENT_PLAN.md](ANALYTICS_EVENT_PLAN.md). Local production-mode tests use a dummy GA ID and intercepted vendor script: no tag before opt-in, one vendor/config across a public SPA navigation, persisted decline, withdrawal, initial query redaction and UTM allowlist. These do **not** prove events arrive in GA4 or confirm the real stream's Enhanced Measurement configuration. Private-route disable logic is tested; actual vendor/account behavior around SPA history must be reviewed in DebugView before production measurement is certified. No duplicate manual page_view/event layer was installed.

GSC verification metadata is supported through an optional env name. No DNS record, HTML-file ownership, confirmed property access, sitemap submission, indexing status, Search performance, manual action, security issue or GA4/GSC link has been verified in an account. No Google account changes, indexing submissions, external messages or production deployments were performed.

## 10. Validation / remaining work / priority

- PASS: production build and TypeScript; focused audit/validator/generation-guard tests (89); reporting accuracy (493); report choices (279); API route suite (44); objective regression (69). Suites overlap; do not add them as a unique-test count.
- PASS: `SEO_BASE_URL=http://localhost:3100 npm run verify:seo` (24 groups); real browser geography/consent checks; responsive checks above.
- FAIL (baseline): repository-wide lint is not clean. The isolated unchanged baseline also has 22 errors; scoped new analytics, currency and SEO-verifier lint passes. This is disclosed rather than rewriting unrelated effects/modules to obtain a green badge.
- NEEDS ACCESS: production HTTP/CDN/Googlebot/HTTPS behavior, actual Google ID, GA4 delivery/settings and Search Console reports, external schema testing, production performance/CrUX and third-party thumbnails/social ownership.

Priority next steps: (1) review/merge these code changes; production deployment remains an owner-approved action, (2) run `verify:seo` and PageSpeed/Rich Results tests from a network-permitted environment after deployment, (3) owner verifies GSC and submits the production sitemap, (4) validate GA4 consent/Enhanced Measurement and configure key events only after their triggers exist, (5) monitor real CWV and regional TTFB over sufficient traffic, (6) separate cleanup of existing lint debt and replace placeholder studies only with approved evidence.

## Files changed and rationale

| File | Why |
|---|---|
| `.env.example` | Document optional search-verification configuration names without values. |
| `ANALYTICS_EVENT_PLAN.md` | Audit evidence, route classification, implementation hand-off or analytics plan. |
| `SEO_AUDIT.md` | Audit evidence, route classification, implementation hand-off or analytics plan. |
| `SEO_IMPLEMENTATION_CHECKLIST.md` | Audit evidence, route classification, implementation hand-off or analytics plan. |
| `SEO_PERFORMANCE_EVIDENCE.json` | Audit evidence, route classification, implementation hand-off or analytics plan. |
| `SEO_ROUTE_MATRIX.json` | Audit evidence, route classification, implementation hand-off or analytics plan. |
| `next.config.ts` | Canonical www redirect; private/preview noindex headers; explicit slash normalization. |
| `package.json` | Reusable test:seo and verify:seo commands. |
| `public/file.svg` | Remove unreferenced framework scaffold SVG; no runtime speed gain claimed. |
| `public/globe.svg` | Remove unreferenced framework scaffold SVG; no runtime speed gain claimed. |
| `public/next.svg` | Remove unreferenced framework scaffold SVG; no runtime speed gain claimed. |
| `public/vercel.svg` | Remove unreferenced framework scaffold SVG; no runtime speed gain claimed. |
| `public/window.svg` | Remove unreferenced framework scaffold SVG; no runtime speed gain claimed. |
| `scripts/verify-seo.ts` | HTTP/indexability/schema/metadata/internal-link/canonical/404 CI checks. |
| `src/app/(dashboard)/layout.tsx` | Authentication and noindex defenses for every dashboard-group route. |
| `src/app/api/clients/[id]/reports/analyze/route.ts` | Propagate CSV currency through preview/generation/resume; reject incompatible previous-period currency. |
| `src/app/api/clients/[id]/reports/preview/route.ts` | Propagate CSV currency through preview/generation/resume; reject incompatible previous-period currency. |
| `src/app/api/clients/[id]/reports/route.ts` | Propagate CSV currency through preview/generation/resume; reject incompatible previous-period currency. |
| `src/app/api/clients/[id]/reports/upload-session-context/route.ts` | Propagate CSV currency through preview/generation/resume; reject incompatible previous-period currency. |
| `src/app/case-studies/page.tsx` | Explicit noindex/self-canonical for labelled placeholder examples. |
| `src/app/download/page.tsx` | 308 canonical guide alias. |
| `src/app/how-it-works/page.tsx` | Visible breadcrumb matching existing schema; remove FAQ markup for questions not rendered on that page. |
| `src/app/opengraph-image.tsx` | Match graphite brand palette. |
| `src/app/pricing/page.tsx` | Visible breadcrumb matching existing schema. |
| `src/app/privacy/page.tsx` | Accurate authentication/preferences/optional analytics disclosure. |
| `src/app/robots.ts` | Preview crawl exclusion; allow placeholder noindex to be fetched. |
| `src/app/sitemap.ts` | Remove invented last-modification timestamps. |
| `src/components/breadcrumbs.tsx` | Shared visible hierarchy for schema-backed public pages. |
| `src/components/google-analytics.tsx` | Optional consent, withdrawal, one deferred tag, ID validation, public-route guard and sanitized initial parameters. |
| `src/components/home/lead-capture-section.tsx` | Fix measured tap targets or inline link distinguishability. |
| `src/components/home/product-explainer-animation.tsx` | Fix measured tap targets or inline link distinguishability. |
| `src/components/home/report-preview-section.tsx` | Fix measured tap targets or inline link distinguishability. |
| `src/components/json-ld.tsx` | Escape script-closing content safely. |
| `src/components/pricing-currency-provider.tsx` | Hydration-stable country default, preference handling, no duplicate geo request when edge country exists. |
| `src/components/public-nav.tsx` | Responsive optimized logo and 44px mobile menu target. |
| `src/components/report-upload-wizard/use-report-upload-wizard.ts` | Retain source report currency on analyze/resume; suppress mismatched budget preview. |
| `src/components/wizard-preview-carousel.tsx` | Enlarge carousel dot hit areas without enlarging visible dots. |
| `src/lib/__tests__/analytics-readiness.test.ts` | Regression coverage for the audited behavior; update obsolete daylight-label assertion. |
| `src/lib/__tests__/currency.test.ts` | Regression coverage for the audited behavior; update obsolete daylight-label assertion. |
| `src/lib/analytics.ts` | Public analytics route allowlist, Measurement ID syntax and UTM/query sanitization. |
| `src/lib/currency.ts` | Current edge country outranks cached country; explicit preference preserved. |
| `src/lib/nre/__tests__/csv-currency-timezone.test.ts` | Regression coverage for the audited behavior; update obsolete daylight-label assertion. |
| `src/lib/nre/calculation-context.ts` | Invalidate stale preview/accounting snapshots after currency behavior change. |
| `src/lib/nre/csv-currency.ts` | Explicit ISO detection, ambiguous fallback, mixed-currency rejection and unambiguous formatting. |
| `src/lib/nre/report-data.ts` | Currency snapshot field for background jobs/rendering. |
| `src/lib/nre/report-engine/build-standard-from-wizard.ts` | Source-currency assembly, previous-period compatibility and budget-currency safety. |
| `src/lib/nre/report-generation-job.ts` | Render/share from snapshot currency rather than a later client default. |
| `src/lib/nre/validate.ts` | Reject mixed/invalid explicit currency evidence before report work. |
| `src/lib/nre/wizard-csv-verification.ts` | Reconcile using source currency. |
| `src/lib/quality-agents/generation-guard.ts` | Verify generated data against the same source-currency basis. |
| `src/lib/seo.ts` | Complete public route registry, remove speculative hreflang, graphite theme metadata. |
| `src/lib/site-links.ts` | Crawlable footer links to metric/objective guides. |
| `src/lib/social-proof-stats.ts` | 60-second cache/failure isolation for optional public DB aggregates. |
| `src/lib/validators/__tests__/client.test.ts` | Regression coverage for the audited behavior; update obsolete daylight-label assertion. |
| `src/lib/validators/client.ts` | Accurate standard/daylight timezone labels and real timezone validation. |
| `src/proxy.ts` | Expose real public guides/OG/alias, retain protected namespaces, allow genuine unknown-document 404s. |
| `src/lib/pricing-faq.ts` | Correct public/schema FAQ upload-size wording to match bounded CSV compression. |
| `src/lib/__tests__/seo-auth-boundary.test.tsx` | Verify dashboard authentication before any private lookup. |

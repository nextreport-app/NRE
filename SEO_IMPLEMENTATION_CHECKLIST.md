# SEO and implementation checklist

4 November 2026. Status applies to the repository/local production build unless marked otherwise. **Not deployed.** Full evidence and route inventory: `SEO_AUDIT.md`, `SEO_ROUTE_MATRIX.json`.

## Completed

- [x] Inventory framework, hosting, CMS absence, canonical domain, 37 document routes, 77 API handlers and four metadata/asset routes.
- [x] Inspect existing metadata, sitemap, robots, schema, analytics, authentication and geo handling before edits.
- [x] Keep production canonical origin HTTPS/non-www; add permanent www redirect and private/preview indexing defenses.
- [x] Keep 14 legitimate public sitemap URLs; include metric/objective guides; omit fabricated lastmod.
- [x] Make guides and OG image public; preserve auth protection of known private/API namespaces.
- [x] Give missing documents genuine 404s and `/download` a 308 to the canonical guide.
- [x] Mark explicitly placeholder case studies noindex; keep out of sitemap; let crawlers read that directive.
- [x] Verify public HTML titles/descriptions/H1/canonicals, JSON parsing and internal links locally.
- [x] Escape JSON-LD script-closing content; preserve factual schema without invented ratings or customer evidence.
- [x] Remove FAQ schema for unrendered questions and correct stale client-limit/upload-size claims.
- [x] Add visible breadcrumbs to match existing pricing/how-it-works schema; remove speculative duplicate hreflang.
- [x] Fix measured mobile tap targets/link distinction/logo delivery; check 48 responsive combinations.
- [x] Record Lighthouse mobile/desktop before/after; distinguish lab TBT from field INP.
- [x] Preserve useful Next/CSV/preview caches; cache optional proof counts for 60 seconds; remove only five unused scaffold SVGs.
- [x] India pricing default INR; current non-India country default USD; retain deliberate preference override.
- [x] Detect explicit CSV currency without FX conversion; reject mixed currencies; retain currency in jobs/PPT.
- [x] Disable mismatched-currency budget pacing; verify AUD output using real PowerPoint XML.
- [x] Check India/Sydney today/yesterday and DST; clarify timezone labels; validate IANA settings and reject invalid placeholders/fixed offsets.
- [x] Optional GA consent/withdrawal; one tag/config across tested public SPA navigation, sanitized initial location, no new manual duplicate page_view layer.
- [x] Update cookie-policy wording and document account-dependent analytics validation/event plan.
- [x] Production build, TypeScript, relevant automated suites and reusable `verify:seo` pass.
- [x] Disclose existing repository lint failures (22 errors also occur on isolated unchanged baseline).
- [x] No Google account changes, messages, production purge or deployment performed.

## Owner / network-permitted follow-ups (NEEDS ACCESS)

- [ ] Review and merge the branch; approve/perform production deployment.
- [ ] Confirm Vercel production environment/domain mapping and HTTP→HTTPS/www/trailing-slash behavior externally.
- [ ] Open `https://nextreport.in/robots.txt` and `/sitemap.xml` unauthenticated; verify origin status, content types and canonical links after deploy.
- [ ] Run `SEO_BASE_URL=https://nextreport.in npm run verify:seo` from permitted networking. A workspace tunnel 403 is not origin failure evidence.
- [ ] Use Rich Results Test / Schema Markup Validator. Do not promise FAQ/HowTo/software rich eligibility merely because JSON parses.
- [ ] Configure and publish GTM-PZPXTRPH with the intended GA4 stream, consent requirements and custom page-view trigger described in ANALYTICS_EVENT_PLAN.md. Disable duplicate automatic page/form measurement.
- [ ] Check actual GA requests, consent decline/accept/withdrawal, initial page_view and public SPA navigation in DebugView/Realtime.
- [ ] Review Enhanced Measurement history and form settings for duplicates/private route/query exposure; inspect redaction before certifying measurement.
- [ ] Use synthetic public form submissions only with approval; confirm success-triggered business events exist before marking them key events.
- [ ] Configure owner-approved retention/internal-traffic filtering, unwanted payment referrals and controlled cross-domain measurement as applicable.
- [ ] Verify the GSC Domain property (DNS) or correct HTTPS URL-prefix property. An env token is not proof of ownership.
- [ ] Submit the canonical sitemap in GSC, inspect Home/Pricing/CSV guide, and review Page indexing, Crawl stats, manual actions and security reports.
- [ ] Link GA4/GSC with appropriate owner/editor access; verify property/stream match.
- [ ] Measure production mobile/desktop PageSpeed plus CrUX/GSC field CWV at p75 (LCP ≤2.5s, INP ≤200ms, CLS ≤.1). Field data may need a sufficient traffic window.
- [ ] Check third-party video thumbnails/playback and configured social profile ownership from an unrestricted browser.
- [ ] Verify authenticated production wizard/report workflows with representative AU/IN/US accounts and their real ad-account timezones. CSVs without ISO currency/timezone evidence require correct client settings.
- [ ] Fix unrelated lint debt in its own review; do not silence the repository wholesale.

## Reusable validation

```sh
npm run test:seo
npx tsc --noEmit
# Local disposable PostgreSQL and required build configuration must be available.
npm run build
PORT=3100 npm run start
# In another terminal:
SEO_BASE_URL=http://localhost:3100 npm run verify:seo
```

`verify:seo` checks HTTP documents, robots/sitemap, canonical host routing, unique metadata, H1/indexability, schema parsing, internal-link reachability, public social image, redirect and 404 contracts. The event plan identifies account checks these commands cannot perform. Do not point billing/report-generation tests at real customer accounts or send data to a real GA property during CI.

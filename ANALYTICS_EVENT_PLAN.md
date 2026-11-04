# GA4 tag audit and event plan

4 November 2026. **No GA4/GSC account access, production ID inspection or live event delivery verification was available.** `GA4_CLIENT_ID` is the OAuth reporting connector; `GA_MEASUREMENT_ID` is the website measurement tag. They are different integrations.

## Current implementation and verified boundaries

- One `GoogleAnalytics` component in root layout, only rendered when `GA_MEASUREMENT_ID` exists. The ID must match `G-…` syntax; syntax validation is not property verification.
- Vendor and config scripts load `lazyOnload` **after optional analytics consent** on allowlisted marketing/help routes. No separate GTM container/manual event bus was found.
- Explicit consent is persisted as `nre.analytics-consent.v1`; unavailable storage falls back to the current session. Analytics preferences permits withdrawal. Session/auth preferences remain independent.
- Advertising storage, ad user data/personalization and Google signals are disabled in the config. Private/auth/client-token routes are not initial tracking routes; a route-level `ga-disable-*` guard is applied.
- Initial page_location keeps only allowlisted slug-like UTM values; arbitrary queries, email/token/callback parameters, form contents, client names, uploaded CSV data and report tokens are not intentionally passed. Initial referrer is reduced to its origin.
- **No manual SPA page_view was added.** Initial config uses normal GA page_view behavior. Subsequent history events depend on the stream's Enhanced Measurement settings, which require account inspection. Do not add a second route-event listener without first disabling the overlapping automatic history behavior.
- Production-mode local browser test with a dummy ID and intercepted vendor responses: no load before consent, exactly one vendor request/config across a public SPA navigation, query redaction, valid UTM preservation, persisted denial and withdrawal. No real Google measurement event was sent.
- Actual Enhanced Measurement timing/URL behavior on private SPA transitions, form autocapture, delivery, cookies and account redaction still need browser Network + DebugView validation with owner access. Code tests are not proof that the real property is collecting accurately or privately.

## Event inventory / proposed implementation contract

Business events below are a plan, **not falsely reported as implemented**. Implementing them should be a separate reviewed change with consent, actual successful state and deduplication tests. Do not infer a conversion from a button click alone.

| Event | Current status | Trigger / allowed parameters | Deduplication | Key event recommendation |
|---|---|---|---|---|
| `page_view` | Config-installed initial view; SPA/account NEEDS ACCESS | Initial allowed public page and Enhanced Measurement history; sanitized page URL, page_title, origin-only referrer | One GA install/config; no second manual view listener | No |
| `generate_lead` | Planned | Confirmed successful contact/demo lead response; fixed `form_id`, `lead_type`; no free text/name/email/phone | Server-issued submission ID, one success per accepted submission | Yes, once implemented and validated |
| `form_submit` | Account Enhanced Measurement NEEDS ACCESS; no custom duplicate | Only genuine allowed public form success if custom measurement is chosen; fixed `form_id` | Disable overlapping auto-form event or keep just one source; never also count the same action as two independent conversions | Usually no when `generate_lead` is the conversion |
| `sign_up` | Planned | Successful first account creation, including first OAuth registration; `method` = email/google | Account creation event ID; never every login/verification reload | Yes for qualified trial signup after validation |
| `login` | Planned | Successful authentication; fixed `method` only | One authentication success ID; no user email or callback/token URL | No |
| `begin_checkout` | Planned | Actual checkout session/subscription handoff created successfully; `currency` = billing INR/USD, catalogue `value`, `items` plan/interval | Stable checkout attempt ID; not every render/button retry | Optional funnel event, usually not a key event |
| `purchase` | Planned | Server-confirmed successful payment, never a return-URL query or unconfirmed client callback; `transaction_id`, settled billing `currency`, actual settled `value`, plan `items` | Authoritative unique payment ID / analytics delivery outbox with DB uniqueness; reload/webhook retries must not duplicate | Yes after payment and consent/dedup review |
| `search` | NOT APPLICABLE currently | No public site-search UI identified. **Do not instrument private campaign searches or send campaign names.** | N/A | No |
| `view_item`, `add_to_cart` | NOT APPLICABLE to current cartless SaaS flow | No storefront/cart found. A future plan-detail event needs genuine product context; do not invent cart actions. | N/A | No |
| `report_generated` (custom) | Planned/optional | Successful job completion; fixed report_type/platform only, with consent; never account/campaign names or report URLs | Unique job/report ID internally, not exposed as a share token | Product-usage event, not necessarily acquisition conversion |

Billing currency and CSV/report currency are separate: a customer may pay in USD and produce an AUD advertising report. Never send the CSV advertising spend as the website's purchase revenue.

## Google account settings requiring an owner

1. Confirm the production Measurement ID and correct web stream at `https://nextreport.in`; inspect tag history for any separately installed GTM container.
2. Review Enhanced Measurement: page loads/history, forms, outbound links, file downloads and site search. Choose automatic or manual page_view, not both. Validate single events on initial load, public SPA navigation, reload and back/forward.
3. Check **no private URL/token/query payload** leaves the browser, including an immediate public→private transition, consent withdrawal and enhanced automatic events. Use GA redaction/query settings where available; disable unsafe automatic options. This is a release-readiness follow-up, not a claimed pass.
4. Audit Realtime/DebugView with approved synthetic data; verify denied visitors emit no analytics requests before acceptance. Include cookie/storage-blocked and cross-tab consent cases.
5. Review unwanted payment referrals based on the real checkout flow. Use cross-domain tracking only for genuinely controlled domains; do not automatically treat an unrelated gateway as an owned domain.
6. Configure internal/developer traffic filters in testing mode first, retention according to policy, applicable privacy/consent settings, and key events only after implementation is observed. Do not mark every page_view/login/form event as a conversion.
7. Validate UTM attribution from actual acquisition links without PII. This implementation retains only short slug-like allowlisted values, so unusual free-text UTM values are deliberately dropped.
8. Owner-approved GA4/GSC product linking and account/property permissions are manual actions. No account settings were changed in this audit.

## Search Console hand-off

Prefer a Domain property for `nextreport.in` where DNS ownership is available; otherwise use the exact HTTPS URL-prefix property. Optional `GOOGLE_SITE_VERIFICATION` metadata is supported, but a configured token is not confirmation. After deployment, submit `https://nextreport.in/sitemap.xml`, inspect the primary landing pages, and review indexing/crawl/security/manual-action/CWV reports. Google determines indexing, rankings and sitelinks; none can be certified from a passing local test.

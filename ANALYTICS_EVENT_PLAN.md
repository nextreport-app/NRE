# GA4 tag audit and event plan

4 November 2026. No GA4/GTM/GSC account access or real event delivery verification is available.

## Current implementation and GTM setup required

- Root head initializes dataLayer and Consent Mode with all storage denied. After analytics opt-in on public routes, one standard GTM loader installs **GTM-PZPXTRPH** in head. The old direct GA4 loader has been replaced; GA_MEASUREMENT_ID no longer installs a website tag. GA4_CLIENT_ID remains a separate reporting connector.
- Consent preferences persist locally and can be withdrawn. No vendor request before opt-in; private/auth/client-report routes do not initiate the container. No consent-bypassing noscript iframe is installed.
- Public navigation emits `nre_public_page_view` with sanitized page_location, page_path, page_title and origin-only page_referrer. Private routes emit no page events and reset analytics consent to denied. Existing loaded containers cannot be unloaded; container configuration must respect these restrictions.
- In GTM, configure the intended GA4 Google tag with `send_page_view=false`. Disable GA4 Enhanced Measurement history/page changes and form capture to avoid duplicate views and private URL collection. Do not use All Pages/history triggers for measurement.
- Create a Custom Event trigger for `nre_public_page_view`, and one GA4 `page_view` event tag using data-layer page_location, page_title and page_referrer values. Use the Google tag as the event tag’s setup tag (once per page), so initial queued page views have their configuration ready. Require analytics_storage consent on analytics tags; no advertising tags are authorized. Check other existing container tags before publishing.
- Publish the container only after Tag Assistant/Preview verifies one page_view per public navigation, none before opt-in/on private routes, no raw sensitive URL fields, and withdrawal prevents further requests. Verify delivery in GA4 DebugView/Realtime. Container ID is not a GA4 Measurement ID.
- Code tests cannot verify the contents of the external container or account settings. Earlier direct-GA browser evidence applies to the audit baseline, not to this replacement GTM integration.

## Event inventory / proposed implementation contract

Business events below are a plan, **not falsely reported as implemented**. Implementing them should be a separate reviewed change with consent, actual successful state and deduplication tests. Do not infer a conversion from a button click alone.

| Event | Current status | Trigger / allowed parameters | Deduplication | Key event recommendation |
|---|---|---|---|---|
| `page_view` | GTM custom-event contract; account setup NEEDS ACCESS | Allowed public-page custom events; sanitized page URL, page_title, origin-only referrer | One GA install/config; no second manual view listener | No |
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

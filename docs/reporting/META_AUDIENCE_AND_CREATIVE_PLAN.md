# Meta audience and creative reporting

Import has six first-class choices: **Weekly, Monthly, Compare, Daily, Breakdown and Creative**. The legacy ad-name-based creative prototype remains disabled; the new Creative choice uses the validated content engine and stable Ad IDs.

## Workflow

Selecting **Breakdown** reveals only Age, Location, Placement and Platform. Location offers Region/state or Country. Selecting **Creative** prepares an ad-level report. Each choice shows only its own output and one source requirement. There is no audience/creative information wall or additional-section configuration in regular reports.

Both standalone choices use an explicit reporting period, one import, campaign selection, then Review & generate. They skip the unrelated standard metric-card step. API breakdown/ad data is prepared automatically on Review; CSV data is validated during Import. Failures offer retry without discarding the import. Changing report choice, dimension or source requires a fresh import. Creative ranking, ad selection and image replacement remain under a collapsed optional control; unapplied changes block generation.

Standalone outputs contain a cover, the selected breakdown/ad tables, available creative previews and the relevant metric guide. They do not add weekly, MTD, 30-day or previous-month slides. Dates never silently shift to fit a source.

### CSV

- Choose the report before importing. Upload one matching breakdown CSV or one Ads-level CSV. A mismatched dimension or location level is rejected with a return-to-Import instruction. Segmented sources are never used as an unsegmented standard baseline.
- Export a **Day breakdown** covering the entire selected period. The source must cover the exact dates; choose another period or re-export if it does not.
- Use separate Age and Region/Country exports. Platform + Placement may share one file or use separate files. Gender and arbitrary combined dimensions are not supported.
- Include Campaign name, Amount spent (currency), Impressions, Results and Result type. Add Clicks (all) for CTR/CPC, matching purchase conversion value for ROAS, and Landing page views for website CVR. IDs are checked against the primary import where supplied. Without account metadata/IDs, the user must export from the same account and timezone as the client.
- Audience files must use campaign level, or contain only one ad set per campaign. We reject multi-ad-set audience totals because attributed conversions can overlap. The supplied Age, Region and Platform/Placement examples are supported single-ad-set exports.
- Creative files require numeric **Ad ID** and Ad name. Choose Creative before uploading that Ads export. Names never identify media. Metrics-only creative reports are supported.
- Optional PNG/JPEG/WebP images are attached explicitly to displayed Ad IDs, below 2MB each. Reports support up to 24 small previews; all selected ads remain in the tables.
- Date coverage, duplicate facts, malformed values, currency, campaign scope and conflicting attribution settings are checked before an immutable upload session is saved. Settings reuse existing sources; uploads replace matching source types rather than adding duplicate observations.

### Meta API

Uses the existing read-only connection and the **account stored in the primary import session**. The request cannot substitute another ad account. Account currency/timezone must still match.

- Age: `age`; Location: `region` or `country`; Platform: `publisher_platform`; Placement: `publisher_platform,platform_position`.
- Separate compatible audience requests run at **campaign level**. Ad-set optimization events and attribution windows must be compatible within the campaign; conflicting windows across sources are rejected.
- Creative Insights run at `level=ad`, preserving IDs and using production configured-result/custom-conversion mapping.
- Insights use daily records, unified attribution, non-overlapping 28-day request chunks, cursor pagination and bounded transient retries. Absolute provider paging URLs are never followed. Oversized or incomplete requests fail clearly instead of silently truncating records.
- Representative images are requested for up to 12 ads with the highest spend. All selected ads remain in the performance tables. Missing/deleted media does not discard metrics; optional uploads remain available.
- JPEG snapshots are embedded in reports, not expiring CDN links. Downloads allow only validated HTTPS Meta image CDN hosts, bounded redirects/body/pixels and supported raster formats. Tokens use Authorization headers and are never stored in client media or share data.
- Videos use **poster images**, without embedded playback or a promised video link. Carousel/dynamic/catalog images represent the ad; they are not asset-level performance attribution.

## Calculations and presentation

Preview and generation independently reconcile each selected audience/creative table against its own source sums before credit reservation. Preview-image pages do not count again, and standard-performance checks remain enabled whenever those slides are included. Audience-only routing facts are not presented as an unsegmented baseline.

Each audience export is a separate view of the same delivery. **Never add totals across Age, Location, Platform and Placement.** Placement identity includes its platform, so Facebook Feed and Instagram Feed remain separate.

Rates use summed numerators/denominators, never averaged daily percentages: CTR (all) = all clicks / impressions; CPC = spend / all clicks; CPM = spend / impressions × 1,000. Cost per result uses production objective units. Daily reach, frequency and recall estimates are omitted from segment aggregation because unique audiences cannot safely be summed.

ROAS requires the purchase value matching the primary purchase action; alternative conversion aliases are not added. Website CVR = website results / landing-page views, only with that evidence. Instant forms do not receive a fabricated website conversion rate. Missing values remain unavailable; absent attributed-action fields on delivered API slices are not assumed to establish zero conversions. Unknown categories stay included. Privacy-suppressed metrics cannot be reconstructed.

Creative rankings stay within the same result objective and compatible attribution setting. Default eligibility is at least five results for cost/ROAS ranking; spend/results thresholds are configurable. CTR ranking also requires 100 impressions. Ineligible ads remain visible without a rank. No generic winner or fatigue claims are generated. Short summaries are deterministic statements grounded in the presented source metrics.

All selected rows are paginated, eight per table page. Available previews get separate pages. Browser and native editable PPTX share metrics/formatters, including dark/light layouts. The existing Google Slides export uses that PPTX. Browser editing supports new section titles, notes and visibility while preserving source metrics and the existing browser-only publishing boundary. Downloaded PowerPoint and saved Google Slides remain editable in their respective apps.

Limits: 100,000 observations per source, 500 additional pages, bounded embedded media/share payload. Errors retain the previous wizard setup. Sources remain in owned, expiring upload sessions; media included in generated reports follows existing report retention.

## Validation and release checks

Automated coverage includes independent sources, weighted rates, zero/missing values, custom objective units, purchase-value scope, stable ad IDs, pagination, selected ads, unknown categories, date/currency/scope/duplicate guards, mixed attribution, API request identity/chunking/pagination/retries, unsafe image URLs, raster snapshots, upload ownership, immutable sessions, first-class source selection, exact dates, browser editing and dark/light PPTX media.

The three supplied private exports were checked separately against independent Decimal totals: each has **$755.38 / 25 leads** for Oct 19–Nov 17, 2026 and **$180.91 / 6 leads** for Nov 11–17. All four rendered audience views preserve these independent totals, without multiplying baseline spend. These lead exports lack all-click counts/purchase value, so CTR/ROAS remain unavailable. The actual audience-first import/build/PPTX path was exercised locally; customer files are not committed.

PPTX layouts are rendered through LibreOffice and browser flows checked at desktop/mobile sizes. API capability/error behavior is tested with mocks. **A real connected-account check against the pinned Graph API version remains necessary before announcing API/media availability broadly**: confirm permissions and available breakdown/action metrics, region/country, image/video/carousel/dynamic previews, historical/deleted ads and rate limiting. Missing media remains metrics-only; unsupported conversion/window combinations produce an actionable error. SDK field names alone do not establish availability on every account.

References: [Insights breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/), [Ad Creative](https://developers.facebook.com/docs/marketing-api/reference/ad-creative/), [official SDK](https://github.com/facebook/facebook-python-business-sdk/tree/main/facebook_business/adobjects).

## Persistence and deployment

Saved reports are classified as `BREAKDOWN` or `CREATIVE`, with matching titles in history, browser reports, PPTX filenames and cover slides. Apply migration `20261119000100_add_breakdown_report_type` during deployment. The standard generation job carries an owned `reportSelection` and runs the content engine; its internal date-routing report type remains WEEKLY for compatibility. This does not enable the deferred legacy CREATIVE generator.

New source normalization preserves zero-result spend when a blank Result type can be resolved from a single explicit event in the same campaign/ad-set scope. Positive results without an event remain invalid, and missing/suppressed metrics remain unavailable. Report engine version v28 invalidates prior generated-data caches.

November 19 workflow verification: 375 test files passed (3,391 tests; 22 environment-dependent tests skipped), plus focused content/ownership and generation/notification checks. TypeScript and the production webpack build passed. Browser checks exercised CSV Breakdown, CSV Creative, API Breakdown and API Creative from Import through the final screen, desktop/mobile layouts, API retry, back navigation, unapplied creative options and stale-import clearing after type/dimension/source changes. API responses were mocked; no live Meta requests or notifications were sent. Synthetic source totals were reconciled through the real report builder, browser output and native PPTX.

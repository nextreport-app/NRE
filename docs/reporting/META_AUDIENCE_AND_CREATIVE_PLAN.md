# Meta audience and creative reporting

Implemented for Weekly, Monthly and multi-month reports. Compare and Daily keep their existing workflow; audience/creative sections are not offered for those report types yet. The legacy ad-name-based creative prototype remains disabled.

## Workflow

Keep the four report/date choices. In **Review & generate**, expand **Audience & creative sections** only when needed. Choose Age, Location, Platform, Placement and/or Creative performance, then apply the sections. Standard performance can remain included or be switched off. Unsaved section changes block generation until applied or discarded.

### CSV

- Start with a normal daily export, then attach audience/Ads exports in the optional panel. Alternatively, upload an audience export first: Import detects it and starts an audience-only report automatically. Standard performance stays off because a segmented source is not an unsegmented baseline.
- Export a **Day breakdown** covering the selected reporting dates. Weekly audience/creative sections describe the selected week; existing standard slides still provide MTD and the 30-day chart when included.
- Use separate Age and Region/Country exports. Platform + Placement may share one file or use separate files. Gender and arbitrary combined dimensions are not supported.
- Include Campaign name, Amount spent (currency), Impressions, Results and Result type. Add Clicks (all) for CTR/CPC, matching purchase conversion value for ROAS, and Landing page views for website CVR. IDs are checked against the primary import where supplied. Without account metadata/IDs, the user must export from the same account and timezone as the client.
- Audience files must use campaign level, or contain only one ad set per campaign. We reject multi-ad-set audience totals because attributed conversions can overlap. The supplied Age, Region and Platform/Placement examples are supported single-ad-set exports.
- Creative files require numeric **Ad ID** and Ad name. A normal primary Ads export with those columns can be reused. Names never identify media. Metrics-only creative reports are supported.
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

Automated coverage includes independent sources, weighted rates, zero/missing values, custom objective units, purchase-value scope, stable ad IDs, pagination, selected ads, unknown categories, date/currency/scope/duplicate guards, mixed attribution, API request identity/chunking/pagination/retries, unsafe image URLs, raster snapshots, upload ownership, immutable sessions, audience-first import, browser editing and dark/light PPTX media.

The three supplied private exports were checked separately against independent Decimal totals: each has **$755.38 / 25 leads** for Oct 19–Nov 17, 2026 and **$180.91 / 6 leads** for Nov 11–17. All four rendered audience views preserve these independent totals, without multiplying baseline spend. These lead exports lack all-click counts/purchase value, so CTR/ROAS remain unavailable. The actual audience-first import/build/PPTX path was exercised locally; customer files are not committed.

PPTX layouts are rendered through LibreOffice and browser flows checked at desktop/mobile sizes. API capability/error behavior is tested with mocks. **A real connected-account check against the pinned Graph API version remains necessary before announcing API/media availability broadly**: confirm permissions and available breakdown/action metrics, region/country, image/video/carousel/dynamic previews, historical/deleted ads and rate limiting. Missing media remains metrics-only; unsupported conversion/window combinations produce an actionable error. SDK field names alone do not establish availability on every account.

References: [Insights breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/), [Ad Creative](https://developers.facebook.com/docs/marketing-api/reference/ad-creative/), [official SDK](https://github.com/facebook/facebook-python-business-sdk/tree/main/facebook_business/adobjects).

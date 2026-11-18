# Meta audience and creative reporting: implementation audit and launch plan

Status: proposed features, not released. This change updates Compare copy and closes two existing import/output gaps; it does not enable these report families.

## What exists

- `src/lib/nre/creative-report-data.ts`: an earlier ad-name-based prototype with overview, top-ad, video and fatigue sections.
- `src/lib/pptx/creative-slides.ts`: table/text PowerPoint rendering for those sections, without creative media.
- Creative is a deferred report type in `src/lib/meta-launch-scope.ts`. The prototype can be exercised internally but must not be appended to ordinary reports merely because a CSV includes Ad name.
- The prototype groups by campaign/ad name, averages daily CTR/frequency and uses simple winner/fatigue heuristics. It does not provide production-ready ad-ID identity, period reach, conversion-rate/ROAS evidence, media rendering, complete pagination, browser parity or trustworthy winner eligibility.
- Current Meta sync fetches campaign/ad-set Insights. Its level type does not include `ad`, and it has no audience breakdown or creative media request path.
- GA4 demographic/geo builders are separate website reporting code; they do not implement Meta audience reporting.
- Standard validation identifies records at campaign/ad-set/ad/day grain. Age, geography and platform/placement add dimensions and cannot be ingested as duplicate standard daily rows. Known audience columns now get an explicit unsupported-report message until the dedicated pipeline exists.

## Recommended workflow

Keep Weekly, Monthly, Compare and Daily as date/report choices. Add optional report content rather than several new competing buttons:

1. Standard performance.
2. Audience breakdowns: choose Age, Location, Platform and/or Placement.
3. Creative performance: choose ads and an objective-relevant ranking metric.

Allow sections to be used alone or with a standard report. Start with weekly/monthly audience and creative sections; do not advertise Compare/Daily parity until explicitly implemented and tested. Reuse the chosen dates, account, currency, campaigns, objective mapping and selected metrics.

For CSV, audience sections accept clearly labelled separate uploads for age and region, plus a combined platform/placement file or separate files. Detect dimensions automatically and show date/account coverage before generation. Reuse one combined platform/placement dataset to derive its platform totals. Never add these different views of the same activity into an overall spend/result total.

For API, the user chooses dimensions; the server makes separate compatible requests and manages pagination/retries. No CSV or media upload should be needed in the normal case. Keep unavailable metrics distinct from zero and preserve unknown/suppressed categories.

## Data requirements

### Audience CSV

- Campaign/ad-set IDs and names, selected dates (prefer daily rows), explicit dimension columns and currency.
- Spend, impressions, Clicks (all), link clicks, and the actual objective's attributed action count.
- Purchase conversion value and purchase count for purchase ROAS; landing-page views where a website conversion-rate denominator is required.
- The supplied sample structures are usable: Age; Region; and joint Placement + Platform. They are ad-set/day observations, not three independent spend sources. Region means state/region in those exports, not city or ZIP code.
- Require one account, compatible attribution and date coverage per source group. Store dimension type and grain separately from standard observations. Do not force every breakdown to contain the same categories or the same result total when Meta suppresses values.

### Meta API

Use the existing read-only connection and the same account calendar. Add a typed allowed-breakdown layer and explicit Insights request identity:

- `age` (optionally gender later).
- `region` or `country` for the requested geography.
- `publisher_platform` for Facebook/Instagram and other returned publishers.
- `publisher_platform,platform_position` for a compatible joint platform/placement view.
- Do not request age + geography + placement as one arbitrary combination. Validate supported combinations and action/metric compatibility against the pinned Graph API version, then test a real account before release.
- Treat privacy limitations, absent conversions and Unknown as source constraints. Do not invent missing values or claim person-level targeting/identity.

### Creative API and manual alternative

- Fetch `level=ad` Insights with stable ad ID, campaign/ad-set IDs, selected-date metrics and objective evidence. Include inactive/deleted historical ads where accessible.
- Join each ad ID to its creative object; resolve appropriate preview, image, thumbnail, video poster, carousel cards or `asset_feed_spec` as available. Use supported Meta endpoints and the connected account's actual permissions.
- Cache permitted media as a report snapshot and embed image bytes in PPTX; store browser-safe assets for the live report. Do not expose access tokens, rely on expiring CDN links forever, or embed API-returned preview HTML without sanitization/isolation.
- Video slides show a poster with a playable preview link; ordinary static PPTX output does not promise embedded playable video. Label carousel/dynamic/catalog previews accurately.
- Dynamic/Advantage+ ads may contain multiple assets and personalized combinations. Ad-level performance is not proof that one component image, headline or generated combination won. Asset-level attribution is a separate capability and must be explicitly qualified where unavailable.
- CSV remains usable for creative performance metrics. It does not contain image binaries. Offer a clearly labelled metrics-only report or optional image/video-poster uploads mapped by Ad ID, with a visible mapping confirmation. Do not match by ad name alone or claim full preview parity with a plain CSV.
- Handle missing/deleted media with a labelled placeholder while preserving supported metrics, rather than failing the whole report or displaying the wrong asset.

## Calculation and ranking requirements

- Reuse the production objective/action mapping. Do not sum alternative projections of the same conversion, and do not mix lead and purchase goals in one winner ranking.
- Compute CTR, CPC, CPM and cost per result from summed numerators/denominators, not averages of daily percentages/costs. Keep CTR (all) distinct from link CTR.
- Define every conversion-rate denominator. Website purchases / landing-page views is different from results / link clicks; instant-form conversion rate needs form-open evidence. Do not show one generic CVR across all objectives.
- ROAS = attributed purchase conversion value / spend, only when the correct value evidence exists. Missing purchase value is unavailable, not zero ROAS. The supplied lead exports cannot support a purchase ROAS claim.
- Period/segment reach is not additive across days or overlapping audiences. Obtain the appropriate whole-period reach or label/omit the estimate; frequency must use the same audience basis.
- Rank within objective and comparable scope, require an explicit minimum evidence threshold and show insufficient data when appropriate. High CTR alone does not establish the best lead/sales creative. Do not publish a fatigue diagnosis solely from an average frequency threshold.
- Include all selected ads/segments through pagination or explicit Top N + Other totals. Never silently truncate after the prototype's first 12 ads.
- Preserve unknown categories, unavailable metrics and unmatched assets in both source reconciliation and client-facing output.

## Release order and acceptance

1. Audience data model and CSV imports, checked against the provided independent exports and an unsegmented baseline.
2. API audience requests through the same normalized calculation engine.
3. API creative metrics + media snapshots, with the manual metrics-only/uploaded-media alternative.
4. Browser/PPTX/Google Slides rendering, stable media, pagination, objective-aware summaries and client editing boundaries.

Before enabling either feature: prove baseline totals are not multiplied by multiple breakdown uploads; test partial/missing categories, zero delivery, multi-objective campaigns, duplicate names with distinct IDs, currency/timezone/attribution, privacy-limited fields, video/carousel/dynamic ads, expired assets, deleted ads, large accounts, retries and rate limits. Reconcile source metrics independently and inspect both dark/light PPTX and browser output. Keep AI claims grounded in the supplied slice and available evidence.

## Capability references

- Meta Insights breakdowns: https://developers.facebook.com/docs/marketing-api/insights/breakdowns/
- Meta Ad Creative reference: https://developers.facebook.com/docs/marketing-api/reference/ad-creative/
- Official SDK breakdown enums: https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py
- Official SDK creative fields: https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreative.py
- Official SDK ad creative relationship/preview method: https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/ad.py

The SDK confirms the available field/enum names; it does not prove every breakdown combination, metric or asset is accessible to every account. Live verification against our pinned API version and approved token permissions remains a release gate.

# Meta wizard API testing

Meta API import is enabled for controlled testing. Manual CSV import remains available. No production deployment or real Meta account test was performed in this change.

## Owner setup and first test

1. Merge and deploy this branch. If Vercel already has `AD_PLATFORM_API_SYNC_ENABLED=false`, change it to `true` and redeploy. An absent flag now enables testing. Explicit `false` remains the server kill switch.
2. Keep the existing Meta app credentials and stable server-only token encryption key. Never share access tokens. The connection uses the existing read-only reporting permissions; connecting does not grant this application an ad editing workflow.
3. Open a client report wizard, choose Sync from Meta, connect, and select an account. OAuth returns to that wizard. Account visibility depends on the Meta app access level and the connecting user's permissions.
4. Match the client workspace timezone to the selected Meta account. A mismatch stops sync with an explanatory error. Account currency is read from Meta, not assumed USD or taken from the operator's location.
5. First test a lead-generation account, then a traffic/reach account. Use identical account, date range, reporting level and attribution settings in Ads Manager. Compare campaign selection, spend, result type, Results, Cost per Result, and PPT totals. Also test a zero-result day, multiple ad sets and duplicate campaign names.
6. Share discrepancies with report type, dates, currency and screenshots of aggregate metrics. Do not share tokens. Keep using CSV for any account that does not pass this comparison.

## Import periods

- Weekly: trailing 30 days ending yesterday in the ad account timezone, plus any earlier selected weekly period. Previous-month comparison is refreshed separately and awaited; a failure turns that comparison off for this setup.
- Monthly: selected month/period; legacy historical mode fetches its selected months.
- Comparison: union of both selected periods, including any gap between them.
- Day-by-day: selected period, default last seven days.

Future dates and spans over 366 days are rejected. Changing dates beyond an existing API import requires returning to Import and syncing again. Query coverage is retained independently of the last day with delivery, so a quiet final day does not shift the report backwards.

## Calculation and transport changes

API data becomes the same engine input used by CSV and shares campaign selection, objective choices, preview and PPT rendering. Actual account currency is included. CTR is already a percentage in Meta responses; 0.5 is no longer multiplied into 50. Distinct campaign/ad-set IDs prevent duplicate display names from merging. Paginated responses have loop limits; larger inputs use lossless gzip transport. Previous encrypted-token consumers now decrypt before provider calls.

The wizard uses direct-evidence result mapping. Unambiguous primary result fields take precedence; mapped counts must have corresponding direct API evidence. Counts derived only from spend/CPA stop the import. Manual CSV replacement of API results is disabled during API testing so it cannot hide discrepancies.

## What remains unverified

Synthetic fixtures prove shared-engine parity, not equivalence with every live Ads Manager configuration. Meta permissions, API-version field availability, custom conversions, attribution and mixed result objectives still require real-account acceptance. A supported action count is evidence of a count, not universal proof that it is the advertiser's intended primary objective; review objective selection. Unsupported responses fail visibly rather than guaranteeing an outcome.

Reach is nonadditive. Existing shared-engine reach semantics and availability of exact period reach still apply; matching spend/results does not establish unique reach parity for every report type. No email delivery automation or write access to ad accounts is introduced.

## Verification

`npm run test:meta-api` covers import periods, timezone boundaries, query coverage, direct result evidence, duplicate identities, compression, server route authorization and independent API-versus-CSV PPT monetary parity for all four report types. The command is also wired into CI.

Also run `npm run test:objective-regression`, `npm run test:reporting-accuracy`, `npm run test:report-choices`, `npm run test:api-routes`, TypeScript and the production build. Provider calls and storage are mocked in automated parity tests; no live account credentials are needed.

Local results: 33 API-specific tests, 69 objective tests, 58 route tests, 504 accounting tests and 279 report-choice tests passed. TypeScript and the production build passed. Changed-file ESLint reports the same pre-existing seven effect-related errors and ten warnings as the baseline copies of the two wizard components; lint is not a clean pass. No live Meta response or complete browser OAuth session was available for verification.

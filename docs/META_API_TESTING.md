# Meta wizard API testing

Meta API import is enabled for controlled testing. Manual CSV import remains available. No production deployment or real Meta account test was performed in this change.

## Owner setup and first test

1. Merge and deploy this branch. If Vercel already has `AD_PLATFORM_API_SYNC_ENABLED=false`, change it to `true` and redeploy. An absent flag now enables testing. Explicit `false` remains the server kill switch.
2. Keep the existing Meta app credentials and stable server-only token encryption key. Never share access tokens. The connection uses the existing read-only reporting permissions; connecting does not grant this application an ad editing workflow.
3. Open a client report wizard, choose Sync from Meta, connect, and select an account. OAuth returns to that wizard. Account visibility depends on the Meta app access level and the connecting user's permissions.
4. Match the client workspace timezone to the selected Meta account. The account picker offers an inline action to save the account timezone to this client; sync waits until the calendars match. Account currency is read from Meta, not assumed USD or taken from the operator's location.
5. First test a lead-generation account, then a traffic/reach account. Use identical account, date range, reporting level and attribution settings in Ads Manager. Compare campaign selection, spend, result type, Results, Cost per Result, and PPT totals. Also test a zero-result day, multiple ad sets and duplicate campaign names.
6. Share discrepancies with report type, dates, currency and screenshots of aggregate metrics. Do not share tokens. Keep using CSV for any account that does not pass this comparison.

## Wizard setup

Choose API import and a report type, connect/select an ad account, then choose that report’s period. All four report choices are visible immediately. There is no independent source-date selector: the selected report period determines the API request automatically, with a read-only summary of the exact fetch dates.

- Weekly defaults to the last seven reporting days, with a last-30-days API fetch for MTD/chart data. Weekly presets and a custom period remain available; an earlier custom period automatically extends the fetch.
- Monthly offers month presets and custom From/To month pickers. Three months means three selected calendar months, not a rolling 90-day import.
- Comparison offers presets or two custom periods; Meta fetches daily data spanning both.
- Day-by-day offers presets or a custom date range; Meta fetches those dates.

API Import calendars use the current account calendar rather than a previous CSV's end date. A wider historical selection must never silently replace the chosen report type or dates during analysis. Source changes and timezone corrections clear imported campaigns, metrics and generated state; controls are locked during sync and analysis. The previous Match report dates, rolling source presets and separate custom source calendar have been removed.

After Analyze both sources use the same campaign, objective, metric, preview and PPT generation pipeline. API mode does not ask the user to download a CSV or upload previous-month data; an optional source-data download remains available for diagnostics.

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

Initial API rollout results: 33 API-specific tests, 69 objective tests, 58 route tests, 504 accounting tests and 279 report-choice tests passed. TypeScript and the production build passed. Changed-file ESLint reports the same pre-existing seven effect-related errors and ten warnings as the baseline copies of the two wizard components; lint is not a clean pass. No live Meta response or complete browser OAuth session was available for verification.


## Workflow correction verification (November 5, 2026)

- Automated suite: 40 Meta API/UI/route/parity tests, 59 API route tests, 504 accounting tests and 279 report-choice tests pass. TypeScript and production build pass.
- Browser interaction: `node scripts/check-meta-wizard-browser.cjs` runs all four report choices at 390px and 1440px with synthetic provider responses. It exercises timezone PATCH, weekly presets/custom calendar, monthly ranges, comparison presets, day-by-day periods, outgoing request dates, preservation after analysis and source-change invalidation. It checks horizontal overflow and browser runtime errors. Screenshots/bundle go under the system temporary directory (`nre-meta-api-workflow`).
- The optional browser script requires Playwright, esbuild, the existing PostCSS tooling and Chromium; use `CHROMIUM_EXECUTABLE_PATH` if Chromium is installed outside its usual path. It does not access live Meta or storage.
- Existing effect-related lint errors and warnings in the large wizard components remain; lint is not claimed as a clean pass.
- No deployment or real-account accuracy verification is included. Validate the first connected account against Ads Manager before client delivery.


## Report-driven dates (November 6, 2026)

Removed the independent fetch-window UI and request option. All four API report choices are shown first. Report dates alone determine the request; stale frontend `importRange` fields are ignored by the route. Weekly retains its automatic 30-day data requirement and custom reporting period. Monthly retains calendar-month presets and From/To month pickers, without the six-month shortcut in API mode. Comparison and day-by-day retain custom calendars. The fetch summary is read-only.

Validation: 40 API/UI/route/PPT parity tests and 279 report-choice tests passed. Eight synthetic-provider Chromium journeys passed at mobile and desktop widths, including custom weekly, comparison and day-by-day calendars, exact automatic fetch summaries, choice preservation and source resets. TypeScript and production build passed. Existing component effect lint findings remain; no live-account test or deployment was performed.

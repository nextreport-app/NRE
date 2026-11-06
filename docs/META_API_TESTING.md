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

- Weekly defaults to the last seven reporting days, with a last-30-days API fetch for MTD/chart data. CSV and API Import share Last 7 days and Custom date range controls; Generate uses the same control. An earlier API custom period extends the required source coverage automatically.
- Monthly offers month presets and custom From/To month pickers. Three months means three selected calendar months, not a rolling 90-day import.
- Comparison offers presets or two custom periods; Meta fetches daily data spanning both.
- Day-by-day offers presets or a custom date range; Meta fetches those dates.

API Import calendars use the current account calendar rather than a previous CSV's end date. A wider historical selection must never silently replace the chosen report type or dates during analysis. Source changes and timezone corrections clear imported campaigns, metrics and generated state; controls are locked during sync and analysis. The previous Match report dates, rolling source presets and separate custom source calendar have been removed.

After Analyze both sources use the same campaign, objective, metric, preview and PPT generation pipeline. API mode does not ask the user to download a CSV or upload previous-month data; an optional source-data download remains available for diagnostics.

## Import periods

- Weekly: trailing 30 days ending yesterday in the ad account timezone, plus any earlier selected weekly period. Supplemental previous-month totals are available only in manual CSV mode.
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


## Configured conversion events and CTR (November 6, 2026)

Removed the Weekly report period section and the Meta will fetch summary from API Import. Weekly API imports default to last-seven-day reporting plus the automatic last-30-day source window, ignoring old hidden weekly date preferences. CSV Import and Generate keep their shared period controls.

Strict API imports now read the imported ad sets' `promoted_object` using read-only Graph requests. A configured pixel event or custom conversion ID selects one exact action type for every daily row. Combined `lead` totals and other events cannot fill a day where that configured event has zero results. Unsupported website events or conflicting counts for the same event stop the import. Non-conversion goals retain their existing result handling. The exported diagnostic source records the chosen action type. Current ad-set configuration is used; historical event-setting changes still need live acceptance testing.

The API requests explicitly use impression-time action reporting and each ad set's unified attribution setting. Ads Manager comparisons must use identical dates, accounts, campaign/ad-set selection and attribution settings.

CTR (All) remains all clicks / impressions. Link CTR is now available separately as link clicks / impressions, with matching source columns and weighted aggregation. Inconsistent provider count/rate pairs stop an import. Neither rate is replaced with the other to match a screenshot. The chart retains fractional spend instead of rounding $444.63 to $445.

A synthetic regression models 23 combined leads versus 21 configured website events at $444.63 spend. The same reporting/PPT path produces 21 website events, $21.17 CPL and $444.63 in the visual slide. Separate 7.31% all-click and 5.08% link CTR assertions verify their definitions; this fixture is not a captured response from the user's account. The user confirmed that 5.08% is link CTR. The synthetic PPT also verifies a selectable LINK CTR card displaying 5.08%. The supplied live report URL could not be fetched because this environment’s web gateway returned 403, so its actual conversion rows and settings remain unverified. Existing saved imports must be synced again after deployment; previously generated reports are not rewritten.

Verification: 47 API/configuration/route/PPT tests, 69 objective regressions, 505 accounting tests, 279 report-choice tests, 59 route tests, eight synthetic-provider browser journeys, TypeScript and production build passed. Scoped lint retains existing effect errors in wizard components. No production deployment or real-account API call was performed.

## Ad-set settings lookup recovery (November 6, 2026)

The previous root multi-ID lookup mapped all provider failures to a generic instruction to reconnect. That message did not establish that authentication had failed. Replace it with supported per-AdSet GET requests (`/{adset-id}?fields=id,optimization_goal,promoted_object`), deduplicated IDs and a maximum concurrency of four. Validate response ID and optimization goal; unresolved objects still stop conversion mapping.

Retry temporary network/provider and rate-limit failures at most twice. Expired/revoked login (190), permissions (10/200), rate limiting (4/17/32/613 or HTTP 429), invalid/unavailable objects (100), and unexpected responses receive distinct statuses/messages. Include provider codes but never raw provider messages, credentials or request URLs. Only authentication failures instruct the user to reconnect. Conversion-event/count checks remain intact.

Validation: 55 Meta API/PPT/route tests and 61 API route tests passed, including real configuration-parser calls through the sync route, bounded concurrency, retries, incomplete objects, and error redaction. TypeScript, scoped lint and the production build passed. No real-account provider response or production deployment was available; the original provider error hidden by the old generic message remains unknown. No new environment variables, permissions or OAuth scopes are required.


## One count source per configured event (November 6, 2026)

The cross-channel equality guard was too broad: it concatenated the configured event's `actions.value`, first `results` value and first `objective_results` value, then rejected any difference without establishing matching attribution context. Do not interpret that error as proof the user's Ads Manager settings are wrong.

Strict imports now request standard action/delivery fields only, excluding `results`, `objective_results` and their cost channels. Configured website/custom events use the matching `actions.value` scalar under `use_unified_attribution_setting=true` and `action_report_time=impression`. Alternative result projections do not override, backfill or invalidate that count. Missing configured actions remain zero; duplicate conflicting values within the canonical action channel still fail. Cost is recomputed from spend/count through the shared engine, never inverted to invent a count.

Standard traffic, landing-page, reach, impression and instant-form goals retain explicit goal-specific action/delivery sources when alternative result channels are absent. Goal selection takes precedence over campaign naming. Legacy helper callers retain their existing fields and behavior. The source CSV records result source, attribution mode and action reporting time as metadata, not selectable metrics.

Regression tests cover actions=21/results=23 and actions=23/results=21, proving the source policy does not choose the smaller value. The full CSV/engine/PPT reproduction now includes conflicting alternative channels and still produces 21 configured website results, $444.63 chart spend and $21.17 CPL from its canonical inputs. Provider tests check field/attribution settings through pagination and date chunks. All four PPT types remain covered.

Verification: 80 API/provider/route/PPT tests, 505 accounting tests, 279 report-choice tests and 61 API route tests passed. TypeScript, scoped lint and the production build passed. Provider data in tests is synthetic; the live account must be synced again after deployment to verify its actual counts. No reconnect, environment variable or permission changes are required for this correction.


## Matching weekly controls (November 6, 2026)

Weekly CSV and API setup now use the same Last 7 days / Custom date range component. Remove the Previous 7 days and Last 14 days buttons, explanatory paragraphs and visible timezone suffix. Account timezone still controls date calculations internally. Legacy saved quick picks are displayed as their equivalent custom ranges. Both report-type panels initially use the same collapsed presentation.

API import sends the selected period to sync and analyze without resetting custom dates to Last 7 days. The automatic 30-day chart window is still fetched, extending to include earlier custom reporting dates as needed. No separate fetch window or Meta will fetch panel was restored.

Verification: 85 API/provider/UI/PPT tests, 279 report-choice tests, TypeScript and production build passed. Eight mobile/desktop browser journeys cover API custom-week preservation, CSV presets/calendar interaction, and the other report types. Scoped lint retains existing effect errors in the wizard hook. No new environment settings or permissions are required.


## Supplemental previous-month totals are manual-only (November 6, 2026)

Remove the previous-month message from API Import and stop the extra previous-month Meta fetch/storage refresh. API responses do not expose manual previous-month metadata. The wizard ignores saved comparison toggles in API mode while retaining the manual file/choice for a switch back to CSV. API source coverage metadata also forces the supplemental comparison flag off before server preview, verification, cache fingerprinting and generation. Manual CSV behavior is preserved.

This restriction concerns the optional stored previous-month totals. Explicit Monthly or Comparison report periods can still include earlier months in their own API source data.

Validation: 88 API/provider/route/PPT tests, 505 accounting tests, eight synthetic-provider mobile/desktop browser journeys, TypeScript and production build passed. Tests verify no weekly API previous-month fetch, server rejection of stale API comparison flags, and retention of manual CSV settings after API use. Existing component effect lint findings remain. No deployment or environment changes performed.

## Searchable Meta account picker (November 6, 2026)

Replace the native account select with a searchable dropdown displaying account name and ID on separate lines. Currency and timezone are no longer part of picker labels or accessible names; the parent retains those metadata fields for reporting/currency and timezone validation. Numeric-only account names avoid repeating the same ID twice.

Search runs locally over loaded permitted accounts and matches case-insensitive name/ID terms. Filtering and keyboard navigation do not change the chosen account until selection is committed. Add no-match feedback, bounded scrolling, active-item visibility, Escape/outside dismissal, focus return and keyboard selection. No new provider requests or scopes are introduced.

Validation: 91 API/provider/UI/PPT tests, eight synthetic-provider mobile/desktop wizard journeys, TypeScript and production build passed. Browser checks cover name/ID filtering, no matches, Enter selection, Arrow navigation, Escape, and the absence of currency/timezone in options. New picker and test lint passed. Existing unrelated parent component effect lint findings remain. No production deployment or environment changes performed.

## Website schedule detection parity (November 7, 2026)

Manual CSV already maps `Website appointments scheduled` to WEBSITE SCHEDULE / COST PER BOOKING. API normalization incorrectly translated `offsite_conversion.fb_pixel_schedule` to generic Schedule (APPOINTMENT LEADS). Map that exact website action to the same website-specific Result type and indicator. Generic Schedule remains APPOINTMENT LEADS.

Reuse the CSV custom-conversion naming resolver during strict API ingestion, preserving the raw Result indicator for later catalog resolution. Catalog lookup is best effort; attribution and canonical action counts are unchanged. Extract pure naming functions from server storage code while preserving existing exports. Register the dedicated website appointments metric separately from generic appointments and expose the corresponding API column only when that event is present.

The parity regression compares campaign extraction/spend, objectives, stale-cache rejection, selected metrics, weekly report calculations and generated PPT labels through both import paths. It covers standard pixel Schedule and named custom Schedule conversions, plus a temporarily unavailable custom catalog. Provider responses are synthetic, not captured live account evidence.

Verification: uploaded DC-weekly-Unstoppable.csv contains 47 website appointments for the selected campaign; its synthetic API counterpart matches. Four upload-based parity tests, 95 API tests, 69 objective regression tests, 506 reporting-accuracy tests and 279 report-choice tests passed. Scoped ESLint, TypeScript, diff checks and production build passed. Run the upload-specific check with `SCHEDULE_PARITY_CSV=/local/path/to/file.csv npx vitest run src/lib/nre/__tests__/meta-api-schedule-parity.test.ts`; otherwise the committed regression fixture is used. The uploaded client CSV is not committed.

No production deployment or live Meta-account verification performed. After deployment, sync again to replace previously normalized source data. No environment, OAuth scope or permission changes required.

## Remove transient API support panels (November 7, 2026)

API sync publishes its source file and diagnostic payload before the common analyze request completes. The Import step rendered that intermediate state as Advanced: API sync diagnostics and API sync complete / Download API sync CSV, briefly exposing internal mapping fields during the normal transition. Remove those support panels from the user-facing Import step. Internal source data and diagnostics remain available to the existing engine; sync/analyze error handling remains intact.

Keep the existing disabled Syncing & analyzing… action throughout sync and analysis, then continue directly to campaign/objective selection. Extend the synthetic-provider browser check to pause analysis after sync has returned real-shaped diagnostics and a source file; verify the action stays disabled and no support panel appears before releasing analysis. All four report types pass this transition on mobile (390px) and desktop (1440px). This is a local browser check, not production-account verification.

Validation: eight browser journeys, 95 API tests, TypeScript, scoped ESLint, diff checks and production build passed. No environment changes required and no production deployment performed.

## Website Schedule counts from conversion metrics (November 7, 2026)

The Schedule label fix did not cover Meta's separate `conversions` field: strict imports requested `actions` only. A standard SCHEDULE ad set with website appointments in `conversions` (`action_type=schedule_website`) and no matching pixel-schedule action therefore imported Results=0. Request conversion metrics under the same daily/unified-attribution/impression-time settings. For configured standard SCHEDULE, use the exact website schedule conversion scalar when supplied; otherwise retain the exact pixel Schedule action. Never sum aliases, use all-location `schedule_total`, derive counts from cost, or replace configured custom/lead counts with schedule totals. Explicit observed zero remains zero. Invalid or conflicting duplicates within the chosen metric fail validation.

Record the actual source in metadata and emit `conversions:schedule_website` as the standard Result indicator; both import paths resolve it to Website appointments scheduled. The dedicated website appointments column uses the same chosen count as Results. Generic lead count policy is unchanged.

The supplied Unstoppable CSV independently totals 24 appointments / $2,218.82 spend / $92.45 per booking for October 30–November 5; November 1–5 totals 17 / $1,620.10 / $95.30; full-file chart totals 47 / $4,390.06. Screenshot API chart spend differs slightly ($4,390.29); these are CSV expectations, not a claim of identical live-provider data.

Strengthen the parity regression to assert exact weekly results/CPL, MTD results/CPL, chart results, source metadata and metric-column consistency, instead of merely equality between two outputs. Cover conversion-only Schedule responses, legacy pixel-action responses, named custom events, exclusion of all-location schedules, explicit zero and unchanged lead actions. Provider fixtures are synthetic counterparts of the supplied CSV; the account's actual API response was not accessible. The uploaded client file remains outside the repository. Fresh sync after deployment is required to replace previously zeroed source data; existing exported PPTs are not rewritten.

Validation: 97 API tests, 506 accounting/reporting tests, 279 report-choice tests, 10 upload/indicator tests, TypeScript, scoped ESLint and production build passed. No production deployment or environment changes performed.

## Remove unrelated Website Leads card from Website Schedule (November 7, 2026)

The generic CSV-aware eight-card backfill could select Website Leads for a Website Schedule campaign because that objective lacked a cross-objective exclusion. Add Website Leads and Cost per Website Lead to both Schedule exclusion lists: default metric backfill and final slide/available-metric filtering. Keep Website Schedule / Cost per Booking, and allow fewer cards instead of adding an unrelated conversion metric. Existing Website Leads campaigns are unaffected.

Extend the CSV/API Schedule parity tests to assert no Website Leads default/addable chip and to generate PPTs with a stale saved Website Leads selection. Confirm the generated dynamic cards exclude it while exact booking counts/costs remain intact. This applies to both CSV and API sources; existing exports need regeneration.

Validation: six CSV/API/PPT Schedule tests, 506 reporting-accuracy tests, 279 report-choice tests, TypeScript, scoped ESLint and production build passed. No environment changes or deployment performed.

## Objective-specific Website Schedule defaults and source parity (November 7, 2026)

The earlier Website Leads exclusion was too narrow. Website Schedule still fell through the generic default wishlist, whose final CSV-pool backfill could select another conversion event (Meta Form Leads) because API input exposes more column names. Both imports already use the same campaign/objective/metric/report engine; generic header-driven backfill caused their metric selection to diverge.

Give Website Schedule an explicit pack and matching automatic/default selection: Ad Spend, Reach, Impressions, Website Schedule, Cost per Booking, CTR (All), Link Clicks, Landing Page Views. When a supporting metric is unavailable, use only the pack's relevant supporting options (cost per LPV, CPC link, frequency, CPM), never arbitrary conversion columns. Both backfill passes now honor objective exclusions. Share the Schedule exclusion policy between wizard defaults and final rendering so stale Website Leads, Meta Form Leads and duplicate appointment selections cannot reappear as slide cards.

Strengthen the CSV/API regression to require identical campaign identities/spend, objective maps, exact eight selected metric keys, and rendered dynamic-card keys/labels/values. Inspect the generated PPT campaign slide XML for Landing Page Views and absence of Website/Meta Form Leads cards. Exercise pixel-action, conversion-metric-only and named custom-conversion source variants, including old saved stray metrics. Missing-LPV tests verify the fallback is a relevant delivery metric rather than a different conversion count. The uploaded CSV and synthetic provider counterpart pass; no live-account comparison or deployment was performed.

Validation: 98 API tests, seven upload parity tests, 506 reporting-accuracy tests, 279 report-choice tests and 66 pack/slot tests passed. TypeScript, scoped ESLint, diff checks and production build passed. No environment changes required; regenerate after deployment to apply new defaults to new reports.

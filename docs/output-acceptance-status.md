# Output acceptance status — 15 November 2026

The agreed outputs are PowerPoint (.pptx), Google Slides and browser view. PDF is out of scope. The user confirms the downloaded PPT opens in Microsoft PowerPoint. The environment proxy prevented independent inspection of the supplied Google Slides link; live Google Slides/browser layout acceptance remains separate from automated calculation tests.

## Confirmed source discrepancy

The October API source and Ads Manager export match all 93 campaign/ad-set/day keys and total spend ($2,081.26). On October 24 the form campaign has 5 primary Results and 6 secondary Meta leads in Ads Manager, while the API importer previously selected 6 grouped leads as Results. This explains 187 versus 186 October primary results. The supplied API CSV contains the selected action count, not an independent primary Results projection, so it cannot establish which raw API primary count Meta will return after the fix.

November's 39 keys match for the overlapping November 1–13 range. Nonblank primary result quantities agree. Two rows distinguish blank manual Results from API zeros. The latest source snapshots also differ by $0.03 spend, 3 impressions and 3 reach on November 13; that difference already exists before rendering. Its provider/snapshot cause is not independently established.

## Calculation changes and verification scope

Instant-form API imports now request primary Results and use their explicit count instead of substituting grouped Meta leads. A second fetch refreshes the entire form row together (delivery and results), checks daily coverage, and preserves raw result evidence in the downloadable synced CSV. Missing, invalid or conflicting primary evidence with observed form leads stops the import with CSV fallback guidance. Conflicting duplicate daily API rows are also rejected; identical pagination duplicates are collapsed. Configured website pixel/custom events still use their own canonical action counts; website Schedule retains its location-specific conversion policy.

The export keeps secondary Meta leads and their own cost separate from primary Results and Cost per result. Both manual CSV and API processing preserve explicit zero Results instead of replacing them with positive secondary leads. The calculation version is bumped to invalidate stale wizard calculation snapshots. Previously generated reports are not rewritten.

The regression suite covers:

- Additive spend, impressions, event counts and retained daily source observations.
- Full period spend in cost denominators, including spending days with zero results.
- CTR (all) versus link CTR; CPC (all) versus link CPC; CPM scaling; objective-specific cost and result counts.
- Weighted costs, ROAS and other dictionary ratios; missing/zero denominators; explicit zero versus blank source observations.
- Campaign/ad-set scope, mixed objectives, selected-campaign period totals, daily/month boundaries, timezone cutoffs and comparison deltas from unrounded values.
- Weekly, monthly, comparison and day-by-day manual/API parity through actual PPT renderers, including primary form Results that differ from secondary grouped leads. Historical multi-month reports are also covered.
- Export/download, sharing and wizard guards through the repository's existing route/component suites.

Daily CSV reach cannot prove a deduplicated period audience. The engine uses matching API campaign-period reach when supplied, otherwise labels an estimate; frequency and cost-per-reach derived from estimated reach inherit that limitation. No test run turns estimated reach into exact Ads Manager reach.

## Repository validation

The final full Vitest run passed 3,244 tests with zero failures. Its 22 optional skips comprise 21 database tests (subsequently run separately against a disposable local PostgreSQL database: all 21 passed) and one optional private workbook fixture that was not supplied. All 13 Node runner tests passed. TypeScript, targeted ESLint, the production webpack build and whitespace checks passed. These checks use fixtures/mocks for external providers; they do not constitute an authenticated live Meta or Google acceptance run.

## Post-deployment result: API acceptance remains blocked

The user's first production October sync after PR #719 stopped with the primary-form Results guard. The original error did not retain which day, indicator or value shape failed; it does not establish that Meta omitted Results rather than returning an unsupported indicator/shape or conflicting values. Do not bypass the guard or treat this as successful API parity.

The diagnostic follow-up adds an authenticated, no-store 422 payload and a **Download sync diagnostic** button on this error screen. The bounded JSON includes a specific failure reason, affected date/ad-set/campaign IDs, primary/objective result metrics and lead actions. It explicitly selects reporting fields and excludes request/token objects. No partial CSV or report is returned. A local browser check verified the JSON download and clearing after successful retry; the API suite passed 133 tests and the focused diagnostic/mapping/route/UI checks passed 49 tests, alongside TypeScript, targeted ESLint and the production build.

After deploying the follow-up, repeat the October sync once. If the error recurs, download `meta-sync-diagnostic.json` from the error box and provide that file. No PPT generation or additional CSV uploads are needed to diagnose this failure. Inspect that provider evidence before changing supported result indicators or zero/missing-count policies.

## Live acceptance still required after deployment

1. Select the Express Text client and Monthly report, choose October 1–31, 2026, and sync the matching Meta account.
2. At the campaign screen open Source data → Download synced CSV. No PPT generation is needed for this evidence step.
3. Compare October 24 primary Results and the month total against a fresh Ads Manager day-wise export captured close in time. The expected manual baseline is 5 primary Results on October 24 and 186 for October. Secondary Meta leads may legitimately be 6 on that day and 187 for October.
4. If Meta omits or conflicts on primary Results, retain the actionable import error and use manual CSV; do not bypass the guard or substitute grouped counts. The source-evidence columns allow inspection when a sync succeeds.
5. Confirm Google Slides and browser-view opening/layout directly.

Passing repository checks verifies tested calculation contracts and regressions. Live provider parity remains open until this post-deployment check; this document does not certify that every possible provider response or future input is error-free.

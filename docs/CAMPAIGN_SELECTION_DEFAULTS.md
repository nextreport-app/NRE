# Campaign selection by report-period spend

November 8, 2026.

Main wizard campaign selection now starts with every campaign spending any positive amount in the selected report period checked. There is no fixed $10/currency-dependent cutoff. Zero-spend campaigns remain available unchecked in the collapsed group. Every row displays a neutral spend amount; sub-cent positive values are displayed as `<currency0.01`, not misleadingly rounded to zero. Unknown spend is shown as unavailable, not a measured zero.

A shared server helper, `campaign-selection-spend.ts`, resolves dates using the same reporting calendar/range functions as generation:

- Weekly: the selected week/custom period, not all rolling-chart rows.
- Monthly: the selected month or multi-month range.
- Comparison: either selected period qualifies. Rows in a gap are excluded; overlapping rows are not double-counted in the displayed combined spend.
- Daily: the selected day/range.

The shared helper serves both CSV/API analyze and upload-session recovery. Returning to Campaigns after changing reporting dates refreshes the numbers/defaults from the authenticated saved source rows. Aborted/stale responses cannot overwrite a newer selection. Manual checkbox choices, including included zero-spend campaigns, survive period refreshes. Unavailable refreshed facts are not shown as zero.

Saved exclusions now carry `positive-period-spend-v1`. Legacy exclusions may have come from the old automatic $10 rule, so their defaults are rebuilt once on a new import; current-policy saved exclusions are respected. Restored draft choices remain explicit and are preserved. No database migration is needed: the policy tag lives in the existing selection JSON.

Generation no longer silently discards sub-$10 campaign slides from multi-month reports. An explicitly included zero-spend campaign is retained in an otherwise active report; the existing entirely-paused-account report flow is unchanged. The report engine version is bumped so cached old previews cannot retain the former inclusion behavior.

Scope: main wizard campaign selection and its campaign slides. The separately uploaded previous-month supplement retains its independent selector/policy. API previous-month auto-fetch remains disabled as previously requested.

## Verification

- Pure period tests cover positive/sub-cent spend, zero spend, old/current selection memory, all report types, comparison gaps and overlapping periods.
- Component tests verify neutral amounts, unknown-spend handling, collapsed/searchable zero campaigns and included-zero counts with 1,020 inactive campaigns.
- Upload-session route integration verifies that requested dates replace whole-file spend for recovered facts.
- Monthly report tests retain explicitly included $0.50 and zero-spend campaign slides.
- Browser checks cover both import sources, all four report choices and mobile/desktop sizes; they verify positive-spend defaults, period refreshes, manual overrides and expanded zero-row layout.

No Vercel variables, billing changes, data migrations or production deployment performed. Existing exported reports remain unchanged; generate a fresh preview/report after deployment.

Validation results: 290 report-choice/selection tests, 529 reporting-accuracy tests (one optional private-upload test skipped), 118 API tests, 63 API-route tests and eight mobile/desktop browser scenarios passed. Targeted source/UI/render/recovery contracts passed 22 tests. TypeScript, scoped lint (apart from pre-existing hook effect errors/unused-variable warnings) and production build passed. The browser scenarios exercise both CSV and API sources.

# Flexible Meta CSV reports

Updated 27 October 2026. Supersedes PR 601's two-type restriction. Four main choices, with two detailed workflows under a collapsed section:

| Choice | Dates / content |
| --- | --- |
| Weekly overview (default) | Existing week + MTD + last-30-day chart, optional previous-month totals |
| Monthly report | Selected full calendar month or current MTD through yesterday; monthly campaign slides, total and chart, no weekly slides |
| Daily report | Yesterday or selected completed day; only that day's campaign performance, total and chart |
| Month-by-month report | 2–12 calendar months, 3/6-month shortcuts, ending month; per-month campaign slides/totals and overview table |
| Compare two periods | Existing two-period comparison; under “Compare or view detailed data” |
| Daily breakdown | Existing one-row-per-day table over selected dates; under details |

Quarterly, Year-to-date and Creative remain hidden. Report history/implementations remain intact. Meta manual CSV remains the only wizard source/platform. API sync and other platforms remain hidden. Google signup/login and connections outside the wizard are unchanged.

## Dates and source data

Monthly defaults to current MTD, except the first day of a month defaults to the month just closed. Daily defaults to calendar yesterday in the client's timezone. Selected months/days are preserved through CSV analysis, preview and generation. Non-weekly dates do not overwrite the server's remembered weekly date selection. Previous-month attachment controls appear only for Weekly.

Month-by-month defaults to three completed months; the current partial month is off by default. Selecting it labels that month MTD. The ending month can be moved back for older client requests. The first-day-of-month historical bug (skipping the month just closed) and UTC+14 monthly anchor bug are corrected.

The CSV needs daily rows covering the requested period. Server-side preview and generation reject truncated boundary coverage; historical reports also reject months with no rows. CSV bounds cannot prove that absent interior days are genuine zero delivery: we do not invent missing rows. A legitimate export omitting inactive boundary days may require a wider export to establish coverage. A complete zero-delivery day without source rows cannot be assumed to be zero.

Monthly/daily preview and verification share the selected window; monthly filters the source rows and uses a matching calendar anchor. Preview cache engine version is bumped to avoid reusing prior period semantics.

## Acceptance testing before promotion

Owner should generate and inspect all six workflows after deployment. Suggested files: continuous six-month daily Meta CSV, a month-to-date CSV, and a one-day CSV.

- Weekly: unchanged default, MTD/chart and optional separate previous-month totals.
- Monthly: September 1–30 and October MTD; no weekly or prior-month attachment totals.
- Daily: yesterday and a different day; no monthly totals.
- Month-by-month: last 3 / 6 completed months, an older ending month, optional current MTD clearly labelled; inspect each month's totals and overview.
- Comparison: existing period A/B flow.
- Daily breakdown: custom range, one row per day.
- Negative cases: short CSV for six months, truncated boundary month, missing entire middle month, future day, multiple days submitted as Daily, partial closed month submitted as Monthly.
- First-day-of-month, leap February, UTC+14 and negative timezone boundaries.

Automated tests cover calendar rules, selected-window engine output/reconciliation, six distinct monthly totals, report visibility/preferences, historical and daily-table output. Browser smoke checks cover selection, controls, persistence and responsive layout. These do not replace the owner's real-file deck acceptance.

## Existing accuracy limitation

`reach-aggregation.ts` still uses a Sainsbury period-Reach estimate and empirical overlap adjustment when exact period Reach is absent. Daily/campaign Reach is non-additive: deduplicated monthly/account Reach cannot be reconstructed exactly from daily counts. Strict CSV-only accuracy requires matching-grain, matching-window exported Reach totals or an unavailable state. This PR does not change Reach formulas or certify them as exact; audit Reach-derived cost metrics separately. Quarterly/YTD still need their own CSV guidance and validation before restoration; Creative requires ad-level source data.

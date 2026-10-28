# Meta CSV report types: input and output contracts

All six launch report types currently require **Time breakdown: Day**. A CSV with monthly aggregate rows is rejected at import; it cannot be sliced safely into arbitrary days or partial months. Monthly output does not imply monthly input grain. Keep this requirement on every report choice card. A future aggregate-export mode needs explicit range/grain validation and its own non-additive metric rules before it can be advertised.

| Wizard choice | CSV date coverage | PPTX content | Chart |
| --- | --- | --- | --- |
| Weekly overview | Last 30 days; separate previous-month CSV optional | Cover, selected-week campaign/ad-set cards, current-month totals, optional previous-month totals, metric guide | Rolling 30-day campaign/objective overview; shorter when source coverage is shorter |
| Monthly report | Selected full calendar month, or current month from the 1st through yesterday | Cover, selected-month campaign/ad-set cards, that month's totals, metric guide | Selected month only, including 30/31-day months; never labelled Last 30 Days |
| Single-day report | Selected day (yesterday by default); a wider daily export is filtered | Cover, selected-day campaign/ad-set cards, selected-day totals, metric guide | Campaign/objective overview for that day only; not an intraday time series |
| Month-by-month report | Continuous daily export covering all selected 2–12 months | Cover, campaign cards and account-total cards for each month, final month comparison table | No rolling chart; final table compares monthly metrics |
| Compare two periods | One daily export covering both chosen ranges | Cover, side-by-side campaign comparisons and account summary | No rolling chart; supports week/week, month/month and custom ranges |
| Day-by-day table | Daily export covering selected date range | Cover and paginated account tables, one row per observed date | No campaign cards, monthly totals or chart |

Current month ends yesterday in the client's timezone; month-by-month includes current MTD only when explicitly selected. Monthly and single-day reports ignore the optional previous-month attachment. Daily tables do not invent zero observations for dates missing from the CSV. Historical campaign-card filtering still excludes under-$10 campaigns; account monthly totals include all selected campaigns. This existing product rule is not changed by this patch.

## Corrections

- Show the CSV requirement directly on every report choice, rather than only in the selected summary.
- Distinguish Single-day report from Day-by-day table; update default deck/history names and Spanish choice labels.
- Chart headings use report type as well as window length. A full calendar month must not inherit a rolling-30-day label.
- Selected-day slides no longer say Yesterday. Their totals heading and date column no longer say Monthly/Month; the daily table date column also says Date.
- Empty monthly/day reports no longer promise unrelated previous-month or rolling-chart context.
- Month-total cards preserve metrics 9–16 on a continuation slide instead of silently dropping them.

## Verification and limits

`report-type-pptx-contract.test.ts` builds synthetic daily data, renders the shipped dark and light templates, then reads the actual slide XML. It verifies date isolation, source totals, chip overflow, titles, table pagination, lack of unrelated period slides and weekly/monthly comparisons. These checks run in `npm run test:report-choices`. Existing metric, chart and table tests remain applicable.

This is not a promise that summed daily unique Reach equals Meta's deduplicated monthly Reach. Existing Reach aggregation has estimation limitations; exact unique audience totals require appropriate source-period observations. This patch changes scope/labels and preserves selected chips, rather than silently changing numeric aggregation policy. No API platform is unhidden by these changes.

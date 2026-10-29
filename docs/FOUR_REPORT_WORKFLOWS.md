# Current wizard report choices

The wizard offers four choices. Existing DAILY and HISTORICAL engine records remain compatible; they are not separate picker cards.

| Choice | Output | CSV input |
| --- | --- | --- |
| Weekly overview | Weekly campaign cards, MTD totals, rolling 30-day chart; optional separate previous-month CSV | Day breakdown |
| Monthly report | One month/MTD: campaign cards, selected-month objective/campaign chart and monthly table. Multiple months: separate month/campaign cards, totals and monthly overview; no weekly or rolling 30-day slides | Daily rows, or campaign/month totals with Reporting starts and Reporting ends. Multiple months need Month or Day breakdown, not one combined multi-month total |
| Compare two periods | Same campaigns across two selected ranges, including week/week or month/month | One Day-breakdown CSV covering both periods |
| Daily report | Day-by-day metric tables; identical start/end dates produce one daily row. No monthly or weekly slides | Day breakdown |

Monthly total rows are interval facts, never fabricated daily observations. Use one campaign-level row per month without ad/ad-set breakdown. Duplicate campaign/month rows, mixed daily/aggregate grain and totals that cannot exactly cover the selected month are rejected. Reach is not summed across overlapping monthly ad-set totals. Current MTD may end on the CSV's actual last reporting day; closed months require complete calendar coverage. Monthly defaults to the eligible source months, with a 1–12 month selector. Explicit covered selections are preserved.

All wizard day and month controls share the same navy calendar surface, amber selection, keyboard navigation and completed-date bounds. The legacy single-day performance renderer remains available for existing saved reports; new Daily selections use tables.

The report wizard remains Meta manual CSV only. No API sync or other platform reporting is enabled by this change.

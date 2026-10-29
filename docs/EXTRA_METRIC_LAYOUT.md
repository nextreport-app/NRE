# Extra metric cards

The first eight selected metrics stay on the normal campaign/ad-set performance slide. Every extra selected metric appears once on dedicated additional pages. There is no confirmation popup at metric nine, no request to add filler and no automatic duplication of results or cost per result.

## Page rules

| Selected metrics | Card counts per performance page |
| --- | --- |
| 8 | 8 |
| 9 | 8 + 1 |
| 11 | 8 + 3 |
| 16 | 8 + 8 |
| 17 | 8 + 5 + 4 |
| 20 | 8 + 6 + 6 |
| 25 | 8 + 6 + 6 + 5 |
| 64 | Eight pages of eight |

Extra metrics are balanced over the minimum number of pages at eight cards per page, retaining selection order. The first performance page is never redistributed. Removing a metric immediately recalculates the groups. The wizard displays both the page count and which metrics belong on each page.

One extra gets a focused large card; two or three get large cards; larger pages use a centered grid. Only selected cards are drawn. Missing source values retain their selected label and an unavailable value; empty template placeholder cards are never drawn. Context includes campaign/ad-set identity, reporting dates, objective and continuation page number. Repeating the first slide's AI summary adds no value, so additional pages contain metrics rather than duplicated narrative.

## Limits and consistency

- Up to 64 metrics per campaign, subject to available CSV columns and the existing objective-specific rules. The UI and per-campaign API validator enforce this limit. Oversized direct engine selections fail explicitly instead of silently truncating.
- The account-wide request carries a deduplicated union of definitions from multiple campaigns, so it has a separate 1,024-definition ceiling. It must not be limited to one campaign's card count.
- Campaigns, selected ad sets and historical month-total slides preserve all extras. The frozen `additionalMetricsSlide` field remains a flat array for archive compatibility; renderers paginate it.
- Legacy archive filler duplicates are removed when rendering additional pages. Existing generated decks are not rewritten automatically.
- Share JSON includes every selected metric, not just the first eight. Published metric edits can reach the matching extra card when downloading PowerPoint again.
- The metric guide is paginated in groups of 12 instead of losing definitions beyond its template capacity. Preview slide counts include additional pages, guide pages and historical overview tables.
- Comparison and day-by-day tables have fixed schemas. Their Metrics step explains the included metrics instead of offering card selections their renderers would ignore. Weekly, monthly, single-day and month-by-month performance reports support additional metric pages.

## Validation

Regression coverage checks 8/9/11/16/17/20/25/64 selections, exact order, no filler, API bounds, mixed-campaign union size, source-backed extra values, shares/edit round trips, historical totals and actual dark/light PPTX slide XML. Card bounds stay within the 960 × 540 point canvas. A case-insensitive raw-header fallback also handles added CSV metrics whose supplied column name retains uppercase characters.

Browser checks exercise the actual wizard: adding through metrics nine and twenty without modals, balanced page groups, removing back to eight, the 64-metric limit, fixed-table explanations and mobile overflow. Anonymous sample decks and layout previews are generated outside the repository; no client CSV is committed.

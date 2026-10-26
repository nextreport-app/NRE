# NRE source accounting contract

NextReport exists to place the selected source period's advertising figures into a client presentation. An attractive, internally consistent deck is insufficient if its source event, denominator, or reporting window is wrong.

## Implemented flow

```text
CSV/XLS parse + upload validation
  -> original mapped observations retained in aggregate.sourceRows
  -> one selected date/campaign scope and campaign objective map
  -> numeric accounting (sum facts, calculate rates)
  -> ReportData numeric table evidence + formatted slide values
  -> preview / worker snapshot / PPTX renderer
  -> source reconciliation using the same frozen date/objective context
```

`numeric-accounting.ts` is pure: no formatting, clocks, campaign naming, or network access. It sums spend, impressions, all-clicks and resolved results, rejects non-finite numeric facts, and calculates CTR, CPC and objective rate. `objective.ts` handles event selection before passing facts into that arithmetic. Raw observations survive rollups; classifying inferred aggregate rows must not erase a primary purchase because an optional Website Leads column exists.

A matching explicit Result type + Results cell supplies the primary count, including an explicit source zero. A confirmed different objective can use its dedicated count; another event's generic Results must never be relabeled. Legacy programmatic numeric-zero rows retain dedicated-column fallback for compatibility. This distinction should eventually become an explicit missing-value type.

Default primary result/cost chips consume the same resolved values as the campaign metrics, including form leads, traffic, LPV, video and messaging. Optional secondary metrics retain their distinct meanings. Cost/rate/ROAS/percentage headers cannot enter event-count sums. Fractional conversion totals are retained rather than rounded to whole numbers for reconciliation.

## Rate and scope rules

| Metric | Period formula |
|---|---|
| CTR (all) | sum(all-clicks) / sum(impressions) × 100 |
| CPC (all) | sum(spend) / sum(all-clicks) |
| Cost per objective result | objective spend / objective result count |
| CPM | spend / impressions × 1,000 |
| Cost per 1K Reach | spend / period Reach × 1,000 |
| Frequency | impressions / period Reach |

Observed Clicks (all), including zero, has priority. Without it, existing CTR-based or CPC-based implied click recovery remains available; rounded source rates cannot reconstruct exact clicks. Link clicks never silently substitute for all-clicks because a spend header uses INR instead of USD.

Known period Reach remains preferred. Unique Reach is non-additive: daily rows cannot reveal exact deduplicated audience size. Existing estimation remains available and must not be described as exact API/manual parity. Frequency based on estimated Reach is also estimated. Generic multirow ratios without known numerator/denominator are unavailable rather than an invented average.

`ReportCalculationContext` records engine version, as-of instant, timezone, selected primary/combined ranges and campaign/previous-period objective maps. Reconciliation consumes this plan rather than resolving a different day or objective again. The preview fingerprint includes engine version, local reporting day, currency and previous-file dependencies. A previous-period upload retains its own selection; existing objective confirmation/cache behavior is preserved.

## Verification boundaries

Reconciliation reads original selected rows and checks displayed counts/rates, source objective coverage and formula units. `TableRowData.accounting` keeps unrounded spend/result/rate evidence separate from presentation strings. A missing printed CPR is a failure. An omitted positive explicit objective is a mismatch even when the remaining buckets agree.

Sharing numeric primitives prevents drift; it does not make reconciliation an independent mathematical oracle. Golden tests provide hand-calculated expected totals and inspect actual generated dark/light PPTX table XML. A green panel says **listed checks passed**, not every metric, attribution rule, optional chip or unique audience was independently proven.

Malformed CSV quotes, ragged records, invalid calendar dates, ambiguous same-name IDs, malformed mapped numbers, and repeated daily entity facts fail upload validation instead of silently generating a plausible deck. Decimal-comma numeric exports are currently unsupported and receive a clear error; do not reinterpret them as thousands. Breakdown exports that repeat the same entity/day need a dedicated grain contract rather than silent deduplication.

## API/manual diagnostics

`npx tsx scripts/meta-row-diff.ts --manual manual.csv --api-csv mapped.csv --out diff.json`

Use `--insights snapshot.json` instead of `--api-csv` to inspect actual mapper decisions. Optional `--since YYYY-MM-DD --until YYYY-MM-DD` constrain the window. The output records file hashes, row keys, duplicates/unmatched rows, and metric differences. Exit codes: 0 equal, 1 differences, 2 invalid usage/input. The command will not overwrite an existing receipt.

The saved Credit Firm receipt is historical: 26 equal and 4 different days, manual 12 vs mapped 16 Results on equal $444.41 spend. It is not a live API acceptance run. The production mapper and enrichment rules remain unchanged: trial changes improved some fixtures while breaking others, without a real paired raw API snapshot to resolve the conflict. The row diff makes those disagreements reviewable before changing production mapping. API rollout gates remain unchanged.

## Remaining architecture work

This is an incremental core refactor, not a claim that the full NRE is rebuilt. `report-data.ts` and `objective.ts` remain large. Mixed explicit goals can still require correction: verification now exposes omitted events, but the campaign model still selects one primary objective. Stable entity IDs, explicit declared grain, immutable source record IDs, full per-event buckets, typed missing values, and proof-carrying mapper decisions remain the next migration. Some historical/chart and API expectations already fail on baseline main; final validation results are recorded in the PR. Missing private CSV fixtures cannot be reconstructed reliably.

No production schema, template assets, API launch gates, plan charges or existing stored decks are migrated by this branch. Existing reports must be regenerated after deployment. Use representative approved client exports before promoting a preview to production.

## Checks

- `npm run test:reporting-accuracy -- --maxWorkers=1`: numeric contracts, reproduced source cases, actual PPTX tables, price parity, row diff.
- `npm run test:objective-regression -- --maxWorkers=2`: platform/objective release gate.
- `npm run test:api-routes -- --maxWorkers=2`: route behavior.
- `npx tsc --noEmit` and targeted ESLint.
- `npm test -- --maxWorkers=2`: wider suite; inspect failures, including baseline failures.
- `npm run build`: executes Prisma migrations first; use a disposable test database locally.

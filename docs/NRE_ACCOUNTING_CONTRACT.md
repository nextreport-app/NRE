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

The saved Credit Firm receipt is historical: 26 equal and 4 different days, manual 12 vs mapped 16 Results on equal $444.41 spend. It is not a live API acceptance run. The mapper now rejects a generic costed lead if its count/cost cannot account for row spend (allowing two-decimal cost rounding), avoids generic leads bypassing pixel reconciliation, and rejects generic fb_pixel_custom CPA as proof of a website submission when Results is absent. Enrichment shares the website predicate, preventing a campaign custom total from filling a blank ad-set day. These are bounded reproduced fixes, not proof of complete API/manual parity. Numeric custom IDs still require event identity evidence, and some legacy enrichment expectations remain unresolved. The row diff makes those disagreements reviewable. API rollout gates remain unchanged.

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


## Final review status

A further review added precedence for precise declared conversion events over misleading campaign names, and matching checkout/cart source evidence over a stale purchase name. It preserves existing incidental-traffic/messaging guards. Application fixtures now assert their actual exported application event while still checking 23 Results versus 24 secondary Website Leads.

Before that final follow-up, the broad suite returned 2,137 passes and 33 failures; 32 failing test names were also present on baseline, and the additional failure was a PPTX test timeout. This is not a clean full-suite result. The final follow-up's focused objective/application/report-data run has 339 passes and 8 existing report-data failures. The API matrix has 104 passes and 5 existing failures (quote-ID inference, generic enrichment, and an old CPR expectation that excludes zero-result-day spend). Missing private fixtures and older chart/range expectations remain outstanding. Do not treat this PR as a universal accuracy certification.

The source acceptance suite covers actual deck tables; production build, TypeScript, API-route checks and hosted PR CI/Preview have also been exercised. Final command counts and hosted status are recorded on the PR. Homepage browser checks found the corrected $83.74 illustrative CPL, no JavaScript page errors, and no horizontal overflow at a 390px viewport. External agency pilots and paired live API snapshots are still required.

## Uploaded workbook follow-up

Both owner reference workbooks have now been read. See [catalogue audit](REFERENCE_CATALOG_ALIGNMENT.md) for cell-level coverage and limits. Engine `nre-accounting-2026-10-26-v3` invalidates older snapshots. Count/value separation, Google primary-versus-all metrics, explicit average components, scoped ROAS, and distinct Contact/Trial/video events are covered by source regressions. Google source provenance keeps displayed Clicks additive through the legacy reach field and prioritizes observed clicks over rounded rates. The mixed catalogue now has 43 registered event families.

This establishes corrected behavior for reproduced cases, not every listed metric. The broad follow-up run reported 2,182 passes and 22 failures, with historical expectations, API inference, and missing private fixtures outstanding. Manual owner acceptance remains required; API sync stays on hold.


## Numeric verification and date coverage are separate

Engine `nre-accounting-2026-10-27-v4` separates numeric mismatches from dates with no source rows. Meta daily exports can omit dates without delivery; the CSV alone cannot establish whether a missing date is inactivity or an incomplete export. No synthetic zero-delivery rows are inserted.

`CsvVerificationResult.status` describes agreement with the available CSV observations. Optional `coverageWarnings` carries scoped missing dates and source-range review guidance. Numeric helpers no longer accept a calendar-completeness flag that can turn equal spend/results/CTR/CPC/link-click values into mismatches. Existing numeric tolerances and result equality rules remain intact. Successful numbers with coverage warnings use a neutral comparison summary plus an amber date notice; readiness remains a warning until the source range is reviewed. Actual mismatches keep their metric-level details. Post-generation mismatch messaging is reserved for actual mismatches.

Anonymous regression: one campaign ends October 20 and a replacement starts October 22. The absent October 21 previously produced one coverage mismatch plus 13 false numeric mismatches across campaign/ad-set checks. The corrected comparison preserves numeric matches and one date-coverage notice. Corrupted spend, CTR, Results and ad-set spend still fail. The UI regression also verifies that a real mismatch plus a coverage notice counts only the real differing metric.

Client-uploaded regression exports and before/after receipts remain outside Git; committed tests use anonymous synthetic facts. This fix does not certify the missing day, modify report calculations, widen tolerances or change existing generated decks. Run a fresh comparison/generation after deploying it.

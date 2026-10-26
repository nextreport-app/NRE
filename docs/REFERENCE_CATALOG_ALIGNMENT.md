# Reference catalogue alignment review

Reviewed 26 October 2026 using both owner-uploaded XLSX files. API sync remains on hold. PR #588 is a draft for Preview testing, not launch approval.

## Sources and audit

Read both workbooks end-to-end, including all tabs: the metrics sheet has 389 rows (388 Meta entries, 141 Google entries, and popular-metric columns); the objective sheet has 1,000 rows, of which 304 are nonempty. Its hierarchy contains six top-level Meta objectives plus a Catalogue sales variant. The 17 event labels include ambiguous Lead and the generic Conversion count placeholder.

The metric lists already existed, in the same order, in `src/lib/nre/reference/meta-google-metrics-sheet.json`. That reference snapshot did not prove that the parser or arithmetic handled them correctly. Some existing tests checked names while expecting incorrect event groupings.

[Machine-readable audit](audits/workbook-catalog-alignment.json) records source SHA-256 hashes, every listed metric cell and its binding, every nonempty taxonomy row, event resolutions and limitations. Reproduce with:

```sh
npx tsx scripts/audit-reference-catalogs.ts --metrics metrics.xlsx --objectives objectives.xlsx --out new-audit.json
```

The earlier Google Sheets network block is superseded by these attachments. No external document instructions were executed.

## Confirmed defects corrected

- Count detection could bind Results value or conversion-value currency columns to result counts. Exact count headers now take precedence; value/cost/rate headers cannot become event counts. Credit spends cannot become advertising spend; campaign budgets/IDs cannot become campaign names.
- Google normalization collapsed Clicks with Interactions, Conversions with All conversions, and Avg. CPC with Avg. cost. These fields now remain distinct. Multiple status columns no longer normalize to one conflicting header. Impr. is normalized to Impressions.
- Google Clicks displayed through the legacy reach field could receive Meta reach estimation. Source-platform provenance now keeps those clicks additive and uses observed clicks before rounded CTR/CPC inference. Meta unique-reach behavior is preserved.
- Monetary averages and ratios need components, not sums of exported averages. Declared rules now cover purchase/order values, cart size, conversion value per click/conversion, and scoped website/app ROAS. Missing components return unavailable multi-row ratios; a single observed non-ROAS average can be preserved.
- Contact was grouped with Website leads; Start trial with Subscribe; ThruPlay and two-second views shared one result bucket. Those events now have distinct result/count/CPR definitions. Combined lead locations remain ambiguous rather than being forced into one location. Existing templates and default card counts remain.
- Optional recognized numeric fields now undergo source validation. Indian thousands grouping is accepted; ambiguous decimal-comma exports remain rejected.

The engine version is bumped to invalidate older calculation snapshots. Mixed-objective coverage now exercises all **43 registered internal result/event families** in one CSV. These are not 43 official Meta campaign objectives. Video subtypes are also checked in actual dark/light PPTX output.

## Coverage boundaries

| Listed entries | Registered numeric metric | Registered nonmetric | Fixed-parser candidate only | Not registered |
|---|---:|---:|---:|---:|
| Meta: 388 (385 unique) | 100 | 63 | 9 | 216 |
| Google: 141 | 57 | 43 | 2 | 39 |

Counts include duplicate source entries. Nonmetrics include dimensions and settings. Fixed-parser candidates are not optional metric-card support. Registered metrics are bindings, not independent validation of every possible aggregate. The stricter parser deliberately stops recognizing misleading substring matches; this reduces false coverage.

The engine is **partially aligned**, not universally compatible with every listed field. Advanced scoped metrics and custom events remain unsupported or require explicit aggregation contracts. The workbook lists names, not full denominator, attribution, currency, breakdown-grain or audience-deduplication rules. Configured bid-target averages retain their legacy policy. Exact period reach cannot be recovered from overlapping daily audience counts; Meta CSV reach may remain estimated. The taxonomy helper is a reference/consistency utility, not a replacement for observed Result type and event counts. Google campaign-type detection still uses active-column heuristics; precedence for explicit campaign-type metadata needs a separate regression and implementation before claiming full Google taxonomy alignment.

The broad suite still has failures, including historical report expectations, API inference and missing private CSV fixtures. Passing focused acceptance checks does not erase those failures. Before production promotion, test the Preview with real manual exports and compare source totals, each objective bucket and the actual downloaded deck. API sync needs a separate paired manual/API acceptance gate.

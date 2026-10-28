# Metric-card source dependency audit

28 October 2026. Extends the missing weekly link-CPC fix to the shared metric reader used by optional cards and automatic slot selection. Meta manual CSV remains the live workflow. Google dictionary unit checks exercise shared code only; they do not certify Google API/CSV reporting or enable it in the wizard.

## Findings corrected

- Cost-per-event cards (LPV, leads, purchases, messaging, video and other dictionary events) discarded exported rates when their count column was absent. Now prefer actual counts; otherwise blend matching daily cost rates using their spend weights and unit scale.
- Single exported rates, including ROAS and average conversion value, were unnecessarily discarded when another component column was absent. Preserve a single observation. For multiple rows, require valid weights; never take a plain arithmetic mean.
- ROAS with no conversion-value column can use exported ROAS weighted by spend. Explicit zero-return days contribute their spend. Location-specific website/app ratios retain distinct semantic keys.
- All-click CTR can use exported percentages weighted by impressions, or invert the matching all-click counts when impressions are omitted. Link-click counts are not substituted for all clicks.
- A saved selection omitting `perUnitOf` could lose its cost semantics and be summed. Recover semantics from the metric dictionary.
- CPC aliases (`CPC all`, `Average CPC (all)`) did not receive the same fallback treatment as the original canonical name. Explicit click counts remain authoritative, including zeros.
- The picker failed to offer an exported ROAS card when conversion value was absent. Its source-presence rule now agrees with the reader.
- Currency suffix recognition covered fewer currencies than the client settings supported. Picker recognition now covers every supported report currency; the reader resolves those suffixed columns too.
- Unknown custom cost/average fields could be summed because their display format was currency or number. Preserve single observations; leave multi-row averages unavailable without declared weights.

## Source rules

For a ratio `R = scale × N / D`:

1. Both components present: use period totals, keeping actual zero denominators unavailable.
2. Only a single exported ratio observation: retain it without demanding another column.
3. Exported ratios and denominator weights: use `sum(R × D) / sum(D)`.
4. Exported ratios and numerator weights, such as cost/event: use `scale × sum(N) / sum(scale × N / R)`.
5. A spending row with missing/zero cost rate cannot establish its event denominator; neither can a zero-spend/zero-cost observation establish a missing event count. A weighted row with a missing rate cannot be assumed zero. Leave unavailable.
6. Do not combine daily unique Reach as additive counts. Missing Reach-based period weights do not get a rate-inversion fallback.

Source-rate inversion can inherit the CSV's rounding precision. It is not an independently exported event count; reconstructed denominators are used internally for rates, not surfaced as exported count cards. Without adequate source components or weights, a dash remains appropriate.

Primary objective counts/costs continue to use objective-matched accounting, rather than borrowing another objective/location's event count to fill a card. Existing rules that display certain genuine zero optional values as dashes are unchanged.

## Verification / prevention

`test:reporting-accuracy` now includes the dictionary-wide source audit and availability checks, in addition to existing accounting/CSV/PPTX regressions. At this change it passes 465 checks. The audit enumerates every numeric primary/secondary Meta and Google dictionary entry for single exported observations, all additive-denominator Meta cost entries for rate blending, and all supported report currencies. Other checks cover missing weights, authoritative zero counts, custom averages, weighted ROAS/order values, saved metric metadata and actual weekly builder output. New dictionary entries automatically enter the relevant audit matrix.

Supplementary slot, Google-unified reader and dictionary-consistency tests exercise compatibility. No private client CSVs are committed.

## Remaining limit

Existing Reach aggregation still estimates deduplicated period Reach when exact matching-window totals are absent. This audit does not certify that estimate as CSV-exact or change its formula. Exact period Reach requires matching source totals or an unavailable state. The suite prevents this class of source-dependency regressions; it is not a promise that all future exports, platform integrations or report calculations can never fail.

# Report choices during Meta CSV acceptance

27 October 2026. Keep the wizard focused on **Weekly report** (default) and **Compare two periods**. Hide seven untested types without deleting their implementations, metadata, templates, translations or saved reports. Retain the four wizard steps.

## Why two choices

Weekly is a recurring client update that already bundles the reporting week, month-to-date totals, a last-30-day chart and optional previous-month totals. These are separate date windows/presentations within one report, not four report types. Comparison answers a different question: how did the same campaigns perform in two chosen periods?

The default import screen shows the selected type, a short coverage explanation and the CSV required. “Change report type” expands exactly two choices; selecting one closes the chooser. The optional prior-month attachment is labelled “Previous-month totals” so it is not confused with the separate two-period report. There is no “More report types” drawer, disabled placeholders or catalogue of untested options. Deck titles remain unchanged. The public How It Works page uses the same availability list.

| Hidden type | Potential future use | Release requirement |
|---|---|---|
| Monthly | A standalone month-end client update | Validate completed-month and month-to-date boundaries; distinguish these clearly |
| Yesterday | Daily operational monitoring | Test single-day exports, timezone and zero-delivery days |
| Multi-month history | Longer-term trend analysis | Validate continuous source coverage, month boundaries and objective changes |
| Day-by-day table | Operational detail or diagnostics | Validate daily totals and table pagination; consider a view/export rather than a top-level deck |
| Quarterly | Longer reporting cadence | Test full source coverage and calendar boundaries; consider a date preset |
| Year to date | Longer reporting cadence | Test full source coverage and year boundaries; consider a date preset |
| Creative | Comparing individual ads/creatives | Requires ad-level source rows; campaign/ad-set CSV cannot reconstruct creative performance |

**Concrete deferred-type gap:** Quarter and YTD currently share a month-to-date export hint in `wizard-report-csv-requirement.ts`, even though their calculation windows can span several months. That guidance must be corrected and tested before either type is restored. Hiding those choices now avoids advertising an untested path with misleading upload instructions.

Longer term, consolidate time-based choices into one Performance report with validated date presets, keeping Compare periods and Creative analysis as distinct workflows. Do not rebuild the working aggregation/renderers merely to make this menu smaller.

## Preserve work safely

A preference-hydration race also let initial Weekly defaults overwrite a saved Comparison selection on reload. Persistence now waits until the restore effect has committed; browser reload tests confirm the chosen available type is retained.

Old hidden-type preferences open a fresh Weekly configuration with the default date mode; old dates/baselines are not silently applied to that different report. Hidden-type server/session drafts are not reopened as active wizard work. Existing completed reports retain their original metadata and remain in report history; returning to the wizard from a hidden-type report routes to history rather than relabelling that deck as Weekly. This UI rollout does not disable the retained internal engine/API implementations or alter the optional previous-month attachment flow.

## Date and accuracy limits

The default Weekly range is the last seven days ending **calendar yesterday in the client timezone**, not automatically the last completed Monday–Sunday week. The existing date selector can choose another supported/custom range. MTD and the last-30-day chart have their own windows; do not describe every slide as the same selected weekly period. Previous-month totals require their separate source file. Missing coverage must remain visible through existing validation; this change does not invent rows or change date/aggregation formulas.

**Remaining strict-CSV accuracy issue:** `src/lib/nre/reach-aggregation.ts` currently uses a Sainsbury period-reach estimate and an empirical ad-set overlap correction when exact period reach is unavailable. Daily reach is non-additive; neither summing it nor estimating overlap can guarantee Meta's unique reach for a week/month/account. Exact unique period reach requires matching-grain, matching-window source evidence. The owner's “no assumed numbers” requirement therefore needs a separate Reach change: use explicit source totals or clearly mark the value unavailable; also check Reach-based objectives/costs. This report-menu PR does not change that formula and must not be presented as closing all accuracy risks.

CTR/CPC/CPM and objective results/CPR must remain based on matching source fields and reporting windows, with ratios derived from aggregate numerators/denominators rather than averages of displayed daily rates. Existing accuracy/reconciliation tests remain regression evidence, not a guarantee for every export format or attribution setting.

## Rollout order

Manual Meta CSV acceptance → Meta API investigation and owner acceptance → TikTok testing → Google Ads testing → GA4 testing. Connections remain visible outside the wizard. Meta API and the other platforms remain hidden in report creation. Reintroduce individual report types only with coverage/date/objective/source-grain fixtures and owner acceptance; do not restore all nine at once.

# Wizard launch review implementation

This change applies the November 2026 wizard and generated-report review. It does not deploy the application or change billing.

## Wizard

- First-time visitors see report choices; returning visitors keep a compact setup summary. CSV and API instructions describe the selected source, and onboarding links to the existing sample deck.
- API import includes every date needed for the weekly, month-to-date and rolling-30-day windows, including the first day after a 31-day month. Account-calendar guidance is informational and requires no extra confirmation.
- Weekly campaigns with spend only in summary windows are labeled **Summary only**. They remain included in aggregate totals without creating zero-spend weekly detail pages. Metric panels show this distinction.
- Review & generate shows the slide count, outline, source, account calendar and latest imported date. Day-by-day defaults omit two optional cost columns; users can still select them.
- A display/language disclosure exposes the existing theme controls. Instructional text and light-theme status colors receive readability adjustments.
- The ready screen distinguishes generation from publishing and offers authenticated owner controls to disable or replace a public link. Replaced links stop resolving; refreshed tokens are persisted in the wizard snapshot.

Existing behavior retained: live account-name filtering, remembered completed import method, campaign/objective controls, ad-set opt-in, currency-aware dates, optional budget/branding settings, separate support panel, and high-spend-first detail ordering.

## Generated reports

- Client-first cover with the actual reporting period; removes the default heuristic health badge from the deck and live report.
- Portable Arial slide text and monetary formatting that retains cents. Positive spend below one dollar no longer looks like zero.
- Estimated-reach labels and overlap notes explain that summed campaign audiences are not a deduplicated account audience. Reach-based cost is distinguished from CPM.
- Comparison costs with no defined denominator show N/A, not a favorable 100% improvement. Current-zero-spend detail sections are omitted in both PPT and live comparison views; previous-period spend stays in summaries. Long comparison names are shortened without wrapping into adjacent rows.
- Monthly tables use more compact headers and a neutral header fill, with a note explaining objective-specific spend bases.
- Day-by-day totals omit a redundant unavailable Reach-objective pair and avoid repeating the full narrative on continuation slides.
- One metric guide renders each selected term together with its definition; no leftover template terms or filler. A twelve-card limit discloses overflow and links to the full definitions.
- AI instructions distinguish reach cost from impression CPM and reject strong unsupported causal wording. This reduces misleading claims; it does not replace human review of generated copy.

## Validation

Validation uses local fixtures and the supplied private CSV. Private CSVs, rendered decks and browser artifacts are excluded from this commit.

- TypeScript, reporting-accuracy, report-choice and Meta API suites are run for this branch; exact results are recorded in the PR.
- Local browser fixture review covers both sources and all four report choices, plus campaign, metric, generate and ready states. Desktop/mobile overflow and share-link state changes are checked.
- Five decks cover weekly dark/light, monthly, comparison and day-by-day output. LibreOffice PDF inspection supplements OOXML and numeric regression tests.
- Legacy tests are updated where they asserted removed health badges, template fonts, whole-unit currency rounding or superseded accounting policies. Existing custom-conversion evidence failures are retained and reported, rather than weakening the result-evidence policy.

## Checks still required before production launch

Fixture checks do not prove live signup/email delivery, Meta OAuth and account permissions, real API result parity, Google Drive authorization/conversion, live AI quality or PowerPoint desktop fidelity. Perform these with authorized test accounts before launch. The earlier custom-conversion evidence and August quote-cost failures are resolved in the [launch acceptance follow-up](launch-acceptance-follow-up.md), which records the source-evidence contracts and remaining live checks. Seven existing React effect lint errors reproduce on main and remain outside this UI/report presentation change.

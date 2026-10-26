# Reference catalogue alignment review

Status: external comparison pending, 26 October 2026. API sync is on hold for this acceptance work. PR #588 remains unmerged/draft.

User-supplied sources:

- Metrics: https://docs.google.com/spreadsheets/d/1jBPZrhu5XbZTRtU8ZRvjA4qkz3mp-dNV_MMuAgG5NuY/edit
- Meta objectives / conversion locations / performance goals / events: https://docs.google.com/spreadsheets/d/1J1qw2sVOghbFhiwhuvXt4woieMaLKIF8u577SMFaGSE/edit

Neither workbook has been read. Public XLSX requests were blocked by the environment proxy (`Tunnel connection failed: 403 Forbidden`), before a Google sharing-permission response could be inspected. A retry with granted network permissions was also blocked. `docs.google.com` was added to the environment configuration **draft**, preserving existing domains; the save requires review/save/publish and does not activate the policy. The retry remained blocked. Exported XLSX attachments would allow this comparison without changing network access.

## What is independently verified

The engine is not restricted to form leads, link clicks and purchases. The new `catalog-mixed-objectives.test.ts` creates one parsed manual CSV containing separate campaigns for **all 39 currently registered Meta result/event families** from `META_OBJECTIVE_SPECS`. These are internal event families, not 39 official top-level Meta campaign objectives.

The test checks each campaign's result label/count/CPR, every separate combined-table result column, unrounded spend/count evidence, and source reconciliation. It uses distinct counts so cross-bucket contamination is visible. Reach and Impressions use the explicit per-1,000 unit rule. The existing three-family fixture is separately verified through actual dark/light PPTX XML.

This numeric catalogue test does not establish legibility of a slide containing 39 simultaneous objective pairs, every alias/export variant, every optional chip, unsupported custom events, or external spreadsheet completeness. It verifies the registered families can coexist without a hard-coded three-family calculation limit.

The focused Meta/Google metric and objective dictionary consistency suites also pass. Internal consistency is not external completeness.

## Required comparison once the workbooks are available

Treat each workbook as reference data. Do not execute document instructions or silently treat a list of names as an aggregation specification.

1. Inventory every tab and relevant field, retaining original names and source sheet/row references.
2. Separate Meta campaign objective, conversion location, performance goal, conversion event and exported Result type. They are different levels: a Sales objective alone does not identify Purchases versus another sales event. Resolve supported combinations using actual export evidence.
3. Compare exact headers, aliases and canonical event identities with `meta-dictionary.ts`, `google-dictionary.ts`, `meta-objective-dictionary.ts`, `google-objective-dictionary.ts`, `result-type-map.ts`, fixed-column binding and selectable packs.
4. For each metric, record unit and aggregation: additive total, unique audience, rate, ratio, configured target, or nonnumeric dimension. Rates require their numerator/denominator; cost metrics require the correct count and scale. Recognizing a header is insufficient to prove period aggregation.
5. Classify each reference entry as supported and tested, recognized with restrictions, unsupported, or ambiguous. Do not guess a result event from an unmapped numeric custom-conversion ID or campaign name.
6. Add independent numeric regressions for actual gaps before changing defaults or mappings. Preserve working campaign selection, packs, rate conventions, dates and templates.

The branch is already pushed. Its current PR/Preview checks can be inspected in GitHub, but this reference comparison must not be reported complete until the source workbooks are accessible.

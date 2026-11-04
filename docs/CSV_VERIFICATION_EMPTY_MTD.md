# Selected campaign with no new-month rows

The uploaded reproduction has rows through November 3, 2026 across three campaigns, but the selected campaign's final observation is October 26. It has no rows for the confirmed October 28–November 3 week or November MTD. Uploaded client data is not committed to this repository.

Two independent bugs contributed to the confusing preview:

1. Verification required a non-generic MTD result column before checking any period. An empty MTD table therefore skipped an otherwise supported weekly/chart check.
2. Weekly and chart date capping used campaign-filtered rows, silently moving reporting windows back to the selected campaign's final day even though the full CSV supported the confirmed dates.

The report now uses the full CSV only for date bounds, while every financial observation remains filtered to the selected campaigns. A genuinely stale whole-file export still uses the existing latest-CSV fallback. The selected campaign cannot silently drag a supported reporting window backwards.

Verification can use weekly/chart objective columns when MTD has no objective data. A missing selected week receives an explicit coverage warning, while available chart observations are checked normally. Absent observations are not claimed as verified zeros. Engine version v20 invalidates older preview caches.

Regression coverage uses anonymous synthetic rows for: no weekly/MTD observations with an available chart, cross-month weekly activity with empty MTD, exclusion of older rows outside the intended rolling window and all other campaigns' spend, and detection of a deliberately corrupted chart total. The uploaded file was additionally replayed locally in UTC, New York, Sydney and Kolkata; it preserves the confirmed week and checks the available selected-campaign chart metrics.

To report this campaign's recorded recent activity as a weekly report, choose a week that includes its October observations, or supply a fresh export containing its newer activity if expected. Previously generated decks are not silently rewritten.

Validation: 504 reporting-accuracy tests, 279 report-choice tests and 311 PPT tests passed, along with targeted UI/API coverage, TypeScript and the production build. Scoped lint has no errors (four pre-existing unused-symbol warnings in reconciliation). The anonymous regression is included in test:reporting-accuracy, which existing CI workflows already run.

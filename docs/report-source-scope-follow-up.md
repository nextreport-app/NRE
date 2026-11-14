# Follow-up from supplied API-generated reports

## Confirmed engine defects

Campaign-level Meta period reach was passed into ad-set aggregation with campaign scope. Consequently, multiple ad-set cards could inherit the parent campaign's exact reach and calculate frequency from the wrong denominator. Ad-set aggregation and its estimate flag now use ad-set scope. When no actual ad-set period evidence exists, each ad set uses its own daily-row estimate and says so; campaign API reach is never substituted.

Monthly campaign cards now use the selected calendar period for campaign-reach lookup, matching the period evidence already used by the overview. Comparison metrics retain their existing daily-data estimate method and now mark that reach as estimated in both PPT and live views. This does not pretend that independently queried campaign and daily-estimated reach must be identical or that overlapping audiences can be summed into account-level unique reach.

## Client narrative

Supplied live AI copy included claims about unspecified targets, benchmarks, profitability, fatigue and audience quality, plus arbitrary frequency goals. Prompt guidance now explicitly limits interpretation to the supplied reporting period. The post-generation guard rejects those unsupported claims and uses deterministic factual fallback copy. The fallback avoids diagnosing fatigue from frequency, avoids calling a single-period CTR stable, and keeps successful Meta-form advice focused on the form rather than a website landing page.

## Source export

An active API import exposes `Source data` → `Download synced CSV`. This downloads the exact existing in-memory import without another API request or changing its values. It is available while the source File remains in the wizard; reopening an old report does not reconstruct an old API snapshot.

This makes row-level reconciliation possible when report totals differ slightly from an earlier manual export. Such differences must not be fixed by forcing API results to match an older CSV: first compare raw campaign/ad-set/day records and the applicable attribution/query settings. A provider update and a result-mapping defect are distinct possibilities that aggregate PPT figures cannot resolve alone.

## Validation and limits

Regression cases use a campaign reach of 850 alongside two ad sets whose own estimates are 240 and 574; model values, rendered card values, frequency denominators and estimate disclosures are verified independently. A full-month case checks that campaign cards and the overview use the same supplied exact period reach. Narrative tests cover unsupported-claim rejection and factual fallback behavior. Browser validation checks that source export preserves the exact imported file bytes and filename.

The supplied PPTs were rendered and inspected locally. They establish real report output, but do not expose the raw API rows required to settle the remaining small CSV/API differences. The supplied Google Slides link could not be inspected because the environment proxy rejected the request. These limits are not resolved by passing synthetic API fixtures or changing file-sharing permissions.

Existing stored PPTs and saved narrative text are not rewritten by this change. Generate fresh reports after deployment to apply the corrected reach scope and narrative rules. No production deployment or live provider mutation was performed while implementing this follow-up.


Validation results: full Vitest run 3,227 passed, zero failures (22 optional cases skipped in the default environment). Latest focused reach/render/comparison run: 27 passed, including the additive Google-field guard. TypeScript, targeted ESLint and the production build passed. The browser source-export check preserved exact file bytes and filename.

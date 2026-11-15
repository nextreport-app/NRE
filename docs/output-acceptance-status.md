# Output acceptance status — 15 November 2026

## Restore working API imports

Following the fifth unsuccessful production identity-verification attempt, the user authorized returning to the working API version. The rollback restores the five core API files byte-for-byte to `52847110` (PR #718, before #719): `meta-api.ts`, `direct-result-evidence.ts`, `fetch-meta-report-csv.ts`, the sync API route, and `wizard-data-source-panel.tsx`.

PR #719 introduced the availability regression: instant-form imports required primary Results projections that Meta omitted in the actual responses. PRs #720–724 added diagnostics and mandatory form/Page/story identity lookups. The fifth diagnostic confirms that the reporting destination still matches none of those identities. These assumptions cannot be justified from the supplied evidence. The rollback removes those production gates, helper modules, extra identity requests, and associated diagnostic UI. It restores action-based API imports rather than adding another identifier hypothesis.

Independent arithmetic safeguards are retained: explicit zero Results cannot be replaced by positive secondary leads; conflicting duplicate daily API rows are rejected; grouped secondary Meta leads and their costs retain their own denominator. Previous fixes through #718, including account mismatch confirmation, download filename handling, campaign/ad-set reach scope, report-period handling, cents and source CSV downloads, remain in place. Engine version v26 invalidates calculation snapshots from the unsuccessful verification releases. Existing reports are not rewritten.

## Known form-result limitation remains open

Restored API availability is not a claim of exact Ads Manager primary-form parity. The observed October 24 API grouped count is 6; the manual CSV has 5 primary Results and 6 Meta leads. The previous October baseline is 187 API grouped leads versus 186 manual primary Results. No count is hard-coded, inferred by subtraction, or replaced with the manual count.

The wizard displays a non-blocking scope notice for Meta API form campaigns: API form reports use grouped Meta lead counts, which may differ from primary instant-form Results. Use Manual CSV for those exact primary Results. API form reporting must not be called launch-cleared for primary-form parity on the basis of this rollback. No further diagnostic uploads are requested as part of the restoration.

## Output scope and live acceptance

Supported outputs are PPTX, Google Slides and browser view. PDF remains out of scope. The user confirmed Microsoft PowerPoint opens downloaded PPTs correctly. Independent inspection of the supplied Google Slides link was blocked by the environment proxy; Google Slides/browser layout acceptance remains separate from repository test results.

After the rollback is merged and deployed, refresh the wizard and use the API workflow as before. For an exact Express Text instant-form report, use the supplied Ads Manager CSV. Any future API primary-form correction requires a separate, supported metric contract and live evidence before rollout, not another mandatory identity guess applied to all accounts.

## Rollback validation

The full Vitest suite passed 3,236 tests with zero failures and 22 optional skips. The 21 database tests were then run against disposable local PostgreSQL and all passed; one optional private workbook fixture remains unavailable. All 13 Node runner tests and 19 focused rollback/report checks passed. TypeScript, the production webpack build and diff checks passed. Targeted ESLint reported zero errors and one existing useEffect dependency warning in the wizard wrapper; the hook was not changed. A git comparison confirms the five core API production files exactly match the pre-#719 baseline. These results certify the tested rollback behavior, not Express Text primary-form parity.

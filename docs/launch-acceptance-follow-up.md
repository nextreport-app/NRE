# Launch acceptance follow-up — 14 November 2026

This follows PR #714. It closes its three outstanding regression failures and fixes presentation defects found with a new mixed-objective, day-wise CSV. It does not certify live OAuth, provider parity, email delivery, Drive export, or PowerPoint desktop rendering.

## Changes

- Overview table cells now receive an explicit neutral background. The earlier replacement could recolor a nested border while leaving the table-style background unchanged. Regression tests cover inherited fills and preservation of border colors.
- Overview audience totals are labeled `CAMPAIGN REACH*` even with two objectives, consistent with the audience-overlap footnote.
- Structured chart names ending in quarter/year metadata retain the differentiated campaign purpose. Ordinary names and underscore identities retain their existing behavior.
- Glossary definitions spell out landing-page-view cost and distinguish Meta form leads from website leads.
- A reusable acceptance test checks independently accumulated raw CSV cents and event counts through weekly, monthly, comparison and daily reports, then renders both themes. It checks positive-spend detail pages, campaign ordering, one glossary and unresolved placeholders. Default input is generated non-client data; private input/artifact paths are optional environment variables.

## Why the three earlier failures were stale contracts

1. An incidental custom event in an actions array is insufficient evidence to replace a website-lead result. The legacy mapper remains conservative. A new positive test runs the strict import path with an actual configured custom conversion, catalog name and canonical action count; a negative case retains the ambiguous-event rejection.
2. The synthetic CSV/API test now supplies explicit configured-event evidence and consumes the mapper's actual output label/count. It no longer copies the manual CSV values back when mapping fails. Synthetic counterparts are not described as captured provider data.
3. Quote cost includes all spend for that campaign objective, including zero-result days. The August fixture's $1,634.60 / 148 results is $11.04, not $8.52. The test independently sums source cents and checks that zero-result spend remains included. No production counting/evidence policy was relaxed to make these tests pass.

## Full test-run repairs

- Node `node:test` files are excluded from Vitest discovery and remain covered by their own runner. `npm run test:all` runs both runners.
- The website-lead precedence test uses a generated daily fixture instead of a developer-specific private file and reads the real Day column through the normal date accessor.
- Deferred-platform copy assertions check the current testing/report-generation restriction rather than outdated OAuth wording.

## Validation evidence

- Full Vitest run: **3,184 passed, zero failures, 22 skipped** before enabling the database suites.
- The 21 database cases were then run against a newly initialized disposable PostgreSQL 17 instance with repository migrations: **21 passed, zero failures**. Billing/provider/email calls in these integration tests are mocked; they do not verify live charging or email delivery.
- Node tests: **13 passed**.
- The sole remaining optional case requires a separate private RV workbook via `WORKBOOK_DATE_REPRO_PATH`; generated workbook calendar tests pass.
- `next build --webpack` passes against the disposable local database. No production deployment was performed.
- TypeScript and ESLint on changed files pass. This is not a claim that the pre-existing whole-repository lint debt has disappeared.
- Private CSV acceptance passes. Eight decks (four report types × two themes), 56 slides total, were rendered with LibreOffice and inspected. Local narratives use renderer fallback copy, not a live AI-model response.
- No private CSV, account credentials, source-derived decks, PDFs or screenshots are committed.

## Reproduce private CSV acceptance

The fixed acceptance window is 1 October–13 November 2026 with form-lead and link-click objectives. Use a local file with that coverage:

```sh
REPORT_ACCEPTANCE_CSV=/path/to/private.csv \
REPORT_ACCEPTANCE_TIMEZONE=UTC \
REPORT_ACCEPTANCE_ARTIFACT_DIR=/tmp/report-acceptance \
npx vitest run src/lib/nre/__tests__/csv-four-report-acceptance.test.ts --maxWorkers=1
```

UTC was the explicit local test calendar; the provider account timezone was not available to verify. Source ISO-day sums are independent of that missing account metadata.

## Live acceptance still required

The execution workspace has no signed-in NextReport session, Meta user credential, or Drive user credential. An account ID and shared folder URL identify destinations but do not provide authenticated application access. A live session probe was unauthenticated; direct Drive navigation was blocked by the environment proxy, not proven to be a folder-permission issue.

Using an authenticated test session, capture API-sync output for the exact same account and 1 October–13 November window, confirm timezone/currency/attribution, and compare its raw rows against the manual export with `scripts/meta-row-diff.ts`. Then generate and review all four reports, test Drive save/conversion and published link reset/disable, and inspect real AI copy and PowerPoint desktop output. Do not mark those steps passed based on the local CSV or synthetic API tests.

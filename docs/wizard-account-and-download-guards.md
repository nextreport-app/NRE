# Wizard account, date and download fixes

## Meta account/client identity

Previously, choosing a Meta account overwrote a browser-only preference. There was no durable client association against which to warn, so a different source could be imported under the wrong client name.

The nullable Client fields `metaAdAccountId` and `metaAdAccountName` now hold a confirmed association. Existing clients start unlinked rather than being assigned a guessed account from browser history. The first nonempty successful import requires explicit confirmation and saves the association atomically. An import failure, empty response or concurrent first-link change does not overwrite it.

The Import step prefers the linked account. Selecting a different ID shows an amber notice with the report client, linked account and selected account, plus actions to choose the linked account or change client. Sync requires acknowledgment for the selected ID. Acknowledgment resets when the selection changes. The server enforces the same confirmation before fetching provider data. An intentional one-report override never replaces the saved association. Matching IDs are accepted regardless of names; `act_123` and `123` identify the same account.

Apply the included Prisma migration before deploying the code. The normal production build already runs migrations through `prisma migrate deploy`.

## Historical date notices

The stale-CSV notice was rendered globally after Import without checking the source or selected report scope. A complete previous-month API report could therefore warn about missing yesterday.

It is now shown only for CSV imports using automatic weekly, daily or comparison presets that follow the source calendar. API imports, calendar-month/history reports and explicit historical/custom dates do not display that notice. Source coverage validation remains in place; this change does not accept missing requested data or change calculations.

## Daily PPT download error

Daily range labels use an en dash, for example `Nov 1–13, 2026`. Report creation retains it in the stored filename. Both owner and public download routes previously put this Unicode filename directly in an HTTP header. Constructing that response throws a ByteString TypeError and returns a generic 500 even when file retrieval succeeded.

Both routes now use an ASCII filename fallback plus an RFC 8187 UTF-8 `filename*` value. Existing stored report names work without regeneration or a file migration. Header controls and path separators are removed. Ownership, token lookup, status checks and file bytes are unchanged.

## Validation

- Download route reproduction: two failing tests before the fix with the ByteString error; ten route/helper tests pass afterward, including Unicode names and unchanged authorization.
- Meta identity, date-calendar, API and report-choice regressions pass. Matching IDs with different names, stale acknowledgments, first link, one-report override, failed/empty import and concurrent first-link preservation are covered.
- Interactive local browser check: matching ID produces no warning; mismatch/first link disables sync until acknowledged; switching accounts clears acknowledgment; no runtime errors or mobile horizontal overflow.
- Migration applied on disposable PostgreSQL. Default-null fields and first-link compare-and-set behavior verified. Existing database integration suites: 21 passed.
- Full Vitest run: 3,211 passed, zero failures, before three additional focused cases; latest focused route/calendar/download run: 56 passed. The standard optional private-workbook case and database cases remain opt-in in a default run; the database cases were exercised separately.
- TypeScript, targeted lint and the production build pass for this change. No production deployment or live provider/account mutation was performed during validation.

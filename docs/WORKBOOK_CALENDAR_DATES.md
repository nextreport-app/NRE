# Native Excel dates and file-based report cutoffs

November 8, 2026.

The supplied RV workbook has 804 data rows with native Excel dates from September 1 through November 6, 2026. The Excel-to-CSV bridge emitted formatted display text (`m/d/yy`). The shared textual-date parser intentionally defaults ambiguous dates to day/month order, so September 12 (`9/12/26`) became December 9 and validation reported future dates. The source workbook did not actually contain those future dates.

Normalize native date-formatted serial cells to ISO calendar dates before either header detection or row parsing. Use the workbook's actual 1900/1904 date system. Currency/ordinary numeric values, text date strings and time-only metrics retain their previous behavior. Existing sheet selection, upload budgets, textual-date policy and genuine-future-date validation are unchanged.

After correction, the uploaded workbook validates all 804 rows. On November 8, its latest complete date is November 6, so the shared CSV reporting calendar yields:

- Weekly Last 7 days: October 31–November 6.
- Month to date: November 1–6.

No yesterday row or re-export is required. Upload/analyze the original workbook again after deployment rather than reusing an old parsed session.

Validation: 24 parser/calendar tests with the actual upload (via a local environment override), 529 accounting tests with one optional upload-only check skipped in the default gate, 279 report-choice tests and 118 API tests passed. TypeScript, scoped ESLint and production build passed. Tests cover common Excel date formats, the 1904 epoch, preserved currency/time-only formatting, file-anchored weekly generation and true future-date rejection.

Reproduce locally without committing private client data:

```sh
WORKBOOK_DATE_REPRO_PATH='/local/path/RV sep-nov.xlsx' npx vitest run src/lib/nre/__tests__/workbook-calendar-import.test.ts src/lib/nre/__tests__/parse-file.test.ts
```

The private workbook is not committed. No production deployment or environment changes performed.

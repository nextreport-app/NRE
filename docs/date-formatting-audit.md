# Client date display policy

Numeric dates follow the client's currency-based regional default. Clients currently have currency and timezone settings, but no country/date-format preference. Currency is a default, not proof of where someone lives.

| Client currency | Numeric display example |
| --- | --- |
| INR | 13/11/2026 (DD/MM/YYYY) |
| USD | 11/13/2026 (MM/DD/YYYY) |
| GBP, AUD, NZD, EUR | 13/11/2026 |
| Other supported currencies | Their regional Intl locale (including Canada's year-first convention) |

`src/lib/client-date-format.ts` defines the policy and common display helpers. Do not infer US format merely because a client is outside India.

## Audited surfaces

- Weekly summary and expanded start/end controls.
- Daily, day-by-day, comparison, monthly and historical period summaries, coverage dates, and date controls.
- Wizard final period confirmation, generated timestamp, and successful-report date range.
- CSV coverage guidance and missing-date diagnostics.
- Recent/all report history: periods, generated timestamps, retention dates, and date filters.
- Previous-month upload timestamps and support report selection.
- Public report/comparison generated dates and the public report's stored numeric source period.
- Website-report wizard custom dates and numeric coverage/preview labels.
- Account billing and client absolute-date fallback use written months (e.g. `13 Nov 2026`) because there is no client region on those pages.
- Other month-name-only headings and written-month report labels are already unambiguous; retain them. Marketing examples, admin timestamps and email labels use written months rather than ambiguous numeric dates.

## Correctness boundaries

Calendar dates are formatted from ISO in UTC without converting them into the viewer's timezone. Timestamps use the client's timezone. Browser-native date inputs in client report filters and the website-report wizard are replaced by the same calendar picker, with ISO values submitted/stored.

The legacy `Report.weekStart`/`weekEnd` and source-period strings are stored **MM/DD/YYYY** regardless of region. Parse that known storage format explicitly before displaying it. Never feed a localized display value back into date calculations or guess its order.

This change is presentation-only. Sync windows, report aggregation, ISO API/form values, CSV ingestion, persisted report JSON and export formats retain their existing contracts. It does not reinterpret ambiguous dates inside uploaded CSV files; that is a separate ingestion concern. No historical reports or user-written titles are rewritten.

Optional currency props retain legacy display fallbacks for legacy consumers and fixtures. Production client pages provide the client's actual currency. Live share pages resolve currency/timezone from the owning client without exposing other client fields.

## Verification

Regression coverage checks INR/USD ordering, other regional defaults, ambiguous day/month pairs, calendar boundaries, client-timezone timestamps, invalid dates, legacy-US storage conversion, retention periods, weekly/comparison/monthly controls and ISO filter submissions. Browser checks use a US locale and Pacific timezone to ensure an INR client's dates remain day-first and selected calendar values remain ISO.

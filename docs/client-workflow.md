# Client workflow

My Clients (`/clients`) is the common signed-in starting point, including Home's Dashboard action and login without a destination. It is a chooser, not another configuration screen.

| Job | Portfolio entry | Selected client |
| --- | --- | --- |
| Performance and alerts | `/overview` | `/overview?client=ID`; Website traffic tab keeps the client at `/websites?client=ID` |
| Generate a one-off report | My Clients → Generate report | `/clients/ID/reports/new` |
| Recurring reports | `/clients?task=schedule` | `/clients/ID/schedules` |
| Find generated reports | `/reports` → All reports | `/clients/ID/reports` includes filters and management tools |
| Approve scheduled delivery | `/reports?tab=scheduled` | Review draft, then return to Scheduled drafts to approve |
| Client configuration | My Clients → Manage client | `/clients/ID#client-settings` |
| Agency configuration | `/account` | Not client-specific |

The report wizard's Import, Campaigns, Metrics and Review steps are one generation workflow. Report review (`/clients/ID/reports/REPORT/copy`) and public sharing (`/r/TOKEN`) are secondary views, not additional setup tasks. The standalone website report route remains supported for existing links.

## Navigation corrections

- General Dashboard/login entry points consistently lead to My Clients. Explicit local login destinations preserve the client and query string.
- Selected performance, website performance, settings, schedules and full history share client workspace navigation.
- Reports previously exposed scheduled runs alone. Its default is now generated history across clients, with a separate Scheduled drafts tab preserving the existing approval workflow.
- Settings links to the canonical budget/alerts panel and schedules screen instead of embedding duplicate management widgets. Existing section anchors continue to work.
- Legacy client edit URLs redirect to canonical settings after ownership verification.
- Report review returns to its originating area. Private comparison drafts do not expose a public share token in their rendered review.
- Client history pagination is clamped before fetching rows.

## Validation and scope

Focused tests cover signed-out redirects, local callback validation, preserved client context, report ownership, private draft review, pagination and scoped navigation. Existing schedule, inbox, download and share-review tests verify approval/delivery boundaries remain intact. A mocked browser preview exercises wizard menu destinations, state preservation, keyboard dismissal and viewport positioning.

This is a source/route and mocked-data audit. It does not claim a live production signup, payment, Meta consent, GA4 consent or actual email delivery test. No production client assignments, schedules, provider data or emails are changed during verification.

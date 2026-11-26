# Client workflow

My Clients (`/clients`) is the common signed-in starting point, including Home's Dashboard action and login without a destination. It is a chooser, not another configuration screen.

| Job | Portfolio entry | Selected client |
| --- | --- | --- |
| Performance and alerts | `/performance/meta-ads` | `/performance/meta-ads?client=ID`; Website traffic tab keeps the client at `/performance/google-analytics?client=ID` |
| Generate a one-off report | My Clients → Generate report | `/clients/ID/reports/new` |
| Recurring reports | `/clients?task=schedule` | `/clients/ID/schedules` |
| Find generated reports | `/reports` → All reports | `/clients/ID/reports` includes filters and management tools |
| Approve scheduled delivery | `/reports?tab=scheduled` | Review draft, then return to Scheduled drafts to approve |
| Client configuration | My Clients → Client settings | `/clients/ID#client-settings` |
| Agency configuration | `/account` | Not client-specific |

The report wizard's Import, Campaigns, Metrics and Review steps are one generation workflow. Report review (`/clients/ID/reports/REPORT/copy`) and public sharing (`/r/TOKEN`) are secondary views, not additional setup tasks. The standalone website report route remains supported for existing links.

## Navigation corrections

- General Dashboard/login entry points consistently lead to My Clients. Explicit local login destinations preserve the client and query string.
- My Clients is the client task launcher: one primary Generate report button plus More tasks with descriptions for Performance, Report scheduling and Client settings.
- Task pages do not repeat a cross-task toolbar. The wizard shows its step progress and a guarded Change client link. Performance keeps platform tabs and All accounts/All websites returns; scheduling and settings return to My Clients.
- Scheduling selects an unlinked Meta ad account inline, without an Account settings or report Import detour.
- Failed or disconnected GA4 clients link directly to their own property/connection settings. Error views suppress the generic first-refresh instruction and retain stale-data warnings.
- Reports previously exposed scheduled runs alone. Its default is now generated history across clients, with a separate Scheduled drafts tab preserving the existing approval workflow.
- Settings links to the canonical budget/alerts panel and schedules screen instead of embedding duplicate management widgets. Existing section anchors continue to work.
- Legacy client edit URLs redirect to canonical settings after ownership verification.
- Report review returns to its originating area. Private comparison drafts do not expose a public share token in their rendered review.
- Client history pagination is clamped before fetching rows.

## Validation and scope

Focused tests cover signed-out redirects, local callback validation, preserved client context, report ownership, private draft review, pagination and scoped navigation. Existing schedule, inbox, download and share-review tests verify approval/delivery boundaries remain intact. Mocked browser checks cover client launcher destinations, keyboard dismissal, inline schedule account assignment, wizard leave guards, and desktop/mobile GA4 portfolio, detail, disconnected and error states.

This is a source/route and mocked-data audit. It does not claim a live production signup, payment, Meta consent, GA4 consent or actual email delivery test. No production client assignments, schedules, provider data or emails are changed during verification.

Legacy `/overview` and `/websites` permanently redirect to the corresponding `/performance/` routes, preserving query parameters. All dashboard routes remain private and excluded from search indexing.

Meta Ads, GA4 and Search Console share the same navigation structure: choose a client on the platform's portfolio, then view only that client's dashboard. A dedicated return row above the heading leads back to that platform's portfolio; it stays separate from the platform tabs. Switching platforms preserves the selected client. Meta portfolio selections also use a client-specific URL, so reload and browser history retain the correct scope. Selected-client dashboards do not include an all-client switcher.

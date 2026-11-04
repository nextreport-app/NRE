# Four-report workflow review — 4 November 2026

Baseline: production PR #660 (`c332ead`). This review uses the repository, synthetic CSV fixtures, actual PPT renderers, mocked provider/route tests, browser rendering, and LibreOffice. It does not claim authenticated production workflow testing, real Meta account acceptance, real email delivery, Microsoft PowerPoint rendering, or Google Slides conversion.

## Workflow matrix

| Wizard choice | Input and scope | Expected output | Verification |
|---|---|---|---|
| Weekly overview | Day-wise Meta CSV; selected campaigns/ad sets; account timezone; latest CSV warning when stale | Cover, campaign/ad-set detail and continuation slides, chart for available last-30-day window, current/optional previous-month table, metric guide; paused-period alternative | Actual dark/light PPT, accounting and selection contracts, saved-setup regressions |
| Monthly report | Single-month/current-MTD or 2–12 months; monthly-total input supported where appropriate | Single-month report or separate monthly campaign/ad-set/chart sections, multi-month overview, metric guide; no invented daily chart from month-total rows | Actual dark/light single/multi-month output contracts; published visibility and archived charts |
| Compare two periods | Two explicit date ranges; appropriate daily source coverage; selected campaigns/metrics | Cover, side-by-side campaign comparison, continuation metrics, summary pages, guide; no rolling-30-day chart | Actual dark/light PPT and comparison period/selection/presentation tests |
| Daily report | One day or selected range, one row per available day; selected metrics | Cover, selected-period totals, paginated daily tables including metric column continuation, guide; paused alternative | Actual dark/light PPT, source period and metric pagination tests, daily archive publish |

Legacy single-day and historical engine modes remain covered; the four rows above are the four primary wizard choices. No report type or report palette was removed.

## Gaps fixed

1. **Daily publish failure:** daily `_renderArchive` had no regeneration branch and was treated as standard ReportData. Added daily archive dispatch, cover edits and visibility support.
2. **Monthly browser charts missing:** generation retained charts in PPT/archive but omitted them from browser share JSON. Added every monthly chart to the browser view, plus recovery from existing archives when available.
3. **Monthly publish visibility mismatch:** regenerated decks ignored cover/chart/table/guide toggles; hiding campaign details could remove chart slides or invent a paused state. Specialized renderers now honor visibility and retain selected monthly overviews independently of detail slides.
4. **Comparison review failure:** a comparison summary was misread as weekly share JSON, which has different fields. Comparison review now shows its own read-only preview; changes go back through setup. The weekly editing API no longer accepts comparison records.
5. **Comparison cover logo missing:** added the client logo to comparison cover rendering and worker dispatch, matching other report types.
6. **Stale Google Slides URL:** a published, regenerated PPT could still return an old cached Slides link. Publishing invalidates that cache; the next Slides export rebuilds it. Already distributed Drive files are not modified automatically.
7. **Incorrect paused badge for explicit zero rows:** a period with rows but zero spend was treated as active. Paused status now checks spend; older spend can still appear in the rolling chart. Incremented engine version to invalidate stale preview caches.
8. **Misleading review controls/count:** daily pagination and monthly charts were missing from the review count. Daily/multi-month tables no longer offer editing fields for unused standard table rows. Empty publication is rejected. Publish CTA uses dark text on amber.
9. **Ad-set review selection:** duplicate names such as “Main” in different campaigns/months now toggle their own stable identity; hiding a monthly campaign detail slide no longer silently hides separately selected ad-set detail.
10. **Email type/date mismatch:** daily and multi-month emails used internal enum labels and empty weekly date columns. Labels/date ranges now come from saved report content; comparisons include both ranges.

## PPT validation and evidence

- Generated eight synthetic sample decks: weekly/monthly/comparison/daily × dark/light.
- Sample slide counts: weekly 5, monthly 7, comparison 4, daily 5. Counts intentionally vary with campaigns, ad sets, selected metrics, date span, pagination and visibility.
- ZIP/XML validation checks all internal relationship targets, no blank slides, no unresolved template placeholders, and a metric guide. These are stronger than merely checking a `.pptx` extension.
- All eight decks opened/converted in LibreOffice. PDF text blocks stayed inside page boundaries; a contact sheet was visually inspected. This is not a Microsoft Office certification. PDF renderer emitted font-cache warnings; output was still generated.
- Older PPT tests contained obsolete chart headings/date-window/transparent-donut expectations. Updated those expectations to the current chart and honest CSV-coverage behavior; added an explicit zero-spend latest day to the paused fixture so it tests a paused week rather than the intentional latest-CSV fallback.
- Sample files and rendered previews are outside Git under `/workspace/previews/final-report-review/`, using synthetic data only.

## Meta security fixes and rollout

- New connections request `ads_read` only. Removed broader `business_management`; no `ads_management` requested.
- Graph reads use bearer headers, no-store requests and timeouts. Tokens are removed from pagination URLs. Only HTTPS `graph.facebook.com` pagination is allowed. Account discovery follows pages instead of stopping at 100.
- Added app-secret proof when META_APP_SECRET is configured. Enable the corresponding Meta app requirement only after verifying in your controlled test setup; code alone cannot change Meta app settings.
- OAuth errors no longer include raw provider response bodies/credential-bearing request failures.
- Stored Meta tokens use authenticated AES-256-GCM encryption. Existing plaintext records are upgraded on the next successful account listing/sync; untouched legacy rows remain plaintext until then or reconnection. The database/cloud provider's at-rest encryption and this application encryption are separate protections.
- Preferred dedicated key: optional server-only `META_TOKEN_ENCRYPTION_KEY` containing at least 32 random characters (generate locally with `openssl rand -base64 32`). Existing AUTH_SECRET/NEXTAUTH_SECRET is the fallback (also 32+ characters); it is not exposed to clients. Introducing a dedicated key can still read envelopes made with the current auth key. Rotating/removing all previous keys requires reconnecting Meta; preserve secure backups/key rotation procedures.
- Existing broad grants are **not** narrowed by changing code. Remove the old NextReport connection in Meta Business Integrations and reconnect to consent to the narrower scope. Do this first with the owner's test account, not by disconnecting customer accounts automatically.
- Keep public CSV-first launch. Wizard API import remains hidden; server sync remains off unless `AD_PLATFORM_API_SYNC_ENABLED=true`. No flag, Meta account, Google account or production deployment was changed.

## Remaining acceptance work

1. Review/merge the fix PR, then deploy with the existing stable AUTH_SECRET; optionally configure the dedicated Meta key first. Never paste keys into chat or a PR.
2. On a test client, run all four CSV workflows, review/publish, download the PPT, test the public link, email a controlled inbox, and reconnect/create Google Slides. Confirm Drive permissions match the intended sharing audience (the current Slides flow creates link-readable files).
3. In controlled Meta testing, verify least-privilege consent, revocation, expired-token recovery, inaccessible ad-account rejection, >100-account pagination, and API-vs-CSV parity for spend/results/reach/attribution/timezone/currency. Read-only access still exposes commercially sensitive reporting data if compromised; no zero-risk claim is made.
4. Existing customer scheduling, approval-gated auto-send, delivery retries/idempotency and destination-specific configuration are a separate feature. Existing maintenance crons do not schedule client reports. See REPORT_AUTOMATION_PLAN.md.

## Final automated results

| Check | Result |
|---|---|
| Combined PPT, new workflow-output, Meta/token/email and API suites | PASS — 410 tests across 35 files, including all 311 PPT tests and 52 API tests |
| Report-choice regression command | PASS — 279 tests |
| Reporting-accuracy regression command | PASS — 496 tests |
| TypeScript and production build against explicit local database | PASS |
| Scoped lint | PASS — no errors; four existing unused-variable warnings in render.test.ts |
| Browser view matrix | PASS — four actual report-view components × four widths (320/390/768/1440) × two themes; no document overflow or page errors, PPT links present, both monthly charts present |
| PPT package and external renderer | PASS — eight sample decks; all internal relationship targets resolve; LibreOffice conversion succeeds |
| Production HTTP | NOT VERIFIED — workspace CONNECT gateway returned 403 before reaching nextreport.in; this is not evidence of an origin error |
| Real Meta / Google / email delivery | NEEDS OWNER TEST — no authorized connected test account/provider acceptance available |

The browser view matrix uses synthetic saved-report data and the real view components/CSS; it does not exercise authenticated upload/storage/email provider requests. Current production remains #660 until this fix PR is reviewed and deployed.

# Approved-budget monitoring — first release

The client's existing monthlyBudget is approved whole-account Meta media spend, excluding tax and agency fees. Monitoring is opt-in; saving a budget alone does not authorize email delivery. The owner can enable monitoring and owner email on the client Manage page. No campaign writes, automatic pausing, or hard spending caps.

## Scope and rules

- Query account-level Insights directly, all_days, from the start of the current month through today in the linked ad account's timezone. No campaign/status filters or summing ad sets.
- Confirm currency/timezone against Meta before accepting spend. Missing/malformed/error responses are not zero; an empty successful Insights data array is no delivery.
- Show actual current-month spend, budget remaining and amount over budget. 80% actual spend triggers approaching; 100% triggers reached/exceeded. Projected warning uses more than 105% of budget and at least three completed days. Actual spend takes precedence. Month-end projection uses a separate full-period spend query through yesterday, excluding the incomplete current day.
- Configuration/month changes invalidate displayed snapshots. Failed checks keep prior facts explicitly marked with an error and prior successful timestamp; snapshots older than 26 hours are stale. UI never triggers Meta calls merely by loading a page.
- Email: agency owner only, at most one immutable message per account/configuration/month/alert level. Provider idempotency and durable EmailDelivery recovery are reused. Pending messages are cancelled if monitoring, email, configuration, month or alert level becomes obsolete. Missing Resend config/failed sends remain visible in-app.
- GET/POST are owner-authenticated. Checks have a five-minute cooldown and database lease; a settings change during a scan prevents committing outdated facts or queuing an alert.

## Deployment

1. Deploy the migration via the normal Prisma migration process, followed by generated client/build. Existing clients start with monitoring off.
2. Existing CRON_SECRET and Resend settings are required. Check provider usage/limits in Resend; this change does not assume or require an upgraded plan.
3. Vercel config includes one daily sweep at 03:15 UTC. This is a daily snapshot service, not real-time overspend protection. For intraday notifications, configure a secure scheduler every 15 minutes to GET `/api/cron/budget-monitor` with `Authorization: Bearer <CRON_SECRET>`; do not put the secret in a URL. Verify hosting plan support before moving the Vercel cron to sub-daily frequency. Do not expose the secret in client code.
4. Sweep is oldest-first, bounded to 50 accounts and a wall-time budget with at most three scans concurrently. A nonzero remaining count requires another invocation; production scheduling frequency must drain the backlog. Monitor failed/remaining counts and provider quotas as usage grows. A daily fallback alone cannot guarantee all accounts remain current at high volume.
5. On Express Text: confirm account binding and client currency/timezone, save the intended monthly budget, enable monitoring and run Check now. Independently verify MTD account-level spend (including today) in Meta. This must be a live owner-approved check; automated unit tests do not establish production Meta/Resend configuration.
6. Test 80%, budget reached, projection after day three, disabled email, changed budgets, revoked access and the next month. Confirm provider acknowledgement and no duplicate email on retries. Do not change a customer's live budget merely to exercise an alert.

Scheduling drafts, performance/GA4 dashboards and custom templates remain separate Phase 2 deliveries. The linked GA4 property is not queried or modified by this release.

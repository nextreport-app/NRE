# Scheduled reporting recommendation

Status: proposal, **not implemented or enabled by the workflow-review PR**. Do not send customer reports or change external account settings without the owner's explicit rollout decision.

## Recommended sequence

1. Launch dependable CSV reporting and manual review/send first.
2. Test Meta API sync privately against CSV exports, with reporting-only grants and protected tokens.
3. Add **scheduled draft → owner notification → review → Send now** before automatic client delivery.
4. Offer opt-in auto-send after freshness, accuracy, authorization and delivery reliability are demonstrated.

A draft approval step reduces accidental distribution of incorrect numbers but does not remove security obligations for stored tokens/data.

## What exists now

- CSV-driven report generation, PPT download, browser share links.
- Owner-initiated email of a completed report's share link.
- Google Drive/Slides export after Google authorization.
- Optional generation notifications to Slack/generic HTTPS automation webhooks.
- A durable email intent/lease/provider-idempotency mechanism for lifecycle emails that can be adapted for report delivery.

There is no per-client recurring schedule, delivery destination registry, pending-approval policy, scheduled data refresh, report-delivery outbox, or customer scheduling UI. Existing report-generation notifications must not accidentally become client delivery before approval.

## Is API sync required?

An API is the most practical source for unattended fresh Meta data, but it is not the only option. A controlled Drive folder/inbox/object-store integration could ingest a fresh CSV on schedule. Manual CSV uploads can also queue a report for a later delivery time. Scheduling cannot produce fresh reporting data when no new source is available.

The automation path must enforce freshness and requested coverage. It should skip and notify the owner when source data is stale, incomplete or expired; it must not silently apply the manual wizard's latest-CSV fallback and send last week's dates again as a new report.

## Monday 9:00 workflow

Store client/delivery IANA timezone, weekday/time, report type, reporting-period rule, campaigns/ad sets/metrics, source account, recipients/destination, retention and approval mode. Compute next run with DST support. Prepare the report before the delivery deadline and queue work within shared generation capacity; a 100-client batch cannot all start rendering at exactly 09:00.

A scheduler claims due records atomically, fetches fresh data, runs existing validation/accounting safeguards, generates a versioned draft, and notifies the owner. Approval freezes the version and recipients. A separate worker sends that approved version and records provider acknowledgement. Editing a report after approval requires a new version/approval.

Use a unique schedule/client/period/version/destination delivery key, provider idempotency, durable retries/backoff and a failed-delivery state. Double clicks, webhook retries, restarts and daylight-saving transitions must not create duplicate reports or emails. The current manual report-email counter is not a scheduling/deduplication system.

Verify recipient ownership/authorization and destination configuration; prevent open relay, private-network webhook targets and leaked report tokens in logs. Restrict OAuth permissions for any new destination. Do not claim to send from an agency's own domain until its sender/domain is verified. Honor unsubscribe/disable controls where applicable.

Retention must outlast the intended client's access window; the default seven-day report retention can expire links between weekly sends. Public bearer links should be treated as confidential and allow rotation/revocation. Invalid/expired billing, revoked source consent or disconnected destinations must pause future work.

## Cost and launch scope

Scheduling can be included in the existing paid plans without an extra customer fee, subject to documented fair use. It is not inherently free to operate: rendering workers, AI, storage, API usage/rate limits, email delivery, monitoring and support all have cost or quota limits. Meta reporting API access is different from buying a third-party automation service; verify current provider terms/account limits rather than assuming unlimited free use.

Existing Vercel configuration schedules maintenance jobs once daily. Check the actual Vercel plan's cron frequency, duration, precision, commercial-use terms and queue/concurrency limits before promising per-timezone 9:00 delivery. Free allowances may cover a pilot; do not promise exact-time unlimited scheduling on them.

At 100 clients × weekly reporting, one agency could request roughly 430 reports/emails per month before revisions. Measure cost per successful report and per active account before promising unlimited unattended automation at $20/month. Start with one schedule per client, standard weekly/monthly presets, email and browser links, approval required, and transparent retry/failure notifications.

# Launch journey and lifecycle email review — 27 October 2026

## Product judgment

Keep the four steps: Import → Campaigns → Metrics → Generate. They separate decisions that affect accuracy. Reducing the number of steps would not remove those decisions; it would concentrate them on a busier screen. The friction was optional setup and repeated guidance competing with the next action. A premium experience should make the next action obvious, preserve work on errors, and explain exceptions clearly.

Implemented journey: signup → verify email → add a client (name, currency, timezone) → CSV import → review campaigns/objectives → review metrics → confirm dates/checks and generate → preview/edit → download or share. Currency and timezone remain explicit because they affect interpretation. Branding, budgets, template, notes, comparison history, account connections and Drive are optional. Meta API remains visible for testing; this review does not certify API accuracy or enable untested platforms in the wizard.

- Empty client workspace has one primary first-report action and expandable help.
- Unverified users receive the verification instruction before filling a client form.
- New-client creation opens report import directly. Partial logo-upload failure reuses the created client on retry rather than creating a duplicate. Network errors release the loading state.
- Client report generation appears before optional setup; settings and previous-month inputs collapse. Existing budget links open their containing panel.
- Account Settings owns agency branding, storage/retention, connections, automations, account access and billing. Client Settings owns that brand’s currency, timezone, template, budget, logo and notes. Account navigation links make the long page easier to scan. Google Ads, GA4 and TikTok connection sections remain visible for OAuth review.
- Weekly report setup and help are compact; report-type choices remain available. Metrics initially shows one campaign, with access to all others. Invalid selections force relevant review panels open. Warnings and formula/objective logic are preserved.
- Existing generated-report and sharing design is retained. No speculative full visual redesign or new mandatory setup is introduced.

Next product experiments: observe five agencies making their first report without coaching, measure signup-to-first-report time and where they stop, and verify they can identify reporting dates and share the right link. Avoid adding templates, dashboards or team roles before this path is reliable. A zero-customer product cannot infer willingness to pay from owner-generated report counts.

## Daily owner digest

Schedule remains 18:30 UTC = midnight IST. The screenshot’s 00:53 arrival alone cannot establish whether the scheduler, provider or inbox forwarding delayed it. Actual invocation and delivery require Vercel and Resend logs. An exact midnight arrival is not guaranteed by this code.

The digest now counts successful completion receipts in the previous IST calendar day, across all accounts/plans/platforms. It reports completed generations, reporting accounts, distinct client workspaces, owner/admin versus other account reports, failed generations, current processing backlog, plan/platform/report-type breakdowns and a bounded account summary. “Reporting accounts” replaces ambiguous “active users”; this is not login analytics. Preparation time is shown separately from arrival. A zero-report day is still reported. Re-publishing does not count as a fresh generation.

Completion receipts commit with report completion and survive report/client deletion. One report/outcome has one receipt. Historical existing complete reports are backfilled from creation dates/current plan, explicitly marked legacy; historic completion times, previous plan changes and previously deleted reports cannot be reconstructed. Owner/admin categorization relies on configured admin identities. Counts are operational indicators, not billing invoices.

## Lifecycle and Resend reliability

Previously the reminder selected trials 24–48 hours before expiry, launched email without awaiting it, and set the sent marker regardless of provider acknowledgement. There was no expired-trial notice. These are corrected:

- Welcome email explains the CSV-first path, 3-client / 10-report trial and optional connections.
- Final-day reminder selects verified, non-admin trial users with 0–24 hours remaining. The existing daily schedule runs at 14:30 IST; reminder arrival is not exactly 24 hours before expiry.
- Expired notice selects recently expired verified trials (up to two days late for outage recovery), avoiding a blast to old inactive trials.
- Trial expiry already blocks new client creation and report generation server-side. Sign-in and existing available reports remain accessible; retention continues. No automatic trial charge is taken.
- Upgraded/deleted/admin accounts have obsolete queued trial mail cancelled before sending. No reminder is marked sent until Resend returns a message ID.
- Durable email intents freeze content and use stable provider idempotency keys, atomic claims, leases and bounded retries. An ambiguous send beyond a conservative 23-hour window goes to REVIEW for provider-log inspection instead of risking a duplicate beyond Resend’s deduplication window. Queue creation bounds that window conservatively; an old queued message can therefore require review sooner after its first request.
- Provider acceptance does not prove inbox delivery. Bounces, spam placement and domain authentication still need Resend monitoring. This PR does not add a delivery-webhook dashboard.
- Cron retries up to 30 queued messages, then processes up to 100 lifecycle notices. Daily scheduling and batch limits are suitable for this prelaunch volume, not a guarantee for thousands of concurrent signups. Move to a frequent dedicated queue worker as usage grows; inspect remaining/review counts and provider errors.
- Financial payment confirmation remains authoritative even if its notification fails; confirmation mail is queued and deduplicated by payment ID.

No real customer/test emails were sent during automated verification; Resend was mocked. Confirm production RESEND_API_KEY, sending-domain SPF/DKIM/DMARC, CRON_SECRET, cron invocation logs and recipient configuration after deployment. Run a controlled real signup/reminder/digest smoke test with an owned inbox. OAuth console approval and live Google connection behavior remain external checks.

## Data and rollout

Two additive Prisma migrations are required and run through the existing deploy build. New completion receipts retain identifiers/outcome/platform/type/plan/time for 90 days, without CSV contents, names or email addresses. Accepted queued email bodies are scrubbed after 30 days while deduplication tombstones remain. Privacy wording describes these records. Unresolved delivery records retain their content for investigation; resolve/cancel them rather than allowing an indefinite queue backlog.

Merge only after CI passes. Deployment does not retroactively repair old generated decks or recover historic deleted records. Watch the first daily digest, the trial cron response and Resend logs after deployment. This PR changes onboarding and operational tracking, not numeric aggregation formulas.

## Validation

- Lifecycle/email tests: 13 passed, including real local PostgreSQL concurrency, provider failure, upgrade cancellation, final-day/expiry selection, completion-day boundaries, deletion survival and repeat-digest deduplication. Provider calls were mocked.
- Existing launch/billing/access safety: 101 passed; reporting accuracy: 101 passed; API route integration: 27 passed.
- Browser: unverified gate, optional creation fields collapsed, direct create-to-import navigation, collapsed client settings, budget deep link, all account connections present, 390px layouts without horizontal overflow, no page exceptions. Found/fixed nested buttons in CSV help that caused an actual hydration failure.
- Browser failure injection: interrupted client POST recovered; subsequent successful creation plus failed logo upload retried using one PATCH, with exactly one client creation.
- Local walkthrough did not send real email, connect ad accounts or upload to production Blob. Later wizard generation behavior is covered by engine/API regression tests, not a claim of a full live-provider end-to-end test. Local external asset requests encountered network tunnel errors.
- Synthetic digest preview was rendered locally. No private uploaded client data was added to this PR.

TypeScript and production build passed. Changed-source ESLint has no errors; the existing client-logo `<img>` performance warning remains.

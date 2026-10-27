# Launch billing, authentication and capacity audit

27 October 2026 (IST). Scope: public pricing, signup/login/reset, checkout verification, subscription lifecycle, client capacity, report admission, worker retries and storage cleanup. This is a targeted code review with adversarial tests, not an independent penetration test or a production load certification. No live payments, production database changes, emails or console configuration changes were performed during the review.

## Approved launch offer

| Plan | Active client workspaces | Report allowance |
| --- | --- | --- |
| Seven-day trial | 3 | 10 successfully generated reports; failed jobs refund their reserved credit |
| Agency | 10 | No monthly report quota; technical safeguards below apply |
| Professional | 50 | No monthly report quota; technical safeguards below apply |
| More than 50 clients / bulk automation | Contact support | Assess usage and infrastructure before quoting |

Deleting a client frees a slot. It deletes that client's history and invalidates its live report links. A workspace is one brand, across eventual supported platforms; it is not one slot per platform. Meta CSV is the tested launch path. Meta API stays available for owner testing; Google Ads/TikTok/GA4 are roadmap capabilities, not certified live features. Account Settings connections stay visible for OAuth review.

Client count is an active-workspace commercial rule. It cannot prove the number of advertisers behind manually uploaded CSVs. Rotating clients or reusing a workspace remains possible, intentionally, and email verification/rate limiting does not eliminate determined multi-account abuse. Do not claim unique advertiser or lifetime-client enforcement.

## Concrete defects corrected

| Before | Correction |
| --- | --- |
| Valid HMAC plus a browser-supplied plan could grant a different tier; no purchaser binding or capture check | Server-created checkout records bind owner, amount, currency, interval and tier. Provider payment/order/subscription/invoice are fetched and checked. Browser tier is not authoritative. |
| One-time payment could grant paid access indefinitely | Paid-through date is persisted and enforced; month/year periods clamp at calendar month-end. Replaying an old proof does not start a new period. |
| Repeated browser/webhook proofs could repeat application | Durable payment IDs are applied once in an owner-row transaction. Paid expiry does not move backward for the same tier. Older events cannot overwrite a newer paid purchase. |
| New checkout immediately cancelled the previous subscription | No cancellation occurs during checkout creation; current paid customers use support-assisted plan changes at launch. Recurring checkout attempts reuse the existing pending subscription. New subscription authorization links expire after 24 hours. |
| Old cancellation could deactivate a newer subscription | Cancellation only matches the currently stored provider subscription ID; paid access remains valid to its paid-through date. Authenticated/activated events alone grant no paid access. |
| Transient webhook failures were caught and acknowledged as success | Provider/DB failures return non-2xx for retry. Unknown checkout metadata requires retry/reconciliation. |
| Configured provider plan could charge a different price/currency/interval from the website | Fetch and compare the remote plan against the server catalogue before opening recurring checkout. An unconfigured currency/interval can explicitly use one-time checkout instead. |
| Count-then-create allowed concurrent client-cap bypass | Owner-row transaction locks count + create + analytics increment on both create and duplicate paths. |
| No durable trial report quota or shared job admission | Atomic generation admission reserves quota and limits one in-flight job per account, three globally. Credits survive report/client deletion. Failure refunds are idempotent. |
| Worker retries/fallbacks could render one job twice | Atomic worker claim with a ten-minute recovery lease; completed jobs cannot be claimed. Existing function maximum is five minutes. |
| Expired accounts could invoke expensive analyze/preview/sync endpoints directly | Server subscription + verification guards and shared request throttles cover wizard work. Exhausted trial credits also block new expensive pre-generation work. |
| Preview could spend AI credits repeatedly before Generate | AI warm-up is off by default; generation admits work before AI. AI slide processing is bounded to two slides at once (each has summary/insight calls). |
| Unbounded multipart copies and compressed workbook expansion | Uploaded files reject above 4 MB before buffer copies; ZIP expanded size and actual inflated member sizes are checked before SheetJS. No rows are silently truncated. Standard reports reject more than 50 campaign/ad-set detail slides; job payloads reject above 8 MB. |
| Public signup/login/reset lacked shared brute-force controls and email proof | Hashed database rate buckets, email verification, resend flow and protected operations; Google identity linking requires Google's verified-email claim. Admin override requires verified email too. |
| Reset token could be consumed concurrently; old sessions survived | Atomic reset-token consumption and user session-version increment; authenticated server requests invalidate prior JWT sessions after reset. |
| Login callback could feed an unsafe URL to the router | Only local application paths are accepted; executable/external callbacks are rejected. Signup/login network failures recover the submit controls. |
| Custom Google connectors had state but no PKCE or owner-bound verifier | S256 PKCE for Google Ads, GA4 and Drive; short-lived HttpOnly verifier cookies bind to the initiating user and clear on callback. Google login explicitly uses state + PKCE and remains feature-flagged off. |
| Deleting a client removed rows but left report storage behind; failed storage deletes lost retry intent | Transactional storage-deletion outbox for client/report deletion and retention; successful deletions clear intent, failures remain for the next drain/cron. Active generation must finish before deletion. |
| `Report.emailsSent` existed only in schema, not migrations | Idempotent missing-column migration works for both clean databases and manually patched installations. |

Public pricing now removes the unsupported “Most Popular” label, unlimited-client promise, automatic Drive-save promise, and an added-GST claim that did not match checkout. Existing translated commercial feature lists fall back to updated English so old translations cannot advertise unlimited clients. Current price amounts are unchanged; no Razorpay dashboard prices were modified.

## Pricing recommendation

The old ₹1,299 / $15 unlimited-client offer was too open-ended. At 50 clients generating four weekly reports plus one monthly report each, 250 reports/month earns only ₹5.20 or $0.06 gross per report before payment fees, AI, hosting, storage, support and applicable taxes. Higher frequency makes that worse. “Unlimited generation” means no monthly credit meter, not unlimited simultaneous work or guaranteed infrastructure capacity.

Treat current ₹799/$9 Agency and ₹1,299/$15 Professional prices as a short introductory experiment, not a permanent high-volume commitment. With no agencies yet trying/paying, willingness to pay is unvalidated. A next experiment could be Agency ₹1,499–₹1,999 / $19–$29 and Professional ₹4,999–₹6,999 / $59–$79, with custom onboarding for larger accounts. Those are hypotheses, not proven market prices. Do not change provider plans silently; create matching new provider plans and update catalogue/environment mappings together after deciding prices.

Keep two paid tiers. Keep the seven-day no-card trial with its useful sample allowance. Avoid extra per-platform charges at launch. Charge for the client roster, volume needs and support level after measuring actual cost. Avoid annual discounts locking in an untested margin until several agencies use their own exports successfully. Annual checkout remains supported here, not silently removed.

The checkout catalogue currently represents the amount actually charged. Confirm GST registration, inclusive/exclusive treatment, tax invoices and international collection eligibility with the appropriate provider/accountant before accepting money. This code does not calculate/remit GST or create statutory tax invoices.

## Infrastructure and operational limits

Code safeguards reduce accidental overload. They cannot make free hosting support arbitrary paid traffic or prevent provider quotas from exhausting. The app stores PPTX files in **Vercel Blob**, while Supabase stores structured data, report JSON/archives and queued payloads; both need monitoring. Email, AI APIs, downloads and client-facing share traffic add costs beyond generation.

A 200–250-client agency is outside this launch tier. Do not onboard it by deleting the cap or promising a free-tier SLA. Use a paid commercial-eligible Vercel plan, suitable Supabase capacity/backup plan, pooled runtime database URL, storage budget alerts and a durable queue/worker design before large-volume onboarding. Confirm current provider allowances in the actual dashboards: no dashboard access was available for this audit. Public provider documentation was blocked by the network during review, so no exact current quota numbers are asserted here.

Provider references: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [function limits](https://vercel.com/docs/functions/limitations), [Supabase plans](https://supabase.com/pricing). Vercel Hobby is intended for personal/non-commercial use; verify commercial eligibility for this paid SaaS. Do not equate automatic temporary-capacity rejection with a durable queue: the current dispatcher still relies on HTTP/after() and a daily stuck-job recovery cron. Monitor stuck jobs; controlled throughput tests are still required. Shared admission is fail-closed when the database is unavailable.

Request protections currently allow 30 wizard requests/minute per account; upload/sync attempts additionally cap at 20/day for trial or 100/day for paid accounts, while other wizard work caps at 120/day or 1,000/day respectively. Publishing an edited deck is separately limited to three requests/minute; it is not a new report credit. Its Blob replacement keeps the old object until the new write succeeds rather than deleting it first. These are fixed-window technical limits, disclosed alongside fair use. They are not a guarantee of free-tier affordability.

Monitor: queued/running/failed generation age, peak function duration/memory, provider 429/5xx, AI tokens/cost per successful report, Supabase database size and connections, Blob size/egress, rate-limited requests, email delivery, unprocessed deletion-outbox rows, checkout/payment mismatches and webhook failures. Set spend alerts and a monthly budget. `REPORT_GENERATION_PAUSED=true` is an emergency stop for new work. Keep `ENABLE_PREVIEW_AI_WARM` unset/false at launch.

One account can still make many paid reports sequentially. There is no monthly paid report quota or automatic whole-service storage-budget cutoff. Fair-use terms, monitoring, WAF/bot controls and operator response are required. Refund/dispute processing and provider-side reconciliation still need an operator procedure; this is not a complete accounting/chargeback system. Existing orphan blobs from before this change are not automatically identifiable from deleted rows; inspect storage before launch.

## OAuth and authentication review

Login/signup keep Google sign-in disabled until `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED=true` is deliberately set. Basic Google login requests identity scopes; Ads/Analytics/Drive permissions belong to separate Account Settings connections. Do not request ad-account permissions simply to log in. Password login, reset and verification remain usable independently of Google's app review.

The screenshots do not establish the exact reason for the previous Google access error. They show pending verification and a secure-flow warning. PKCE changes improve the app flow, but do not certify or clear Google's console checks. Inspect the exact OAuth error code, Web application client type, production authorized domain, HTTPS redirect URIs and client ID/secret pairing. The production redirect URIs to check, for whichever clients serve each flow, are `https://nextreport.in/api/auth/callback/google`, `https://nextreport.in/api/google-ads/callback`, `https://nextreport.in/api/ga4/callback`, and `https://nextreport.in/api/google-drive/callback`. Add only intended stable staging callback URIs to a separate test configuration; arbitrary preview domains are not automatically authorized. Confirm state/PKCE and cancellation/error paths using an external test account after deployment. Ads uses Google's broad adwords scope because that API exposes it; the application should continue using read-only reporting operations. GA4 uses analytics.readonly; Drive uses drive.file.

Email verification is now required for adding clients and expensive report operations, including existing owner/admin accounts. A password reset proves inbox possession and verifies the address; a verified Google login does likewise once enabled. Verify the owner account before testing reports after deployment. Resend must be configured and the sender domain verified; missing email delivery does not silently verify accounts. End-to-end delivery is an external acceptance check, not something the mocked tests certify.

## Deployment and acceptance

Four additive migrations add paid expiry/trial counters, checkout/payment ledgers, shared usage buckets, worker claim/credit state, the missing email counter, storage deletion outbox and auth session versions. Test on an isolated preview database first; do not point a preview at production casually. No synthetic paid expiry was assigned to legacy paid rows. Although the owner reports no paying customers, reconcile any seeded/test paid account against Razorpay before deployment, or use a verified ADMIN_EMAILS owner override. Seeded paid plan names alone no longer grant perpetual access.

Before public paid launch, test provider **test mode** for every enabled currency/interval: valid payment, abandoned checkout, declined payment, unsigned/forged/wrong-owner proof, duplicate callback/webhook, delayed webhook, recurring renewal/failure, cancellation at period end and expired access. A plan change is support-assisted at launch; self-service proration is not implemented. Do not pay twice to test an upgrade. Missing recurring mappings use an explicitly described one-time purchase; USD recurring availability depends on merchant approval/provider support, not this currency selector.

Use external email accounts to test signup verification, resend, one-use links, password reset and previous-session invalidation. Test 10→11 Agency clients and 50→51 Professional clients, deleting/replacing a client, and duplicate requests. Generate several representative manual CSV reports and recheck deck totals. Then run a controlled multi-user workload against preview, with real file sizes but bounded AI spend, before widening the beta. No live-mode charges were made by this review.

## Dependency security review

The production-dependency audit initially reported 28 findings (one critical). Next.js and matching ESLint config were upgraded from 16.2.11 to 16.4.3; Blob SDK and application Zod were updated, along with compatible transitive fixes. The resulting audit reports **zero critical and four high findings**, not a clean audit. The four findings trace to one nested Zod advisory in the Blob SDK's Vercel OIDC/CLI configuration dependency chain; application request validators use patched Zod 4.6.7. The reviewed SDK path handles local CLI configuration, not user CSV/request content. Production uses the explicit `BLOB_READ_WRITE_TOKEN`; do not remove that configuration or treat this reachability review as a blanket exemption. Track an upstream-compatible patch; do not force a major Zod override into an SDK expecting Zod 3 without compatibility tests.

The abandoned npm `xlsx` 0.18.5 package had prototype-pollution and ReDoS advisories. Official SheetJS CDN and source-host downloads were blocked (HTTP 403) in this environment. The replacement is the exact pinned alias `npm:@e965/xlsx@0.20.3`, a **third-party republisher**, not an official SheetJS npm package. Its published npm provenance metadata and public publisher recipe were inspected; the recipe downloads the vendor tarball and changes README/name/repository metadata. The lockfile pins integrity. The blocked upstream download prevented an independent byte-for-byte comparison to the vendor tarball. Excel compatibility and normal/malicious workbook-budget tests passed after replacement. Review this supply-chain choice explicitly; moving to a directly obtained verified vendor artifact remains preferable when available. The audit no longer flags the two old SheetJS version ranges. This is not a guarantee that every parser input is safe.

A compact machine-readable receipt is committed at `docs/audits/launch-dependency-review.json`. Private files, credentials and raw client exports are not included. No forced major dependency upgrades were applied.


## Validation receipts

The local clean-migration test applies all 54 migrations, including the four new migrations. A dedicated PostgreSQL suite exercises concurrent client creation, trial credit admission/refunds, cross-user capacity, atomic worker claims, shared rate buckets, single-use verification/reset tokens, session-version increments, server-authoritative payment tiers/ownership, payment replay, cancellation isolation and retryable webhook failure. Provider calls and delivery notifications are mocked in these tests; they do not charge cards or send email.

A separate browser exercise used an anonymous local fixture: password login succeeded; unverified client creation returned 403; a verification token returned 200; verified creation returned 201; password reset returned 200; an API call with the previous session returned 401. Email tokens were seeded locally to exercise the application flow; delivery itself still requires a real inbox test. Public pricing/login/signup/verification pages were checked at desktop/mobile widths, with no horizontal overflow and Google sign-in disabled. The private fixture is removed after testing.


Final focused checks: 101 launch-safety tests (12 files, including 12 PostgreSQL integration cases), 101 reporting-accuracy tests, 57 objective regressions, 27 API route tests, and the Excel/CSV parsing compatibility checks passed. Counts overlap and should not be summed as distinct coverage. Changed-source ESLint and TypeScript checks passed. The production Next.js build and all additive migrations passed locally. GitHub now runs the launch-safety suite against its own ephemeral PostgreSQL service. A whole-repository test-clean claim is not made.

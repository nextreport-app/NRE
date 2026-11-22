Current decision/status rules and comparison settings: see [objective decision layer](objective-decision-layer.md). The original implementation notes below describe the initial baseline.

# Agency overview and Meta performance signals

Open **Overview** in the app navigation or **View Meta performance & signals** on Client Manage. Initial load and Reload overview read saved snapshots only; they do not call Meta. Search, attention/check-needed filters and expandable campaign tables keep multi-account review compact. Currency totals are never combined across accounts. Existing approved-budget alerts appear beside performance, with their own opt-in and refresh controls.

## Enable and check

- Link each client's Meta account, match its currency/timezone, and enable **Monitor Meta performance** in Overview → Performance & settings. It is off by default. Owner warning emails default on when monitoring is enabled and can be disabled independently. No client recipients are used.
- **Check Meta** imports a fresh Meta API source through the tested CSV normalization and objective-based comparison engine. No stored CSV, template, report generation or report credit is involved. Checks are leased and limited to once per five minutes per client. Failed sync retains prior figures with a warning; stale/failed/disabled snapshots do not count as current performance alerts.
- Windows are the last seven **completed account-local days** and the previous seven, excluding today. A snapshot becomes stale when its window no longer ends on that account's yesterday, or after 26 hours. Late conversion attribution can revise results.
- The daily authenticated `/api/cron/performance-monitor` sweep is included in Vercel configuration at 03:45 UTC (09:15 IST). This is a daily sweep, not real-time monitoring. It examines up to 50 opted-in accounts, oldest first, in batches of three, with a bounded execution budget. Monitor `remaining`, `failed` and endpoint failures; configure a more frequent authenticated scheduler as account volume/latency grows. No hourly guarantee is made by the UI. Manual Check Meta is always available to eligible accounts.

## Metrics and conservative signals

Account totals show spend, impressions, CTR (all) and CPC (all). CTR/CPC are recomputed from explicit all-click counts, never averaged from daily ratios or inferred from rounded percentages. Missing clicks mean unavailable CTR/CPC. Unique reach/frequency are not added from daily/ad-set rows. Results and cost per result appear **per campaign with its own objective**; leads, purchases and link clicks are not summed into an account result total. Goal changes, mixed result types or missing result evidence suppress result comparisons. This first view is not a full Ads Manager replacement; ROAS, arbitrary date ranges and ad-set drilldowns are later work.

Current thresholds compare the two equal windows:

| Signal                   | Relative change    | Evidence required in both periods unless specified                                                                        |
| ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| CTR (all) down           | at least 20%       | 1,000 impressions each; 30 prior all-clicks, 10 current                                                                   |
| CPC (all) up             | at least 25%       | 1,000 impressions and 30 all-clicks each                                                                                  |
| Cost per result up       | at least 25%       | Comparable objective/result evidence; 1,000 impressions each; 10 prior and 5 current results                              |
| Results down             | at least 30%       | Comparable objective/result evidence; 1,000 impressions each; 10 prior results; current spend at least 80% of prior spend |
| Cost per result improved | at least 20% lower | Same evidence as cost per result up; shown in app, no warning email                                                       |

Zero denominators never create infinite changes. New or low-volume campaigns may not trigger a signal. “No threshold signals” is not a health guarantee. Observed changes do not establish creative fatigue, auction competition, tracking failure or any other cause. Copy suggests areas to review, never instructions to pause campaigns. These deterministic, evidence-based explanations apply across clients; no per-client generated AI diagnosis or LLM call is made on page load.

## Notifications and rollout

Warnings use the existing durable Resend ledger, at most one queued intent per client/period-ending date. It goes only to the current verified agency owner, and retries cancel obsolete/disabled/stale snapshots, changed account bindings, recipients or refreshed snapshot versions. This deliberately favors avoiding stale emails over sending a second notice after a same-day refresh. Fresh signals stay in the app. Provider acceptance is not inbox delivery; existing provider deduplication/review rules remain in force. Budget alert email behavior is unchanged.

Apply migration `20261122000400_performance_monitor` and regenerate Prisma using the normal build. It works alongside the scheduled-report drafts added in merged PR #782. No real account is automatically opted in. No production credentials, email, Meta data or settings were changed during development.

After deployment: enable Express Text only, Check Meta, compare both exact seven-day windows against Ads Manager and its synced-source report tests, verify objective-specific results and all-click ratios, then test an owner-controlled email and disable it if desired. Meta/Resend production acceptance remains required because live credentials were unavailable in the development workspace. GA4 website traffic belongs in a separate linked-property dashboard; do not link the NextReport GA4 test property to Express Text.

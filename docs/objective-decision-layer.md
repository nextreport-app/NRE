# Meta performance decisions

Agency overview now prioritizes observed business outcomes, with evidence and suggested checks. All Meta access remains read-only. Report generation and existing report CSV calculations are unchanged.

## Status rules

- **Critical:** primary results fall to zero from at least 5 while current spend remains at least 80% of prior spend, positive spend continues and current impressions reach 500. A saved cost target also flags zero results after spending twice that target. This requests investigation, not an automatic pause or a claim of tracking failure.
- **Review:** result costs increase at least 25%; primary result volume falls at least 30% with maintained spend; purchase ROAS falls at least 20%; or an agreed campaign target is missed. CTR down 20% and CPC up 25% are supporting diagnostics. CPC changes do not establish auction competition as the cause.
- **Improving:** qualified result cost falls at least 20%, results rise at least 25% at stable/better unit cost, purchase ROAS rises at least 20%, or a saved target is met. Primary warnings override positives; supporting CTR/CPC warnings do not erase a qualified primary improvement. Better CTR alone never makes a conversion campaign green.
- **No strong signal:** insufficient evidence or no threshold crossed. This is not a health guarantee.

Normal trend rules require 1,000 impressions in both periods, 30 baseline clicks (and 10 current for CTR decline; 30 for CPC), 10 baseline and 5 current results for result-cost trends, 10 baseline for declining results, and 5 baseline/10 current for growing results. ROAS needs 5 purchases in both periods. Zero-result critical rules intentionally support smaller baselines such as 8→0.

Targets are optional, campaign-ID/objective/account/currency-bound. No industry benchmarks are invented. A cost above 110% of target is a review; meeting targets requires at least 5 results. ROAS targets apply only to purchases. A goal change requires reviewing the saved target.

Budget checks retain their existing tax-exclusive approved-budget and tolerance logic. Actual material overspend is critical; material projected over/underspend becomes critical in the final 7 calendar days. Remaining daily allowance divides unspent approved budget by remaining calendar days including today; this is a planning guide, not a platform budget setting.

## Comparisons and data

Default last 7 completed account-local days versus the preceding 7; rolling 15/30 days are available. Custom ranges allow up to 31 completed days and compare the immediately preceding equal-length period. Custom comparisons are manual-only, with no recurring performance emails. Changing comparison/targets invalidates old evidence; Check Meta loads a fresh snapshot. Opening the overview only reads saved snapshots.

Purchase values use two separate campaign-level whole-period Insights queries with unified attribution and impression report time, validated dates, bounded pagination and exact result-action matching. Never sum overlapping purchase aliases or ad-set conversion values. ROAS uses campaign-level spend from that same response; the dashboard exposes that denominator separately from existing ad-set delivery metrics. Positive purchases without a matching value remain unavailable, not zero revenue. Value lookup failures preserve delivery data and display a warning. Meta attribution can revise recent results; ROAS is attributed revenue/spend, not profit.

Snapshot format is version 2. Existing version-1 performance caches need a new Check Meta or daily sweep; budget caches are unaffected. The additive Prisma migration must deploy before the new application.

## Notification lifecycle

Recent comparable snapshots retain continuing issues. Recovery requires metric-specific evidence and a recovery threshold, not missing data, stopped spend or changed objectives. Continuing issues remain in-app; emails contain only new actionable issues. Immutable delivery keys allow one review and one critical escalation per client/comparison/ending date. Existing owner verification, opt-in, freshness, current config and exact snapshot checks remain in the delivery guard. No client emails or campaign writes are introduced.

## Deployment acceptance

Automated tests use mocked Meta, database and email calls. After deployment, check Express Text against Ads Manager with identical date/attribution settings; verify a purchase account's exact action values and campaign spend before signing off live ROAS parity. Validate opted-in owner notifications with a controlled account; no real emails were sent during development. Background timing remains dependent on the deployed scheduler and provider delivery.

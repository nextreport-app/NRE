# Launch pricing and Razorpay rollout

## Prices and internal IDs

All amounts below are checkout totals. Match invoicing/tax configuration to these totals; the application does not add a separate 18% GST surcharge. Annual billing charges ten months, giving two months free compared with twelve monthly payments. The trial remains 7 days, 3 clients and 10 reports.

| Display name | Internal ID | Active clients | INR/month | INR/year | USD/month | USD/year |
|---|---|---:|---:|---:|---:|---:|
| Freelancer | `starter` | 10 | ₹399 | ₹3,990 | $5 | $50 |
| Agency | `professional` | 50 | ₹999 | ₹9,990 | $12 | $120 |
| Agency Plus | `agency_plus` | 100 | ₹1,699 | ₹16,990 | $20 | $200 |

Internal IDs for the original tiers stay unchanged. User.planId is a text field, so no database migration is required. Client limits are enforced on the server, including duplicate-client creation. Agency Plus has the same paid reporting safeguards as the other tiers and the Agency tier's retention options (up to 90 days).

The $20 cap refers to monthly USD pricing. INR is regional pricing, not a live exchange-rate conversion. India defaults to INR; other countries default to USD; explicit visitor choices persist. Report currencies remain independent of subscription currencies.

## 1. Create twelve new Razorpay plans

In Razorpay Dashboard → Subscriptions → Plans, create **new** plans using the amounts below. Do not reuse old plan IDs that still contain previous amounts, edit existing subscriptions, or cancel active subscriptions as part of this rollout. A mismatched provider plan will be rejected before subscription checkout.

Use period **Monthly, interval 1** for MONTHLY rows and **Yearly, interval 1** for ANNUAL rows. Annual is one full-year charge, not a monthly instalment. The dashboard normally asks for major-unit amounts (₹399 / $5); the API uses the minor units shown separately.

| Vercel environment variable | Currency | Dashboard amount | API minor units |
|---|---|---:|---:|
| `RAZORPAY_PLAN_STARTER_INR_MONTHLY` | INR | 399 | 39900 |
| `RAZORPAY_PLAN_STARTER_INR_ANNUAL` | INR | 3990 | 399000 |
| `RAZORPAY_PLAN_STARTER_USD_MONTHLY` | USD | 5 | 500 |
| `RAZORPAY_PLAN_STARTER_USD_ANNUAL` | USD | 50 | 5000 |
| `RAZORPAY_PLAN_PROFESSIONAL_INR_MONTHLY` | INR | 999 | 99900 |
| `RAZORPAY_PLAN_PROFESSIONAL_INR_ANNUAL` | INR | 9990 | 999000 |
| `RAZORPAY_PLAN_PROFESSIONAL_USD_MONTHLY` | USD | 12 | 1200 |
| `RAZORPAY_PLAN_PROFESSIONAL_USD_ANNUAL` | USD | 120 | 12000 |
| `RAZORPAY_PLAN_AGENCY_PLUS_INR_MONTHLY` | INR | 1699 | 169900 |
| `RAZORPAY_PLAN_AGENCY_PLUS_INR_ANNUAL` | INR | 16990 | 1699000 |
| `RAZORPAY_PLAN_AGENCY_PLUS_USD_MONTHLY` | USD | 20 | 2000 |
| `RAZORPAY_PLAN_AGENCY_PLUS_USD_ANNUAL` | USD | 200 | 20000 |

Confirm USD recurring subscriptions and international payments are enabled for your Razorpay account. Code cannot enable account-specific payment capabilities. If Razorpay does not support USD subscriptions for your account, ask Razorpay to enable them; do not put an INR plan ID into a USD setting. The existing one-time Orders checkout can be used for an unconfigured option if the account supports that currency, and explicitly does not auto-renew.

## 2. Update Vercel and deploy together

1. Test the PR preview with Razorpay **Test Mode** keys and Test Mode plan IDs. Keep test settings scoped to Preview (and Development if needed).
2. For production, create the same twelve plans in Razorpay **Live Mode**. Copy their `plan_…` IDs into the twelve variables above in Vercel → Project → Settings → Environment Variables → **Production**. Replace the eight original variables and add the four AGENCY_PLUS variables. Match every row by currency, period and amount; trim whitespace.
3. Keep `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_WEBHOOK_SECRET` unchanged if the existing Live Mode setup is correct. Never put test plans beside live keys or vice versa. No new credentials are required by this PR.
4. Coordinate the environment update with merging/deploying the pricing PR. Saved Vercel environment changes apply to a **new deployment**; they do not update an already running deployment. Do not redeploy old code with the new IDs or promote new code with old IDs, because prices will fail the provider validation.
5. After approval, merge/deploy and smoke-test all three tiers in both currencies and both intervals. A local/test build does not verify Live Mode payments. Use Test Mode for the full payment matrix; any live charge requires the owner's decision.

No cache purge, database cleanup or migration is needed for pricing. No external account changes or production deployment were performed by this code change.

## 3. Webhooks and verification

Keep the existing webhook URL `https://nextreport.in/api/payments/webhook` and secret. Verify these events remain enabled:

- `payment.captured`
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.halted`

Check successful signature verification, exactly one payment application on callback/webhook replay, paid-through date, correct plan name, and client limit (10/50/100). Test cancellation stops renewal while preserving already paid access. The application fetches authoritative provider state and rejects an amount, currency or billing-period mismatch.

## 4. Existing subscriptions and pending checkouts

New plan IDs affect **new subscriptions**, not subscriptions already attached to old provider plans. Original stored checkout amounts (including old annual totals ₹7,670.40 / ₹12,470.40 / $86.40 / $144) remain recognized for those records. Renewals can validate their original provider plan even after environment IDs change. Existing subscription prices are not silently changed.

The UI display names become Freelancer (old Agency) and Agency (old Professional), preserving their 10/50-client limits. Existing paid users still need support for a paid-plan change to avoid overlapping subscriptions; new customers can buy all three tiers directly.

An unpaid old checkout may still be open at the provider. If the application reports an already-open checkout after a price change, review/cancel that unpaid checkout with the owner before starting another; do not delete billing records to bypass the guard. The compatibility path accepts only exact known historical amounts on server-recorded checkouts, never arbitrary client-supplied prices.

For rollback, restore the prior application deployment **and** prior environment plan-ID mapping together. Preserve old provider plans for existing subscribers and rollback.

## Local verification for this change

- 95 pricing, signature/provider-plan, checkout-route, entitlement and retention unit/integration tests passed (provider requests mocked).
- 14 local PostgreSQL guard tests passed, including concurrent creation into the 100th slot and old-price renewal after provider plan IDs change.
- 52 SEO/currency/timezone/analytics readiness tests passed.
- Production build and scoped lint passed. Browser checks covered homepage/pricing at 320/390/768/1440px, light/dark, INR/USD, monthly/annual; no document overflow or page errors.
- Razorpay Test/Live Mode account configuration, actual payment delivery and production deployment remain owner actions.

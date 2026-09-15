# Razorpay Subscriptions setup

NextReport supports two billing modes:

| Mode | When | Renewal |
|------|------|---------|
| **Subscriptions API** | `RAZORPAY_PLAN_*` env vars configured | Automatic recurring charge |
| **Orders API** (legacy) | Plan env vars missing | One-time payment, no auto-renewal |

Production should use **Subscriptions**.

## 1. Create Razorpay Plans (Dashboard)

In [Razorpay Dashboard → Subscriptions → Plans](https://dashboard.razorpay.com/), create plans matching `lib/razorpay.ts` prices:

| Plan | INR (monthly) | INR (annual, 20% off) | USD (monthly) | USD (annual) |
|------|---------------|------------------------|---------------|--------------|
| Agency (starter) | ₹699 | ₹6,710 | $8 | $77 |
| Professional | ₹1,699 | ₹16,310 | $20 | $192 |

Annual amounts = monthly × 12 × 0.8 (see `amountForCurrency`).

Copy each plan's `plan_…` id into Vercel env vars:

```
RAZORPAY_PLAN_STARTER_INR_MONTHLY=plan_…
RAZORPAY_PLAN_STARTER_INR_ANNUAL=plan_…
RAZORPAY_PLAN_PROFESSIONAL_INR_MONTHLY=plan_…
RAZORPAY_PLAN_PROFESSIONAL_INR_ANNUAL=plan_…
RAZORPAY_PLAN_STARTER_USD_MONTHLY=plan_…
RAZORPAY_PLAN_STARTER_USD_ANNUAL=plan_…
RAZORPAY_PLAN_PROFESSIONAL_USD_MONTHLY=plan_…
RAZORPAY_PLAN_PROFESSIONAL_USD_ANNUAL=plan_…
```

At minimum, set `RAZORPAY_PLAN_STARTER_INR_MONTHLY` — that enables subscription mode (`isRazorpaySubscriptionsConfigured()`).

## 2. Webhook events

Point `https://<domain>/api/payments/webhook` to these events (in addition to existing payment events):

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.halted`

Use the same `RAZORPAY_WEBHOOK_SECRET` as payment webhooks.

## 3. Flow

```
SubscribeButton
  → POST /api/payments/create-subscription (or create-order fallback)
  → Razorpay Checkout (subscription_id or order_id)
  → POST /api/payments/verify (signature)
  → Webhooks keep planId in sync on renewals / cancellations
```

Cancel: `POST /api/billing/cancel` calls Razorpay `subscriptions.cancel` when `User.razorpaySubscriptionId` is set.

## 4. Local dev without plans

Leave `RAZORPAY_PLAN_*` unset — checkout falls back to one-time Orders (existing behaviour).

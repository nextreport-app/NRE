# NextReport — 30-day GTM strategy (organic only)

**Audience:** Founder-led launch, part-time build, **no paid ads budget**.  
**Last updated:** October 22, 2026 (IST)  
**Product URL:** https://nextreport.in  

This doc captures where the product stands, what is still pending (approvals + engineering), and a **week-by-week plan** for the next 30 days focused on **Meta-first agencies in India**, with organic user acquisition only.

---

## 1. Where NextReport stands today

### Strong / shippable now (especially India, Meta-first)

| Area | Status |
|------|--------|
| Meta CSV wizard → branded PPT, share link, optional Google Slides (Drive) | Live |
| Meta API sync | Live (see Meta app access notes below) |
| 7-day free trial (no card) | Live |
| Razorpay — Agency / Professional (INR) | Live (verify webhook + one real payment in prod) |
| Help: CSV export guide, walkthroughs, book demo, contact, refer | Live |
| NRE engine + CSV verification / regression gates | Hardened (treat as release requirement) |

### Built but not primary GTM yet

| Area | Notes |
|------|--------|
| Google Ads wizard | CSV + partial API; gaps vs CSV for mixed account types |
| GA4 website reporting | Separate wizard path |
| TikTok | Built; **hidden for India** visitors (geo rule) |

### Not “full global self-serve” yet

| Gap | Impact |
|-----|--------|
| **Google OAuth app verification** | Public “Sign in with Google” + Drive connect blocked for non–test users until Google approves |
| **Stripe / USD checkout** | Waitlist only; international paid signup not automated |
| **Email/password signup** | Works today — use as primary CTA while OAuth is pending |

---

## 2. Pending approvals & external gates

These are **not fixed in code alone** — track status in Google Cloud / Meta / Razorpay dashboards.

| Item | Why it matters | Workaround until approved |
|------|----------------|---------------------------|
| **Google OAuth verification** (GCP project `nextreport-503414`, number `348894619975`) | Any user can use **Continue with Google** and **Connect Google Drive** for Slides | **Email signup**; add early adopters as **OAuth Test users** in Cloud Console; privacy policy + demo video submitted — reply on Google’s email thread when they review |
| **Meta app / Advanced Access** (if customers use **live API sync** on their ad accounts) | API paths may be limited to app roles/testers without approval | **Lead with CSV** in all marketing; API for power users / your own accounts until Meta access is broad |
| **Razorpay subscriptions (production)** | INR revenue | Confirm live keys, webhook URL, test subscribe → webhook → `/billing` |
| **Stripe (USD)** | International self-serve pay | **Waitlist** + manual invoice for first 1–3 USD agencies if needed — don’t delay India launch for Stripe |

**Reference docs in repo**

- Google OAuth test users: `docs/google-oauth-test-users.md`
- Integration priorities: `docs/integration-roadmap.md`
- Platform parity (Meta / Google / TikTok): `docs/platform-parity.md`
- Launch social copy: `docs/LAUNCH_SOCIAL_POSTS.md`
- Billing: `docs/billing-subscriptions.md`

---

## 3. Long-pending product & engineering (priority order)

### P0 — trust + revenue (do before new platforms)

1. **Release discipline** — run `npm run test:objective-regression` before every production deploy; smoke one real Meta weekly report (CSV verify green, CPL sane on slide + MTD + chart).
2. **Razorpay end-to-end** — one live subscription in production; confirm webhook updates plan.
3. **Onboarding clarity** — first report in under ~15 minutes: upload → campaigns → dates → generate → share (align homepage, `/how-it-works`, Meta walkthrough).
4. **Signup messaging while OAuth pending** — “Sign up with email” primary; “Google sign-in coming soon” or test-user-only note if needed.
5. **Google Ads (only if trials ask)** — CSV path first; API parity and per-campaign channel typing remain on roadmap (`docs/integration-roadmap.md`).

### P1 — after ~10–20 serious trials or first paying customers

6. Flip marketing to **Sign in with Google** once OAuth is approved; test with a account **not** on test-user list.
7. **One case study** — hours saved per week, Meta weekly deck, anonymized if needed.
8. **Trial → paid emails** — day 5 and day 7 nudges.
9. **Stripe** — when a USD buyer is ready to pay, not before.

### Defer unless a customer pays for it

- LinkedIn / Snapchat / retail media APIs  
- Paid ads (Meta, Google, LinkedIn)  
- New platforms before Meta GTM is boringly reliable  

---

## 4. Strategic focus (one sentence)

Be the **best Meta weekly client deck** for **small Indian agencies**, sold on **correct numbers** and **time saved**, via **organic reach and direct relationships** — not platform breadth.

### North-star metrics (track weekly)

| Metric | Notes |
|--------|--------|
| Trials started | `/signup` completions |
| **First report generated** | Activation — more important than signups |
| Trial → paid (INR) | Razorpay |
| “Wrong number” / trust tickets | Should stay near zero |
| USD waitlist signups | `/api/waitlist`, pricing page |
| Book demo / contact submissions | High-intent leads |

---

## 5. Thirty-day plan (week by week)

Assume **~5–8 hours/week** product + GTM. **One product theme per week max.**

### Week 1 — Launch lane (stabilize + message)

**Product / ops**

- [ ] Post-deploy smoke: full Meta **weekly** report on production (your real or fixture CSV); CSV verification OK; spot-check CPL.
- [ ] Razorpay: one live subscription test (checkout → webhook → billing UI).
- [ ] Site copy: **Meta live · Google/GA4 CSV where documented · Sign up with email** (Google login when approved).
- [ ] Merge/deploy any pending homepage/pricing/OAuth privacy fixes.

**Organic**

- [ ] **1 LinkedIn post** — use or adapt `docs/LAUNCH_SOCIAL_POSTS.md` (founder story + https://nextreport.in/signup ).
- [ ] **2-minute Loom** (or reuse OAuth demo video style): CSV upload → deck → share link.
- [ ] Ask **3 people you trust** (ex-colleagues, freelancer media buyers) for a trial + 15-min feedback call.

**Week 1 goal:** 3–5 trials, ≥2 completed first reports.

---

### Week 2 — Trust + clarity

**Product**

- [ ] Simple onboarding path documented (in-app hints or one email): Upload → Campaigns → Dates → Generate → Share.
- [ ] Pricing/FAQ: CSV vs API, trial limits, client workspace caps, data retention (link `/privacy`, `/data-deletion`).
- [ ] Fix **top 3** UX issues from Week 1 calls only — no scope creep.

**Organic**

- [ ] **2 LinkedIn posts:** (1) Friday reporting pain, (2) short screen recording.
- [ ] **1 Meta advertiser Facebook group** — value-first answer; link in comments if rules allow.
- [ ] Use **Book demo** for agencies with many clients.
- [ ] Mention **Refer an agency** — https://nextreport.in/refer

**Week 2 goal:** 5–10 cumulative trials; **1 paying INR** or strong verbal commit.

---

### Week 3 — Content + SEO compounding

**Product**

- [ ] If **Google OAuth approved:** update CTAs, test sign-in + Drive with a non–test-user Google account.
- [ ] Otherwise: only bugfixes; **no new platform marketing**.

**Organic**

- [ ] **1 SEO piece:** e.g. “Meta Ads weekly report for agencies — CSV export steps” → link https://nextreport.in/help/download
- [ ] **YouTube** (public or unlisted): same export walkthrough; reuse on help page later.
- [ ] **One email** to waitlist/newsletter subscribers: progress + trial link (plain text).
- [ ] **5 helpful LinkedIn comments** on agency-owner posts (no spam; profile shows you build NextReport).

**Week 3 goal:** 2–3 new trials/week from content + network.

---

### Week 4 — Convert trials + learn

**Product**

- [ ] Trial expiry nudges (day 5, day 7) if not automated yet.
- [ ] Decide **Stripe vs manual USD** only when a lead is ready to pay.
- [ ] Pre-release: objective-regression + one golden CSV smoke.

**Organic**

- [ ] **Case study draft** (~300 words): before/after hours, Meta-only, anonymized.
- [ ] **X or Instagram:** repost Loom cut.
- [ ] **5 freelance media buyers** you know — free Pro month for intro to one agency each.
- [ ] Reply to **contact / demo / waitlist** within 24 hours.

**Week 4 goal:** **3–5 paying Agency (INR)** OR a clear reason trials don’t convert (price, feature, trust) to set Month 2 priorities.

---

## 6. Organic acquisition playbook (zero ad spend)

| Channel | What to do | Effort | Fit |
|---------|------------|--------|-----|
| **LinkedIn** | 2 posts/week; daily comments; trial link in profile | Medium | ★★★★★ |
| **WhatsApp / Slack groups** | Share tip + sample deck in groups you’re already in | Low | ★★★★ India |
| **Meta/Facebook groups** | Answer “how do you client-report?” threads | Medium | ★★★★ |
| **SEO** | CSV guide, “weekly report template”, export columns | Medium, slow | ★★★★ |
| **YouTube** | 5–8 min export → PPT walkthrough | One-time | ★★★ |
| **Referrals** | `/refer` + extended trial for referred agency | Low | ★★★ |
| **Book demo** | High-touch for 10+ client shops | Your time | ★★★★ |
| **Targeted outreach** | ~20 personal DMs/emails/week to agencies you can name | Medium | ★★★ |
| **Product Hunt / Indie Hackers** | One launch when OAuth + 1–2 case studies ready | Spike | Optional Week 5–6 |
| **Podcasts / newsletters** | Guest pitch: automating Meta reporting | Low hit rate | ★★ |

**Avoid at this stage:** paid Meta/Google/LinkedIn ads.

---

## 7. What Meta “done” unlocks (start now)

You no longer need to wait to:

1. **Public GTM** — LinkedIn, demos, trials on **Meta CSV**.
2. **INR monetization** — Razorpay, trial → paid.
3. **Content** — export guide, walkthrough video, case study.
4. **Monitor Google OAuth** — Console + email thread; no code block for CSV users.
5. **Google/TikTok** — only when a **paying or trial** user asks; don’t lead marketing with breadth.

Still **wait** on:

- Pushing **Sign in with Google** as the main CTA until OAuth approval.
- **Stripe** until a USD buyer exists.
- **Meta API–first** marketing until Meta app access fits customer accounts.

---

## 8. Ninety-day horizon (after the first 30 days)

| Window | Focus |
|--------|--------|
| **Days 1–30** | Meta reliability, INR sales, organic GTM, OAuth approval, onboarding |
| **Days 31–60** | Case studies, SEO content, Stripe if USD demand, Google CSV polish if needed |
| **Days 61–90** | Google API parity if churn demands it; TikTok for non-IN traffic; API story when Meta access is clean |

---

## 9. Engineering checklist snapshot (from integration roadmap)

**Phase 0 — core**

- [x] Meta — wizard, API sync, comparison, PPT/PDF outputs  
- [x] GA4 — website wizard  
- [x] Geo-hide TikTok for India  
- [x] CSV fallback documented  
- [ ] Google — API parity with CSV (conversions + channel type in GAQL)  
- [ ] Google — per-campaign type slots for mixed Search/Display/Video accounts  

**Phase 1 — when US/EU customers pay**

- [ ] TikTok polish for non-India traffic  
- [ ] LinkedIn only if B2B vertical validates  

---

## 10. Quick links (marketing)

| Link | Use |
|------|-----|
| https://nextreport.in | Homepage |
| https://nextreport.in/signup | Trial |
| https://nextreport.in/pricing | Plans (INR / USD waitlist) |
| https://nextreport.in/help/download | CSV export guide |
| https://nextreport.in/how-it-works | Onboarding |
| https://nextreport.in/book-demo | High-touch leads |
| https://nextreport.in/contact | Support & sales |
| https://nextreport.in/refer | Referral |
| https://nextreport.in/privacy | Privacy (Google OAuth) |

**Demo video (OAuth verification):** https://youtu.be/uC_UnOIi0jw  

---

## 11. Daily/weekly habit (minimal)

**Weekly (30 min):** Update metrics table in Section 4; note one product bug and one GTM win.  

**Before each production deploy:** Objective-regression tests + one manual Meta weekly report.  

**Highest leverage tomorrow:** One LinkedIn post + three people run a **real client CSV** through trial to **Generate + Share**.

---

*This file lives in the repo at `docs/30-day-gtm-strategy.md`. Download from GitHub (Raw or file view) or copy from your deployed branch.*

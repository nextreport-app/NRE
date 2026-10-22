# NextReport launch readiness audit

**Product:** [nextreport.in](https://nextreport.in) — Meta Ads CSV → branded PPTX, live share link, optional Google Drive  
**Audit date:** 23 October 2026 (IST)  
**Audience:** Founder / product owner (non-engineering summary at end)  
**Method:** Repository inspection, regression tests, no production credentials in agent environment (live OAuth/Resend/Drive not E2E-verified here).

This document **does not replace** `docs/META_LAUNCH_SCOPE.md`, `docs/integration-roadmap.md`, or `docs/google-oauth-test-users.md`. It classifies launch risk and tracks acceptance tests.

---

## Executive summary

| Launch mode | Recommendation |
|-------------|----------------|
| **Controlled beta (Meta CSV, email signup, INR billing)** | **GO** after P0 proxy fix is deployed and one production smoke report is verified |
| **Public launch (any Google user, self-serve Google login)** | **NO-GO** until Google OAuth app verification completes and `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED=true` is tested with a non–test-user account |
| **“Google Slides / Drive for everyone” marketing** | **NO-GO** until Drive OAuth is production-published or copy clearly says “test users / connect in Account settings” |

---

## P0 — Correctness, security, data integrity

### P0-1 Cron / async report worker blocked by auth proxy

| Field | Detail |
|-------|--------|
| **Status** | **Confirmed** (fixed in branch `cursor/launch-readiness-audit-121e`) |
| **Evidence** | `src/proxy.ts` redirected unauthenticated `/api/cron/*` and `/api/jobs/generate-report` to `/login`. Handlers use `Authorization: Bearer CRON_SECRET` (`src/app/api/jobs/generate-report/route.ts`, cron routes). `src/lib/nre/dispatch-report-generation-job.ts` treats non-OK HTTP as fallback; **HTML 200 login page could skip worker silently**. |
| **User impact** | Reports stuck in GENERATING on Vercel when `CRON_SECRET` is set; trial reminders / purge / digest cron may never run. |
| **Fix** | Allow internal paths when `isCronBearerAuthorized()` (`src/lib/internal-cron-auth.ts`); else **401 JSON**, not redirect. |
| **Acceptance test** | With `CRON_SECRET` set: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/generate-report -d '{"reportId":"..."}'` → 200 JSON, not HTML. Vercel cron logs show 200 on `/api/cron/*`. |

### P0-2 CPR / cost-per-result display vs spend÷results (trust)

| Field | Detail |
|-------|--------|
| **Status** | **Mitigated in code** — **must stay gated in release process** |
| **Evidence** | `src/lib/nre/cpr-parity.ts`, `src/lib/nre/csv-report-reconciliation.ts`, golden tests `cpr-parity-golden.test.ts`, `csv-report-reconciliation-mtd-multi-objective.test.ts` |
| **User impact** | Wrong CPL on slides/MTD/chart with green CSV verification (historical production incident). |
| **Fix (ongoing)** | Run `npm run test:objective-regression` before every production deploy; spot-check one real weekly CSV in wizard. |
| **Acceptance test** | Regression suite green; manual: printed CPR on slide = spend÷results for one campaign; MTD multi-objective buckets match reconciliation. |

### P0-3 Cross-tenant access on authenticated routes

| Field | Detail |
|-------|--------|
| **Status** | **Not reproduced in audit** — pattern looks consistent |
| **Evidence** | Client/report API routes use `auth()` + `client.userId === session.user.id` (e.g. `src/app/api/reports/[id]/download/route.ts`, analyze/preview/metrics under `src/app/api/clients/[id]/`). |
| **User impact** | IDOR would expose another agency’s CSV/report. |
| **Fix** | No change unless a specific route fails review. |
| **Acceptance test** | Integration tests under `src/app/api/__tests__/`; manual: user A cannot open user B’s report id. |

### P0-4 Worker endpoint scope (CRON_SECRET)

| Field | Detail |
|-------|--------|
| **Status** | **Confirmed design risk** |
| **Evidence** | `POST /api/jobs/generate-report` — any holder of `CRON_SECRET` can pass any `reportId`. |
| **User impact** | Secret leak → cross-tenant generation trigger (reads job payload for that id). |
| **Fix (future)** | Signed job tokens bound to reportId + expiry; rotate CRON_SECRET. |
| **Acceptance test** | Secret only in Vercel env; not in client bundles or logs. |

### P0-5 Google account linking

| Field | Detail |
|-------|--------|
| **Status** | **Confirmed** (`allowDangerousEmailAccountLinking: true` in `src/lib/auth.ts`) |
| **Evidence** | Google provider config |
| **User impact** | Email/password account takeover if attacker completes Google OAuth for same email. |
| **Fix (product decision)** | Disable linking or require verified email + password re-auth before link. |
| **Acceptance test** | Security review before enabling public Google sign-in. |

---

## P1 — Onboarding, UX truthfulness, export reliability

### P1-1 Google Sign-in (NextAuth)

| Field | Detail |
|-------|--------|
| **Status** | **Blocked externally** — **UI gated in app** |
| **Evidence** | `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED` (`src/lib/google-sign-in-enabled.ts`); disabled button `Google sign-in coming soon` (`src/components/auth/google-sign-in-button.tsx`); provider omitted when flag false (`src/lib/auth.ts`). |
| **User impact** | Non–test users saw Google 403 / “app not verified”. |
| **Fix (app)** | Keep flag false until verification; email signup + credentials login (`src/app/signup/page.tsx`, `/api/auth/signup`). |
| **Acceptance test** | Production: flag unset → no Google redirect; email signup → `/clients`. After approval: flag true → new Google account signs in. **Not verified live in this audit.** |

### P1-2 Google Drive OAuth (separate flow, same Cloud client)

| Field | Detail |
|-------|--------|
| **Status** | **Blocked for non–test users** (same consent screen) |
| **Evidence** | `/api/google-drive/connect`, `src/components/google-drive-settings.tsx`, `docs/google-oauth-test-users.md` |
| **User impact** | “Save to Drive” fails for users not on Test users list; CSV reporting still works. |
| **Fix (human)** | Add testers in Cloud Console **or** publish app + complete verification. |
| **Acceptance test** | Test user: Account → Connect → wizard Save to Drive succeeds. Non-test user: honest error, CSV path unaffected. |

### P1-3 Marketing vs product (Google Slides / platforms)

| Field | Detail |
|-------|--------|
| **Status** | **Partially aligned** |
| **Evidence** | `src/lib/meta-launch-scope.ts` — only META enabled; about/how-it-works mention “launching soon” for Google/TikTok/GA4. Homepage still mentions “Slides” in meta description (`src/app/page.tsx`). `src/app/light-preview/page.tsx` (unlisted) claims multi-platform. |
| **User impact** | Expectation mismatch for Drive/Slides and non-Meta platforms. |
| **Fix** | Lead with Meta CSV; qualify Drive/Slides as “Account → Connect Google Drive (Google approval pending)”. |
| **Acceptance test** | Founder read-through: no claim that any Google user can sign in or connect Drive without caveat. |

### P1-4 Public share link strength

| Field | Detail |
|-------|--------|
| **Status** | **By design, high sensitivity** |
| **Evidence** | `src/app/r/[token]/page.tsx`, `src/app/api/r/[token]/download/route.ts`, `src/lib/share-token.ts` (~12 char token) |
| **User impact** | Anyone with link gets full metrics + PPTX download. |
| **Fix (future)** | Optional password, expiry, revoke token, rate limits. |
| **Acceptance test** | Invalid token → 404; valid token → no session required. |

### P1-5 AI insight logging in production

| Field | Detail |
|-------|--------|
| **Status** | **Fixed** (dev-only logs) |
| **Evidence** | `src/lib/ai/generate-insights.ts` — campaign names + AI text logged only when `NODE_ENV === development` |
| **User impact** | PII/campaign names in Vercel logs. |
| **Acceptance test** | Production build: generate report; logs must not contain raw AI paragraphs. |

### P1-6 AI numeric safety

| Field | Detail |
|-------|--------|
| **Status** | **Strong patterns in code** — not re-tested end-to-end here |
| **Evidence** | Fallbacks, truncation guards, zero-results templates (`src/lib/ai/generate-insights.ts`, `src/lib/ai/prompts.ts`); `AI_UNAVAILABLE_TEXT`; objective mismatch checks |
| **User impact** | Hallucinated CPL or truncated sentences on slides. |
| **Fix** | Keep fallbacks; don’t bypass for launch. |
| **Acceptance test** | Unit tests in `src/lib/ai/__tests__/`; manual: paused campaign → template copy, not AI. |

### P1-7 Wizard steps vs copy

| Field | Detail |
|-------|--------|
| **Status** | **Confirmed consistent (4 steps)** |
| **Evidence** | Steps 1–4: import, campaigns, metrics, generate (`report-upload-wizard.tsx`, `stepOf(2,4)` … `stepOf(4,4)`). Website GA4 uses separate wizard — not mixed in Meta 4-step UI. |
| **User impact** | Confusion if marketing said 5 steps. |
| **Acceptance test** | Step indicator shows 4 steps for Meta flow. |

### P1-8 Generate failure + wizard state

| Field | Detail |
|-------|--------|
| **Status** | **Implemented** |
| **Evidence** | `generate-step.tsx` error message + “Retry generate”; `beforeunload` / leave guard steps 2–4 (`use-report-upload-wizard.ts`) |
| **Acceptance test** | Force 500 on generate → message + retry without re-upload; refresh on step 3 → browser warning. |

---

## P2 — Repeat use, history, preferences

| Item | Status | Evidence |
|------|--------|----------|
| Report history list | **Done** | Client reports pages, `Report` model |
| Rename display name | **Done** | `displayName`, report history UI |
| Wizard draft restore | **Done** | `wizard-draft.ts`, session recovery banner |
| Saved client template / branding | **Done** | Client form, account branding |
| Regenerate same report id | **Partial** | New generate creates new report row; edit/regenerate flows via history |
| Revoke share link | **Missing** | No UI to rotate `shareToken` — new report = new token |
| Duplicate report wizard | **Partial** | Copy/resume patterns in wizard snapshot |

---

## P3 — Future scope

- Google Ads / TikTok / GA4 full wizard parity (`docs/platform-parmap.md`, `LAUNCH_ENABLED_PLATFORMS`)
- Scheduled / automated email delivery (Resend exists for manual send from success screen)
- Advanced dashboards, paid acquisition, Stripe USD self-serve (waitlist / Razorpay INR live)
- Share link rate limiting and token revocation UI

---

## Reporting accuracy (Task 3)

| Area | Status | Evidence |
|------|--------|----------|
| Objective detection regression | **Verified in CI** | `npm run test:objective-regression` — **48 tests passed** (23 Oct 2026 agent run) |
| CPR parity golden | **In regression suite** | `cpr-parity-golden.test.ts` |
| CSV reconciliation (MTD multi-objective) | **In regression suite** | `csv-report-reconciliation-mtd-multi-objective.test.ts` |
| Timezone / date boundaries | **Code + tests** | `src/lib/nre/date-range.ts`, many `report-data.test.ts` cases — **some tests fail on VM timezone** (see test results) |
| CSV vs API parity | **Documented differences** | Hybrid sync notes in wizard; not forced equal in reconciliation |
| Weighted CTR/CPC | **Tested** | `belle-ctr-cpc-blend.test.ts`, blended formulas in engine |

**Release gate:** `npm run test:objective-regression` must pass before deploy.

---

## Google OAuth (Task 2) — owner actions

**Same OAuth client** (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`):

| Flow | Redirect URI | Scopes / notes |
|------|----------------|----------------|
| Sign in with Google | `/api/auth/callback/google` | NextAuth Google provider |
| Connect Google Drive | `/api/google-drive/callback` | Separate grant on `User.googleRefreshToken` |

**External steps (human):**

1. Google Cloud project `nextreport-503414` — OAuth consent screen: test users **or** publish + verification.
2. Authorized redirect URIs for production + any Vercel preview hostnames in use.
3. Enable Google Drive API.
4. After approval: set `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED=true` on Vercel; test with account **not** on test-user list.
5. Privacy policy already updated for Google user data (`src/app/privacy/page.tsx`).

**Demo video for verification:** https://youtu.be/uC_UnOIi0jw (submitted per founder — approval status **not verified in repo**).

---

## Product analytics (Task 7)

| Capability | Status |
|------------|--------|
| Admin signup / activation counts | **Done** — `/admin/metrics` (`ADMIN_EMAILS`) |
| GA4 page views (marketing) | **Optional** — `GA_MEASUREMENT_ID` + `src/components/google-analytics.tsx` (page views only) |
| Funnel events (signup → upload → generate → share) | **Missing** — no `gtag('event')` or server events in app code |

**Minimal recommendation (no new dependency):** If `GA_MEASUREMENT_ID` is set, add a small `src/lib/product-analytics.ts` wrapper that fires named events (`sign_up`, `csv_analyze_ok`, `report_generated`, `report_download`) without CSV contents or tokens. Alternatively use `/admin/metrics` + DB queries for beta.

---

## Security checklist (Task 8)

| Check | Result |
|-------|--------|
| Auth on client/report APIs | Pass (sampled routes) |
| Public share by token only | Pass (by design) |
| Upload session ownership | `wizard-upload-session.ts` |
| OAuth tokens in DB | Plaintext on `User` / `Account` — **encrypt at rest** = future |
| Drive file sharing | `shareFilePublicly` in `google-drive.ts` — world-readable link when saving |
| Cron/worker auth | **Fixed** via proxy + Bearer |

---

## Launch checklist (copy for ops)

### Before controlled beta

- [ ] Deploy P0 proxy cron/worker fix
- [ ] `CRON_SECRET` set on Vercel; confirm cron jobs return 200 in Vercel dashboard
- [ ] `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED` **unset or false**
- [ ] `ADMIN_EMAILS` includes founder; open `/admin/metrics`
- [ ] Run `npm run test:objective-regression` on release commit
- [ ] Production smoke: email signup → upload real Meta weekly CSV → verify green → download PPTX → open share link
- [ ] Razorpay live webhook tested once (see `docs/billing-subscriptions.md`)

### Before public launch

- [ ] Google OAuth verification approved
- [ ] `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED=true` + non–test-user sign-in test
- [ ] Google Drive connect tested for non–test user OR marketing updated
- [ ] Review P1-5 account linking policy
- [ ] Optional: share link revocation / rate limits

---

## 30-day prioritized backlog (organic beta)

1. **Week 1:** Deploy P0 fixes; production smoke + one paying Razorpay test; document Drive test-user process for beta agencies.
2. **Week 2:** Tighten homepage/help copy on Google Slides/Drive caveats; add GA4 funnel events if measurement ID is live.
3. **Week 3:** First case study (real agency, anonymized); monitor `/admin/metrics` weekly.
4. **Week 4:** If OAuth approved — enable Google sign-in flag; if not — expand test-user list for beta cohort only.

See also `docs/30-day-gtm-strategy.md` for GTM (if present on branch).

---

## Test results (this audit run)

| Command | Result |
|---------|--------|
| `npm test src/lib/__tests__/internal-cron-auth.test.ts` | **Pass** (3 tests) |
| `npm test src/lib/__tests__/google-sign-in-enabled.test.ts` | **Pass** (2 tests) |
| `npm run test:objective-regression` | **Pass** (48 tests) |
| Full `npm test` | **Not used as gate** — 41 failures on agent VM (timezone + missing `python3` for PPTX tests) |
| `npm run lint` / `tsc` | **Repo-wide pre-existing failures** — not regression-tested here |
| Live OAuth / Resend / Drive / Slack webhook | **Not run** (no secrets) |

---

## Change log (engineering)

| Date | Change |
|------|--------|
| 2026-10-23 | Added this audit doc |
| 2026-10-23 | P0: `internal-cron-auth` + proxy allowlist for cron/worker |
| 2026-10-23 | P1: AI insight logs dev-only |
| 2026-10-22 | PR #558: Google sign-in gate, admin metrics, MTD debug log removal |

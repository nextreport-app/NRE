# Meta API launch audit

Date: November 7, 2026. Scope: four report workflows, source parity, metric cards/PPT, import UX, account connections and public launch copy.

## Workflow and calculation review

| Area | Finding / verification |
|---|---|
| Availability | Meta API enabled by default for active trials/subscriptions; explicit server kill switch retained. No owner/tester allowlist added. |
| Authorization | Client ownership, connected-user token and subscription checks remain. OAuth requests `ads_read` only. Existing encrypted token handling preserved. |
| Import | API normalizes Meta daily observations into the same parsed source model as CSV; no separate calculation/PPT implementation introduced. |
| Campaigns | Equivalent CSV/API test facts produce identical campaign names and spend. Filtering and selected ad sets are shared. |
| Objectives | Equivalent inputs produce identical objective maps/confidence. Configured events and custom-conversion identity remain authoritative; no campaign-name substitution for a different event. |
| Results / costs | Direct configured-event counts are retained. Schedule uses its website conversion metric when supplied; lead events retain their canonical action source. Cost is spend/count, not an average of daily costs or an inferred count from cost. |
| Click costs | Link-click objectives use CPLC from spend/link clicks. CPC (All) uses a different denominator and is excluded from those cards. Supporting link-click costs can also be computed for other objectives when spend and link counts exist. |
| Metrics | Found source-column-dependent Instant Form cost keys. Normalize the primary cost key while retaining raw-column bindings. Computable link-click costs no longer disappear just because a dedicated cost column is absent. |
| Four report choices | Equivalent facts pass weekly, single-month, multi-month, comparison and daily output checks through the common builders and actual PPT renderers. |
| Dates / currency | Account timezone controls API date ranges; source currency is preserved. Existing tests cover custom dates, stale dates, monthly windows, AUD/INR/USD and account-timezone behavior. Missing days are not fabricated as zero. |
| PPT outcomes | Source parity asserts exact rendered text, not just monetary substrings. Existing tests cover dark/light layouts, selected ad sets, monthly charts, metric pagination and unresolved placeholders. New Schedule/CPLC tests verify actual campaign-slide XML and exact cards/values. |

### Important source boundaries

Same logic does not promise identical numbers from different raw facts: dates, account timezone, attribution settings, export level and provider updates must match. API campaign-period unique reach can be supplied directly by Meta; a CSV with only daily reach cannot establish cross-day deduplicated reach. Do not label inferred period reach as independently verified by Meta.

The optional stored previous-month CSV supplement intentionally remains manual-only. Explicit monthly/comparison periods work through both methods. This preserves the owner's earlier requirement.

## Fixes and user experience

- First visit: both import choices are visible. Returning users: remembered method appears compactly with **Change import method**. The other method is one click away, with no new behavioral tracking or account-wide inference.
- Switching sources clears stale source data, while retaining manual-only supplement preferences. Browser checks traverse import, campaigns, metrics and Generate entry through both sources and confirm CSV preference survives reload.
- API loading remains continuous through analysis; internal diagnostics/download panels stay out of the normal journey. Existing retry, connection/account search and timezone-validation behavior is preserved.
- Metric/objective review uses source-neutral wording instead of implying API users uploaded a file.
- Account settings present Meta reporting as live and read-only, with manual CSV still available. Other platform setup sections retain their deferred reporting status.
- Hero, homepage features/animation, banners, pricing features/FAQ/comparison, about, onboarding, dashboard copy, metadata and JSON-LD now include live Meta API sync. Older translation patches cannot reintroduce stale launch claims in the changed feature/pricing fields.
- Removed the paid-plan claim that deferred Quarterly/YTD/Creative report creation is currently included. Billing prices, plan IDs, limits and Razorpay configuration are unchanged.

## Verification boundaries and follow-up

Provider responses in automated tests are synthetic; they do not certify every real Meta account, permission combination or future provider change. Public production HTTP access from this environment returns a CONNECT gateway 403, so this is not a live deployment verification. No production deployment, Meta dashboard changes or account modifications performed.

Before public deployment:

1. Confirm the Meta app is **Live**, with `ads_read` access approved for external users; app roles/developer test access alone are insufficient evidence.
2. Preserve existing production Meta credentials/token encryption. If `AD_PLATFORM_API_SYNC_ENABLED=false` is configured, remove it or set it true, then deploy.
3. Smoke-test connecting a non-owner account, selecting an authorized ad account and generating one report; compare the same dates/event/attribution settings in Ads Manager. Check revoke/reconnect behavior from that account as well.
4. Regenerate reports to apply new default metric keys/copy; existing downloaded decks remain unchanged.

Visual limitation: actual PPT XML and template contracts are tested; a desktop PowerPoint/Slides rendering check remains useful. LibreOffice is unavailable in this environment, so no new rasterized-slide visual review is claimed.

## Validation results

| Check | Result |
|---|---|
| Meta API/provider/route/UI/copy suite | PASS — 118 tests |
| Accounting/reporting accuracy | PASS — 506 tests |
| Report choices, dates, dark/light PPT template contracts | PASS — 279 tests |
| API route integration suite | PASS — 62 tests |
| SEO/currency/analytics readiness regression | PASS — 52 tests |
| Metric pack/slot rules | PASS — 66 tests |
| Browser interaction | PASS — eight mobile/desktop scenarios, each traversing API and CSV through Generate entry (16 source journeys), with preference restoration and no horizontal overflow |
| Source parity | PASS — exact campaign/objective/metric comparisons and generated PPT text for weekly, single-month, multi-month, comparison and daily fixtures |
| PPT package relationships | PASS — all internal targets resolve in all five generated API decks; no external hyperlinks present in these fixtures |
| TypeScript / production build / whitespace | PASS |
| ESLint | Existing debt remains: six effect-rule errors and ten warnings in the wizard hook, one effect-rule error in the API panel and one in the Generate step. Compared against origin/main; no new findings. Other changed TypeScript files pass scoped lint. |
| Production HTTP / Meta dashboard | NOT VERIFIED — gateway 403 / no account access |

Synthetic review decks were generated locally under `/tmp/meta-api-launch-review` (weekly, monthly, multi-month, comparison, daily). These contain fixture data, not private client uploads. They are not committed.

## Key implementation files

- `src/lib/nre/available-metrics.ts`, `src/lib/nre/packs.ts`: source-independent computable support metrics and canonical Instant Form primary cost key.
- `src/lib/nre/__tests__/meta-api-four-report-parity.test.ts`: compare identities, objectives, selected metrics and full rendered PPT text; add multi-month coverage.
- `src/components/wizard-data-source-panel.tsx`, `src/components/report-upload-wizard/use-report-upload-wizard.ts`, `steps/import-step.tsx`: compact remembered method, temporary-unavailability handling, shared import-button styling.
- `steps/campaigns-step.tsx`, `steps/metrics-step.tsx`, `steps/generate-step.tsx`, `ui/metric-chip-picker.tsx`, `ui/csv-verification-panel.tsx`, `ui/report-readiness-panel.tsx`, `src/lib/wizard-i18n.ts`: source-neutral workflow/recovery/validation copy.
- `src/components/meta-ads-settings.tsx`, account/client pages: live Meta connection presentation, read-only disclosure and availability guidance.
- `src/lib/meta-launch-scope.ts`, `product-positioning.ts`, `plan-labels.ts`, `pricing-faq.ts`, `seo.ts`, `marketing-i18n.ts`, `home-i18n/*`, dashboard/onboarding copy and public/home components: consistent launch/pricing/roadmap claims. `src/app/terms/page.tsx` updates the service description to include the existing optional API import.
- `scripts/check-meta-wizard-browser.cjs`: source preferences, import switching and both-source progression through campaigns/metrics to Generate entry on mobile/desktop.
- New UI/launch-copy tests and `package.json`: reusable launch checks are included in `npm run test:meta-api`.

### Import concurrency guard

The Import step already disables native source/date/account controls during sync/analysis. Drag/drop events on the CSV label could still bypass a disabled fieldset. Add an explicit disabled input/drop handler guard so a pending analysis cannot be paired with a newly dropped file. Browser checks hold each source's analyze response, verify method switching is disabled, attempt a CSV drop and confirm the original file is retained before continuing.

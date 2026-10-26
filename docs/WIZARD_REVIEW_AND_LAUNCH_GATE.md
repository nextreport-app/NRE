# Wizard review and launch gate

Review: 26 October 2026. PR #588 remains a draft. Passing CI is not launch approval.

## Multiple objectives in one CSV

Supported: different campaigns with different objectives. The new manual fixture `mixed-three-objectives.csv` independently expects:

| Campaign objective | Period spend | Results | Cost per result |
|---|---:|---:|---:|
| Meta form leads | $120 | 10 | $12 |
| Link clicks | $40 | 20 | $2 |
| Purchases | $100 | 2 | $50 |

The form campaign includes a $20 zero-result day. Combined spend is $260, all-clicks 80, impressions 4,000, CTR 2%, CPC $3.25. Counts with different meanings must never be pooled to calculate one account CPR. Tests check campaign values, Combined Total, reconciliation, and actual separate columns in dark and light PPTX XML. Existing compact header `FORM LEADS` is intentionally retained for three objective pairs.

Different primary events *within the same campaign* are a separate limitation. One-primary-objective campaign mapping still exists; source coverage checks flag missing explicit events, but this is not full per-event bucket support.

## Four-step assessment

Keep four steps for launch. Import → Campaigns → Metrics → Review & Generate matches distinct decisions. Moving to three merely combines decisions; a fifth adds navigation. Keep the established packs, defaults, campaign selection, draft recovery and branding.

- Import: recommend manual CSV. API remains visible with an experimental notice. Keep export guidance and unsupported-data errors actionable. Support diagnostics already have an advanced disclosure.
- Campaigns: show included/excluded campaigns/spend and flag genuinely ambiguous objectives. Explain that ad-set selection controls detail slides rather than changing campaign totals. Preserve saved exclusions.
- Metrics: retain automatic objective packs and remembered preferences. Offer customization when needed rather than forcing users to rebuild every pack. A conditional-hook issue has been fixed.
- Review & Generate: make client, dates, source, campaign scope, per-objective totals and listed verification status easy to check. Never call an estimated unique audience exact. A mismatch is internal-review output, not a clean client-ready pass.

The implementation was inspected across all four steps, success panel, network handlers, report review/publish and share utilities. This does not claim live OAuth/Drive/Slack/Teams delivery was tested on a real connected account.

## Concrete recovery fixes in this follow-up

Rejected fetches now enter existing recoverable error states for analyze/re-analyze, API-import analysis, objective/metric loading, preview and previous-month generation. Main Generate and Drive save no longer remain loading after a network rejection. A polling-error message is no longer erased in `finally`. Publish clears its saving state after a network rejection and retains local edits. Drive-link clipboard rejection shows an error rather than an unhandled promise rejection.

Generated share/copy links use the current deployment origin, preserving HTTPS previews and HTTP localhost rather than sending Preview tokens to production. Production on nextreport.in continues using nextreport.in. Regression checks cover these origins. The success screen states that anyone with the link can view it.

## Delivery and sharing

Current essentials already exist: PPTX download, Drive save with a remembered folder, browser report, preview/edit/publish, copy link, copy message, WhatsApp/email and more-channel disclosure. More channel icons are not a launch priority. PDF remains out of scope.

Useful next additions, not implemented in this PR:

1. Owner-controlled revoke/regenerate link, then optional expiration. Current public report links do not expose these controls in the reviewed flow; an unguessable URL is still a bearer link.
2. Clear per-destination freshness after publishing edits. The existing UI already says Drive requires a manual re-save; make that state more visible. Do not imply an old downloaded PPTX or Drive copy updates itself.
3. Optional native mobile share sheet, retaining copy message/link as universal fallbacks.
4. Only after validation: opt-in scheduled delivery and view receipts. Opening a share-composer URL is not proof that a client received or read the report.

Do not silently change public-link publication rules, add tracking, or introduce new OAuth scopes in this accuracy PR.

## Release recommendation

Start an owner-only Preview acceptance round now with **manual CSV**. Do not treat #588 as blanket launch approval. Meta API should be tested only alongside a manual export with the same account, dates, timezone, attribution context, currency and snapshot timing. A hybrid import that replaces API Results using manual values is not proof of API-only correctness.

Before a supported manual-CSV pilot:

- Triage remaining broad-suite failures. Distinguish stale arithmetic/date expectations from actual faults; missing private fixtures are not passes.
- Compare representative independently totaled exports: mixed campaigns, zero-result spend, cross-month weekly scope, previous-month selection, purchases with secondary events, exact/estimated Reach and the report types offered to the pilot.
- Check preview and both downloaded PPTX themes against those exports. No unexplained spend, primary-result or rate mismatch in the supported sample.
- Exercise all four screens and back-navigation with a fresh upload and a restored draft, plus interrupted network/retry behavior. A missing server response can still create a job; check Reports before retrying to avoid duplicate reports.
- Verify a real deployed generation job completes, download succeeds, mobile browser report opens, and links refer to the expected deployment. Test Drive only in an appropriately configured test account; Drive is optional for manual-PPTX launch.

A small private pilot with roughly 10–20 varied, approved reports is a useful initial corpus, not statistical proof of universal accuracy. Public launch follows demonstrated manual-source accuracy and pilot feedback. API production readiness is a separate acceptance gate; no reliable launch date can be inferred from CI alone.


## Follow-up validation

- Source/deck acceptance: **54 passed**, including the exact three-objective fixture through both PPTX templates.
- Wizard share utilities, upload sessions, generated snapshot recovery and report job regressions: **23 passed**.
- Standalone TypeScript: passed.
- Targeted lint on changed view/util/test files: no errors. The large existing wizard hook still triggers pre-existing set-state-in-effect lint errors; this follow-up does not suppress them or restructure draft restoration effects.
- External OAuth save, actual message delivery and full live-account parity remain unverified. No production merge/deployment is performed by this follow-up.

# Platform parity roadmap (Meta / Google Ads / TikTok)

Unified reporting pipeline: one `buildReportData` path, platform adapters for dictionary/slots/labels/validation.

GA4 stays on its own pipeline — out of scope here.

## Phase 1 — Shared pipeline wiring (this PR)

- [x] `platform-reporting.ts` — central dispatch for metrics dictionary, slot engine, default selections, share badges, validation copy
- [x] `buildReportData` — Google uses `buildGoogleSlots` + Google objective labels; TikTok uses Meta-shaped CSV via existing adapters
- [x] Metrics route — `defaultGoogleSelection` for Google; fixed CONVERSIONS labels
- [x] Validation — platform-aware spend column hints and Ads Manager names
- [x] TikTok API result types in `RESULT_TYPE_MAP`
- [x] Share page + wizard preview — correct platform badges (incl. TikTok)
- [x] Google combined-total table — period + MTD row parity with Meta grid order
- [x] PPTX fill-tags — Google period row support; LIGHT template for all platforms
- [x] Previous Month Summary — respects wizard platform (template + DB row)
- [x] Creative preview error — platform-aware export instructions

## Phase 2 — API sync & objective intelligence (complete)

- [x] Google unified-pipeline header aliases in dynamic-metrics (Meta-normalized CSV → Google slot lookup)
- [x] Google Ads API sync — extra columns for campaign-type detection (conv. value, viewable impr., engagements, video views)
- [x] TikTok API result-type mapping (`tiktok-result-type.ts` — not Meta pickResultAction)
- [x] TikTok spend header currency-neutral; dedicated TikTok AI prompts
- [x] TikTok deck labels — REACH no longer swapped to CLICKS (Google-only retext)
- [x] Meta-only AI guard rules gated to `platform === "META"`
- [x] Google per-campaign-type objective labels on slides (match buildGoogleSlots slot 4/5)
- [x] Deprecate orphan `buildGoogleReportData` — removed; `google-combined-total.ts` retains table grid helper
- [x] Previous Month Summary `ReportData.platform` respects wizard platform

## Phase 3 — Render / share / historical polish (complete)

- [x] Dedicated `tiktok-ads-dark.pptx` template asset (fork of `dark.pptx`; wired in `templates.ts`)
- [x] Platform-aware metric guide copy on share page (Google + TikTok terms in `share-report-view.tsx`)
- [x] Creative ad-level CSV error — platform-aware Ads Manager name in generate route (API sync remains Meta-only; Google/TikTok use Ad-level CSV)
- [x] Comparison reports — `platform` + `csvHeaders` passed to `buildComparisonReportData`; Google uses campaign-type slot labels via `googleComparisonObjectiveTotals`
- [x] Historical reports — already pass `platform` through `buildHistoricalReportData` → unified `buildReportData`

## Testing

- `src/lib/nre/__tests__/platform-reporting.test.ts` — adapter dispatch
- Meta E2E: `fetch-meta-report-rows.test.ts`
- Google: `google-build-report-data.test.ts`, `google-combined-total.test.ts`, `dynamic-metrics-google-unified.test.ts`

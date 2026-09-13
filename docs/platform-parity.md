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

## Phase 2 — API sync & objective intelligence

- [ ] Google Ads API sync column richness (match CSV metric coverage)
- [ ] TikTok API objective / result-type mapping beyond CSV parity
- [ ] Google per-campaign-type objective engine (not only account-wide CONVERSIONS)
- [ ] Dedicated TikTok AI prompt templates (today: Meta prompts, acceptable for CSV-shaped reports)
- [ ] Deprecate unused `buildGoogleReportData` production path once parity tests pass

## Phase 3 — Render / share / historical polish

- [ ] Dedicated `tiktok-ads-dark.pptx` template asset
- [ ] TikTok-specific metric guide copy on share page
- [ ] Creative ad-level API sync for Google/TikTok (Meta-only today)
- [ ] Historical / comparison edge cases audited per platform

## Testing

- `src/lib/nre/__tests__/platform-reporting.test.ts` — adapter dispatch
- Meta E2E: `fetch-meta-report-rows.test.ts`
- Google: `google-report-data.test.ts` (standalone builder); add `buildReportData` + Google CSV integration test in Phase 2

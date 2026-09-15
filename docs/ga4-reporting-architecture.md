# GA4 website reporting — fork vs bridge decision

Last updated: September 2026

This document records roadmap item **#9**: how GA4 website traffic reporting relates to the unified Meta / Google Ads / TikTok pipeline.

## Decision

**Fork the data model, builder, and renderer. Bridge only shared delivery infrastructure where it already exists or is clearly needed next.**

GA4 website analytics is a different product surface from paid-media campaign reporting. Forcing it through `buildReportData()` would fight ~2,300 lines of campaign / ad-set / spend / objective logic built for ads CSVs and Marketing APIs.

## Why fork (not merge into NRE ad pipeline)

| Dimension | Ad platforms (Meta / Google / TikTok) | GA4 website traffic |
|-----------|--------------------------------------|---------------------|
| Primary unit | Campaigns, ad sets, spend | Sessions, channels, breakdown tables |
| Objective model | Per-campaign result labels (leads, purchases, reach…) | Client kind (ecommerce, lead gen, content, hybrid, saas) |
| Data source | Ads CSV / Marketing API rows | GA4 Data API or GA4 CSV export |
| Slide shape | Campaign scorecards + combined total table | Overview KPIs + channel / device / geo / event tables |
| Core types | `ReportData`, `Platform`, `ReportEngine` | `WebsiteReportData`, `platform: "GA4"` on `Report` row only |

The codebase already reflects this split:

- `src/lib/nre/website-report-data.ts` — `WebsiteReportData` (not `ReportData`)
- `src/lib/pptx/website-slides.ts` — `renderWebsitePptx()` (not `renderPptx()`)
- `src/components/website-report-wizard.tsx` — dedicated wizard (embedded from ad wizard via `wizardKind === "website"`)
- `Platform` enum in NRE = `META | GOOGLE | TIKTOK` only

## What is already bridged (shared infrastructure)

These layers are intentionally shared today:

| Layer | Shared module | Notes |
|-------|---------------|-------|
| Database | `Report` model | `reportType: WEBSITE`, `platform: GA4` |
| Share links | `shareToken`, `/r/[token]` | Branches on `kind: "website"` vs ads |
| Templates | `loadTemplateBufferForPlatform("GA4", …)` | `ga4-dark.pptx`, `ga4-light.pptx` |
| Cover / metric cards | `fill-tags.ts` | Reused by `website-slides.ts` |
| PDF renderer | `print-report-html.tsx` | Supports `ShareWebsiteReportData` |
| Platform picker | `report-upload-wizard` | GA4 card alongside Meta / Google / TikTok |
| Account OAuth | `ga4-api.ts`, Account settings | Separate grant (same pattern as Meta/Google/TikTok) |

## What stays forked

Do **not** route GA4 through these ad-only modules:

- `buildReportData()` / `report-data.ts`
- `createReportEngine()` / `report-engine/`
- `platform-reporting.ts` / `platform-adapter.ts`
- `buildStandardReportForWizard()`
- Campaign objective dictionaries (`meta-objective-dictionary`, `google-objective-dictionary`, …)
- Ad wizard steps (Upload → Campaigns → Objectives → Metrics)

GA4 has its own parallel dictionaries:

- `ga4-metric-dictionary.ts`, `ga4-columns.ts`
- `ga4-client-kind-dictionary.ts` (parallel to meta-objective-dictionary in purpose, not in shape)

## Delivery parity backlog (selective bridges — future work)

Product copy and UX should not claim parity until these exist:

| Feature | Ad reports | GA4 website today | Next bridge step |
|---------|------------|-------------------|------------------|
| Async generation | Job queue + poll | Sync POST (blocks on GA4 API) | Add `WebsiteReportJobPayload` to worker |
| Share review / edit | `/reports/[id]` review UI | Share link only | Extend review page for `kind: "website"` |
| Publish + cached PDF | `publishedAt`, `pdfPath` | Not wired | Publish path for `ShareWebsiteReportData` |
| Google Drive save | Ad wizard download step | Not wired | Optional after publish |
| AI insights | `generateInsights()` | Static copy in `website-slides.ts` | Optional; different prompt surface |

Implement delivery bridges **without** merging `WebsiteReportData` into `ReportData`.

## Non-goals

- Merging GA4 into `buildReportData()` or `ReportEngine`
- Campaign / objective detection for GA4 website reports
- Comparison, historical, or creative report types for GA4 (different data model)
- Deleting the legacy route `/clients/[id]/reports/website/new` in this decision (cleanup can follow)

## Entry points (reference)

```
WebsiteReportWizard
  → POST /api/clients/[id]/website-report
  → resolveWebsiteReportData (API or CSV)
  → renderWebsitePptx
  → buildShareWebsiteReportData
  → Report row (COMPLETE) + /r/[token]
```

Ad platform equivalent:

```
ReportUploadWizard
  → POST /api/clients/[id]/reports (async)
  → buildStandardReportForWizard → buildReportData
  → job worker → renderPptx → buildShareReportData
  → review → publish → PDF
```

## Related docs

- [Platform parity roadmap](./platform-parity.md) — Meta / Google / TikTok unified pipeline (GA4 explicitly out of scope)
- [Integration roadmap](./integration-roadmap.md) — GA4 as P1 website analytics tier

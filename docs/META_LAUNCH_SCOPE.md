# Meta-first launch scope (v1)

**Phase:** `meta-v1`  
**Goal:** Ship Meta Ads reporting (CSV + API sync) with confidence before adding other platforms or report types.

## Live now

| Area | Included |
|------|----------|
| **Platform** | Meta Ads only |
| **Ingestion** | Manual CSV upload + Meta Marketing API sync (must produce identical calculations — see `dc-credit-firm-api-parity.test.ts`) |
| **Report types** | Weekly, Monthly, Yesterday (Daily), Comparison, Multi-Month Historical, Daily Performance (day breakdown) |
| **Output** | Branded PPTX, share link, PDF, Google Drive, AI summaries |

## Deferred until Meta v1 is stable

### Platforms (code retained; wizard + marketing show "Launching soon")

- Google Ads (CSV + API)
- TikTok Ads (CSV + API)
- Google Analytics / GA4 (website reporting wizard)

**Re-enable checklist:** golden parity tests for that platform + 2 live account smoke tests + update `LAUNCH_ENABLED_PLATFORMS` in `src/lib/meta-launch-scope.ts`.

### Report types (code retained; hidden from wizard)

- Quarterly Performance Report (`QUARTER`)
- Year-to-Date Report (`YTD`)
- Creative Performance Report (`CREATIVE` — ad-level)

**Re-enable checklist:** add to `LAUNCH_ENABLED_REPORT_TYPES` + regression tests for that window.

## Engineering invariants (non-negotiable for launch)

1. **One pipeline:** API sync synthesizes CSV rows → same `parseCsvText` → `buildReportData` as manual upload.
2. **Golden fixtures:** Real anonymized accounts (Credit Firm, Southaven, GZ, BumperTech, …) — CI fails if manual ≠ API on leads, CPL, chart totals.
3. **Report windows:** Each report type uses one primary date window for campaign slides, Combined Total row, and chart (see `resolveStandardChartRange`).

## Marketing copy

Public site keeps mentions of Google/TikTok/GA4 where useful for SEO but labels them **Launching soon** — not removed, so we can flip the flag without rewriting pages.

## How to expand scope

1. Fix + test on a branch  
2. Add/update golden parity test  
3. Add platform or report type to `src/lib/meta-launch-scope.ts`  
4. Update this doc with date and checklist  

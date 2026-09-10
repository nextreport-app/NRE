# NextReport integration roadmap

Last updated: September 2026

This document guides which ad platforms NextReport integrates, in what order, and how we treat region-specific platforms (especially TikTok in India).

## How we prioritize

We use **advertising spend share** as the best proxy for what agencies need to report on. Perfect “agency-only” surveys do not exist; spend data from eMarketer, IAB, FICCI-EY, Sensor Tower, and WARC correlates strongly with reporting demand.

**Product principle:** Meta + Google cover the vast majority of agency paid-media work globally. CSV upload covers everything else without building APIs.

---

## Global platform tiers

| Tier | Platform | ~Share of digital ad spend | NextReport status |
|------|----------|---------------------------|-------------------|
| **P0 — Core** | Meta (Facebook + Instagram) | ~23–27% | ✅ API + CSV + full wizard |
| **P0 — Core** | Google Ads (Search + YouTube + Display*) | ~24–28% | ✅ API + CSV (see Google notes below) |
| **P0 — Core** | CSV upload (any platform) | — | ✅ Universal fallback |
| **P1 — Website** | GA4 | — (website analytics) | ✅ Separate wizard path |
| **P2 — US/EU** | TikTok Ads | ~4–7% all digital / ~10–15% social | ✅ Built; **hidden for India visitors** |
| **P3 — B2B niche** | LinkedIn | ~2–6% social | ❌ CSV only if requested |
| **Skip** | Snapchat, X, Pinterest, Reddit | ~1–3% each | ❌ Not planned |
| **Different product** | Amazon / Flipkart retail media | Large in India/US | ❌ Out of scope (marketplace ads) |

\*See [Google Ads coverage](#google-ads-coverage-search--youtube--display) below.

---

## Region breakdown

### India (primary GTM)

| Platform | Relevance | Notes |
|----------|-----------|-------|
| Meta | ★★★★★ | ~64% of digital ad revenue with Google (FICCI-EY 2025) |
| Google | ★★★★★ | Search + YouTube dominant |
| GA4 | ★★★★☆ | Website traffic reports |
| TikTok | **☆☆☆☆☆** | **Banned — zero ad spend.** Do not show in UI for India visitors |
| Retail / Q-comm | ★★★★☆ | Fast growth (Blinkit, Zepto, Amazon IN) — different report model |

**India UI:** Meta · Google · GA4 in the **report wizard only** (homepage and account settings unchanged).

### United States

| Platform | ~Measured digital share (Q3 2025) |
|----------|-------------------------------------|
| Facebook | 27.3% |
| YouTube | 14.2% |
| Instagram | 8.4% |
| TikTok | 4.1% |
| LinkedIn | 2.6% |

Meta + Google ≈ **70%+** of typical agency spend. TikTok is meaningful (~4–10% social) — keep for non-India visitors.

### Europe

- Digital market ~€131B (IAB Europe 2025)
- Google + Meta dominate; TikTok growing (~11% global social share, WARC)
- Same product priority as US: Meta, Google, GA4 first; TikTok as add-on

---

## Google Ads coverage (Search + YouTube + Display)

**All Google campaign types with impressions are included** — there is no channel filter that drops Search, Display, or Video/YouTube campaigns.

| Channel | Included in report? | Type-specific metrics (slots 4–5) |
|---------|---------------------|-----------------------------------|
| **Search** | ✅ Yes | Conversions, cost/conv, conv rate (when CSV has columns) |
| **Display** | ✅ Yes | Viewable impr., viewable rate (when CSV has columns) |
| **YouTube / Video** | ✅ Yes | Video views, avg. CPV (when CSV has columns) |
| Performance Max / Shopping | ✅ Yes | ROAS, conv. value (when CSV has columns) |

### Current gaps (fix in P0 polish, not new platforms)

1. **API sync** fetches only 7 core columns (Campaign, Day, Cost, Clicks, Impr., CTR, Avg. CPC). Display/Video-specific metrics require **CSV upload** with the right export columns today.
2. **Campaign type detection** is account-wide from CSV headers — mixed Search + Display + Video accounts get one slot template for all campaigns until we add per-campaign typing via `campaign.advertising_channel_type` in GAQL.
3. **No campaign picker** for Google — all campaigns in the file are included (by design).

**Download guide columns (recommended CSV):** Campaign, Day, Cost, Impressions, Clicks, CTR, Avg. CPC, Conversions — plus type-specific columns for Display (Viewable impr., Viewable rate) or Video (TrueView views, Avg. CPV).

---

## TikTok decision

**Keep the integration; geo-hide in India.**

| Factor | Assessment |
|--------|------------|
| India | 0% addressable (government ban) |
| US / EU | ~4–15% of social spend; growing ~20%+/yr |
| Engineering | Already built; mirrors Meta engine |
| Maintenance | Low if not marketed in India |

Do **not** delete TikTok code. Hide it for visitors geolocated to India (`x-vercel-ip-country: IN`). Show Meta · Google · TikTok · GA4 for all other regions.

Indian agencies serving US/EU clients at small scale can use a VPN or ask support — not worth cluttering the default India UX.

---

## What we are NOT building (unless a paying customer funds it)

- LinkedIn Ads API
- Snapchat, X/Twitter, Pinterest, Reddit APIs
- Amazon / Flipkart / retail media networks
- Indian short-video apps (Josh, Moj) — negligible paid-ad reporting demand vs Meta

---

## Engineering checklist by phase

### Phase 0 — Now (finalize core)

- [x] Meta — full wizard, API sync, comparison reports, PDF/PPTX
- [ ] Google — API parity with CSV (conversions + channel type in GAQL)
- [ ] Google — per-campaign type slots for mixed accounts
- [x] GA4 — website wizard
- [x] Geo-hide TikTok for India visitors
- [x] CSV as documented fallback for any platform

### Phase 1 — When US/EU customers pay

- [ ] TikTok — polish, market on non-India domains / traffic
- [ ] LinkedIn — only if B2B agency vertical validated

### Phase 2 — Never by default

- Snapchat, X, Pinterest, retail media APIs

---

## Geo visibility rules

| Visitor country (Vercel `x-vercel-ip-country`) | Report wizard platforms shown |
|------------------------------------------------|----------------------------|
| `IN` (India) | Meta · Google · GA4 |
| All other / unknown | Meta · Google · TikTok · GA4 |

Implementation: `src/lib/visitor-geo.ts` + `showTikTokOption` on `ReportUploadWizard` only (passed from the new-report page).

---

## Positioning copy

**India / default on nextreport.in:**
> Automated Meta & Google Ads reports — plus GA4 website traffic. Upload a CSV for any other platform.

**US / EU (non-India visitors):**
> Meta, Google & TikTok Ads reports — plus GA4 — in minutes.

---

## Sources (external)

- eMarketer — Meta/Google global share, triopoly forecasts (2025–2026)
- FICCI-EY / Storyboard18 — India digital ad market, Google+Meta 64%
- IAB Europe AdEx Benchmark 2025 — €131B European digital
- Sensor Tower / AdCurrent — US platform-level spend shares
- WARC — TikTok ~11% global social, US ~34% of TikTok revenue

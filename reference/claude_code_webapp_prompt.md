# NEXTREPORT — FULL WEB APP BUILD BRIEF FOR CLAUDE CODE
# NextReport Engine (NRE v1) — Ad Reporting Automation Platform
# Domain: nextreport.in | Product: NextReport

---

## WHO I AM & CONTEXT

I am a Meta Ads campaign specialist based in India with 5 years of experience managing paid campaigns, currently working remotely for DashClicks — a US-based white-label ad agency. I manage approximately 30 client accounts, each requiring a branded weekly performance report. I have built and tested a working Apps Script prototype (meta_ads_report_v4.js) across multiple real client accounts over several weeks. This brief is for converting that prototype into a production-grade web application called NextReport.

---

## PRODUCT IDENTITY

- **Product name:** NextReport
- **Domain:** nextreport.in
- **Tagline:** "The next report you send will be fast, smooth, and done before you know it."
- **Internal engine name:** NextReport Engine (NRE v1)
- **Target market:** Indian digital agencies and freelancers managing Meta Ads and Google Ads, billing clients in rupees, who cannot afford Western tools priced in USD.
- **Pricing:** ₹999–₹2,999/month INR
- **India-first launch**, then expand to Middle East (UAE, Saudi Arabia), then US/UK

---

## WHAT NEXTREPORT DOES

An automated ad performance report generator. A digital agency uploads their campaign CSV, NextReport generates a fully branded PowerPoint/Google Slides report with AI-written campaign summaries and key insights — in minutes instead of hours.

**Core value:** Any agency, anywhere, uploads any CSV from Meta Ads or Google Ads, and NextReport reads it, recognises every metric, maps it correctly, and outputs a professional branded report. No manual formatting. No copy-pasting numbers. No writing summaries.

---

## THE NEXTREPORT ENGINE (NRE v1) — CORE ARCHITECTURE

This is a schema-first universal reporting engine. It does NOT hardcode metric names or break when new columns appear.

### Pillar 1 — Universal Column Recognition

Every possible column from every Meta/Google export is mapped in a master dictionary. Column headers are matched via keyword patterns, not exact string matching:

```javascript
COLUMN_DICTIONARY = {
  spend:              ['amount spent', 'cost', 'spend', 'amount spent (usd)', 'amount spent (inr)'],
  reach:              ['reach', 'people reached'],
  impressions:        ['impressions'],
  frequency:          ['frequency', 'ad frequency'],
  cpm:                ['cpm', 'cost per 1000 impressions'],
  link_clicks:        ['link clicks', 'outbound clicks', 'clicks (link)'],
  cpc:                ['cpc (all)', 'cpc (cost per link click)', 'average cpc', 'cost per click'],
  ctr:                ['ctr (all)', 'ctr (link)', 'click-through rate'],
  landing_page_views: ['landing page views', 'lpv'],
  cost_per_lpv:       ['cost per landing page view', 'cost per lpv'],
  leads:              ['leads', 'meta leads', 'website leads', 'results'],
  cost_per_lead:      ['cost per lead', 'cost per result'],
  purchases:          ['purchases', 'website purchases'],
  purchase_value:     ['purchase roas', 'purchase conversion value', 'revenue'],
  roas:               ['roas', 'return on ad spend', 'purchase roas'],
  add_to_cart:        ['adds to cart', 'add to cart'],
  initiate_checkout:  ['checkouts initiated', 'initiate checkout'],
  result_type:        ['result type', 'objective', 'optimization goal'],
  result_value:       ['results'],
  date_day:           ['day', 'date'],
  date_start:         ['reporting starts', 'date start', 'start date'],
  date_end:           ['reporting ends', 'date end', 'end date'],
  campaign_name:      ['campaign name', 'campaign'],
  ad_set_name:        ['ad set name', 'adset name', 'ad group name'],
  // Google Ads specific
  conversions:        ['conversions', 'all conversions'],
  conversion_rate:    ['conv. rate', 'conversion rate'],
  cost_per_conv:      ['cost / conv.', 'cost per conversion', 'cpa'],
  search_impr_share:  ['search impr. share', 'impression share'],
  avg_cpc:            ['avg. cpc', 'average cpc'],
  clicks:             ['clicks'],
  quality_score:      ['qual. score', 'quality score'],
}
```

Adding a new column variant in future = one line in the dictionary. Nothing else changes.

### Pillar 2 — Data-First Objective Detection

NEVER trust the result_type column alone. Meta sometimes exports "Reach" for Traffic campaigns. Detect objective from actual data values using this priority hierarchy:

```
Purchases > Leads > Landing Page Views > Link Clicks > Reach > Video Views > App Installs > Conversions
```

Logic:
- If `purchases > 0` → PURCHASE campaign
- If `leads > 0` → LEAD GENERATION campaign
- If `landing_page_views > 0 AND leads = 0` → TRAFFIC (LPV) campaign
- If `link_clicks > 0 AND results ≈ reach` → TRAFFIC (Clicks) — Reach-as-proxy detected
- If `results ≈ reach` AND no other conversion signal → REACH campaign
- Fall back to result_type column text → run through regex dictionary

Objective label dictionary (regex-based, not string matching):
```
/purchase|buy|checkout|transaction|order|sale/  → PURCHASES / COST PER PURCHASE
/lead|form|sign.?up|registration|subscribe/     → LEADS / COST PER LEAD
/landing.?page|lpv|page.?view/                  → LANDING PAGE VIEWS / COST PER LPV
/link.?click|outbound|click/                    → CLICKS / COST PER CLICK
/reach|awareness/                               → REACH / COST PER 1K REACH
/video|view|watch|thruplay/                     → VIDEO VIEWS / COST PER VIEW
/app|install|mobile/                            → APP INSTALLS / COST PER INSTALL
/conv|action/                                   → CONVERSIONS / COST PER CONV
```

### Pillar 3 — Adaptive Slide Filling (Not Auto-Generated Slides)

The PPT template structure is FIXED. Only text content inside it adapts.

- Campaign slides: Fixed card positions. Labels adapt to objective (LEADS, LPV, PURCHASES etc.)
- Combined Total slide: Fixed 10-column table. Column headers 7-10 adapt to whatever objectives are running. If 3 objectives → columns 7-8 for first, 9-10 for second, third shown in notes.
- Cover, Legend: Completely static, never change.
- Alignment can never break because shapes never move.

### Pillar 4 — Self-Healing Missing Data

Every metric slot that cannot be filled from the CSV:
- Gets a dash "—" displayed
- Logs the reason (e.g., "LPV column not found in CSV — showing —")
- Report NEVER crashes due to missing columns

### Pillar 5 — Pre-Generation Validation

Before creating a single slide, validate the uploaded CSV:
- Required columns present (campaign_name, spend, date)
- Date range is valid (not future dates, not more than 90 days)
- At least one result metric present
- Campaign names are not empty
- Show clear error messages if validation fails — never generate a broken report silently

---

## INPUT DATA MODEL

### Single-Download Workflow (Recommended)

User downloads ONE CSV from Meta Ads Manager with "Daily" time increment covering the full month. NRE auto-splits it into:
- **Weekly rows** = last 7 days, always ending YESTERDAY (today excluded — partial day)
- **MTD rows** = all days from month start to yesterday

### CRITICAL: Today's Data Always Excluded

Today's data is incomplete (day still running). Always cap the latest date at yesterday:
```javascript
var yesterdayTs = todayStartTs - 24 * 60 * 60 * 1000;
if (latestTs > yesterdayTs) latestTs = yesterdayTs;
```

### Three Data Sources Per Client

1. **MTD Daily CSV** — Re-uploaded every report run (current month, daily breakdown)
2. **Period CSV** — Previous full month data, uploaded ONCE at month start, not re-uploaded
3. **Budget** — Single monthly budget number per client, set once and updated only if budget changes

### Aggregate Logic — CRITICAL BUG PREVENTION

Group daily rows by `campaign_name + ad_set_name` ONLY.
NEVER group by `result_type`. Meta leaves result_type empty on zero-result days causing the same ad set to split into two wrong groups.

```javascript
var key = [row.campaign_name, row.ad_set_name].join('|||');
// Pick up result_type from rows that have it (non-empty)
if (row.result_type && row.result_type.trim()) {
  g.result_type = row.result_type.trim();
}
```

### CPC Calculation

Always calculate CPC as: `total_spend / total_link_clicks`
NEVER as `spend / impressions` (that gives CPM÷1000, not CPC).
Track daily CPC values and average them as fallback if link_clicks = 0.

### Reach in Daily Data

Reach from daily CSV is NOT additive (same person counted each day).
- Campaign slides: Show reach from aggregated rows (approximate, labeled clearly)
- Combined Total MTD row: Show "—" for reach — daily data cannot produce deduplicated period reach
- Period row (from non-daily Period CSV): Shows correct deduped reach

---

## SLIDE STRUCTURE (Identical to Current Tested System)

### Slide Order
1. Cover slide
2. Campaign summary slides (one per unique campaign)
3. Ad set slides (ONLY if campaign has 2+ ad sets — single ad set campaigns skip to avoid duplicate data)
4. MTD Performance Chart slide (visual — circles per campaign showing Spend, Results, CPR)
5. Campaign Overview — Combined Total slide (3 rows: Header | Previous Month | Current MTD)
6. Metric Abbreviation Guide (Legend)

### Cover Slide Tags
`{{ACCOUNT_NAME}}` `{{REPORT_DATE}}` `{{ACCOUNT_HEALTH_BADGE}}` `{{BUDGET_SUMMARY}}`

### Campaign Slide Tags
`{{CAMPAIGN_NAME}}` `{{METRIC_SPEND}}` `{{METRIC_REACH}}` `{{METRIC_IMPRESSIONS}}` `{{METRIC_RESULTS}}` `{{RESULT_LABEL}}` `{{METRIC_CTR}}` `{{METRIC_CPR}}` `{{COST_LABEL}}` `{{METRIC_CPC}}` `{{DATE_RANGE}}` `{{CAMPAIGN_SUMMARY}}` `{{KEY_INSIGHTS}}`

### Combined Total Slide Tags
Header row: `{{PERIOD_RESULT1_LABEL}}` `{{PERIOD_CPR1_LABEL}}` `{{PERIOD_RESULT2_LABEL}}` `{{PERIOD_CPR2_LABEL}}`
Period row: `{{PERIOD_MONTH}}` `{{PERIOD_SPEND}}` `{{PERIOD_REACH}}` `{{PERIOD_IMPRESSIONS}}` `{{PERIOD_CTR}}` `{{PERIOD_CPC}}` `{{PERIOD_RESULT1}}` `{{PERIOD_CPR1}}` `{{PERIOD_RESULT2}}` `{{PERIOD_CPR2}}`
MTD row: `{{MTD_MONTH}}` `{{MTD_SPEND}}` `{{MTD_REACH}}` `{{MTD_IMPRESSIONS}}` `{{MTD_CTR}}` `{{MTD_CPC}}` `{{MTD_RESULT1}}` `{{MTD_CPR1}}` `{{MTD_RESULT2}}` `{{MTD_CPR2}}`

### Heading Font Hierarchy (Poppins throughout)
- Slide main heading: 28pt bold
- Campaign/ad set name: 18pt
- Ad set slides: show ONLY ad set name + "(Ad Set)" suffix, NOT campaign name
- Campaign Summary text: 13pt non-bold
- Key Insights text: 13pt non-bold
- Metric labels: 9-10pt

### Account Health Score (Cover Slide)
Calculated from weekly data across 4 factors:
- Results delivery + WoW trend: 35 pts
- CTR engagement: 25 pts
- Audience frequency health: 20 pts
- Cost efficiency: 20 pts

Display rules:
- Score ≥ 80: "🟢 Weekly Performance Score: 87/100 — Excellent"
- Score ≥ 70: "🟢 Weekly Performance Score: 74/100 — Good"
- Score 50-69: "🟡 Campaigns On Track — performing as expected"
- Score < 50: "⚙️ Campaigns under active optimisation this week" (no number shown)

### MTD Chart Slide
- One donut circle per campaign (outer colored ring + inner dark circle)
- Colors: orange=Leads, blue=Traffic/Clicks, green=Reach, purple=LPV, teal=Purchases
- Inside circle: AD SPEND (large white text)
- Below circle: Results count + CPR
- Bottom of slide: Spend proportion bar (each campaign's % share of total MTD spend)
- Title: "MTD CAMPAIGN PERFORMANCE" at 28pt

---

## AI WRITING (Groq Primary, Gemini Fallback)

- **Primary:** Groq `llama-3.3-70b-versatile`
- **Fallback:** Google Gemini 2.5 Flash
- **User provides their own API keys** in settings (v1 launch)

### Campaign Summary (per slide)
One paragraph, under 65 words, covering ALL six metrics: Ad Spend, Reach, Result count, Cost per Result, CTR, CPC. Professional account manager tone. 13pt non-bold Poppins.

### Key Insights & Updates (per slide)
One flowing paragraph, 4-5 sentences, no bullets. Covers 2 performance insights from this week + 2 strategy recommendations for next week. 13pt non-bold Poppins.

---

## MULTI-CLIENT WORKSPACE

```
User Account
  └── Clients (one per ad account)
        ├── Profile (account name, currency, timezone, budget)
        ├── Templates (chosen from library OR uploaded custom)
        ├── Reports (history of all generated reports)
        └── Config (API keys, reporting preferences)
```

---

## MULTI-CURRENCY & MULTI-TIMEZONE

Per-client settings. Handled at the client profile level.

**Currencies:** ₹ INR (default India) | $ USD | £ GBP | A$ AUD | C$ CAD | AED UAE Dirham

**Timezones:** Asia/Kolkata (IST, default) | America/Chicago (CST) | America/New_York (EST) | America/Los_Angeles (PST) | Europe/London (GMT) | Australia/Sydney (AEST) | Asia/Dubai (GST)

**Date formats:** Auto-detected from CSV. Indian DD-MM-YY and US MM-DD-YY both handled. Display always as "Jul 13 - Jul 19" (full month name, full date range, never abbreviated like "Jul 13-19").

**Filename format:** `Meta Ads Report - 07_13_2026_to_07_19_2026` (uses GLOBAL weekly start/end across all campaigns, not first campaign's dates)

---

## TEMPLATE LIBRARY (At Launch)

6 pre-built templates in the NextReport library. Client chooses one as default:
1. `META_ADS_REPORT_TEMPLATE_DARK.pptx` — Deep navy (primary, most tested)
2. `META_ADS_REPORT_TEMPLATE_LIGHT.pptx` — Ice blue-grey background
3. `META_ADS_REPORT_TEMPLATE_EMERALD.pptx` — Dark forest green
4. `META_ADS_REPORT_TEMPLATE_PURPLE.pptx` — Royal indigo
5. `META_ADS_REPORT_TEMPLATE_CRIMSON.pptx` — Deep crimson red
6. `META_ADS_REPORT_TEMPLATE_GRAPHITE.pptx` — Near-black graphite

**"Upload your own template" is Phase 2.** At launch: choose from library only.

---

## PLATFORMS SUPPORTED

### v1 Launch
- **Meta Ads** — Facebook + Instagram (fully tested)
- **Google Ads** — Search + Performance Max + YouTube/Video (to be built and tested before launch)

### Google Ads Specifics
Same slide structure as Meta. Campaign type auto-detected:
- Search: Impressions, Clicks, CTR, Avg CPC, Cost, Conversions, CPA, Search Impression Share
- Performance Max: Conversions, CPA, ROAS, Cost
- YouTube/Video: Views, View Rate, CPV, Reach, Impressions

One Google Ads report includes ALL campaign types together.

### Future Phases (NOT in v1)
LinkedIn Ads (Phase 2) | Snapchat Ads (Phase 3) | TikTok Ads (Phase 3)

---

## FEATURES — PHASE 1 (LAUNCH)

- [ ] Multi-client workspace with client profiles
- [ ] CSV upload (MTD Daily + Period + Budget per client)
- [ ] Column auto-detection from any CSV format
- [ ] Data-first objective detection
- [ ] Pre-generation validation with clear error messages
- [ ] AI-written campaign summaries and key insights (Groq + Gemini fallback)
- [ ] Report generation with download as PPTX
- [ ] Google Slides export option
- [ ] Report preview before download
- [ ] 6-template library (Meta dark/light + 4 colour variants)
- [ ] Multi-currency per client (₹ $ £ A$ C$ AED)
- [ ] Multi-timezone per client
- [ ] Account Health Score on cover slide
- [ ] Budget utilization on cover slide

## FEATURES — PHASE 2 (POST-LAUNCH)

- [ ] "Share with client" — read-only report link for clients
- [ ] Report history per client (all past reports accessible)
- [ ] Error detection and pre-send validation
- [ ] Upload your own branded PPT template (NRE tags it automatically)
- [ ] Meta Marketing API connection (eliminate CSV download step)
- [ ] Google Ads API connection
- [ ] Google Ads report support
- [ ] Email delivery of report link to client

## FEATURES — PHASE 3 (SCALE)

- [ ] LinkedIn Ads support
- [ ] White-label domain for agencies (their own URL)
- [ ] Team seats (multiple users per agency account)
- [ ] CRM integrations (send report link to HubSpot, Zoho, etc.)
- [ ] Automated scheduling (report generates and sends every Monday)

## WHAT NOT TO BUILD IN v1
- No combined Meta + Google single report (two separate reports)
- No TikTok, Pinterest, Snapchat
- No built-in CRM integration
- No custom domain/white-label
- No team collaboration
- No automated scheduling
- No upload-your-own template

---

## TECHNICAL STACK

- **Frontend:** Next.js + React + Tailwind CSS
- **Deploy:** Vercel
- **Auth:** NextAuth.js (email/password + Google OAuth)
- **Database:** PostgreSQL via Supabase or PlanetScale
- **File storage:** Supabase Storage or AWS S3 (for uploaded CSVs and generated reports)
- **PPTX generation:** pptxgenjs (translate Apps Script logic)
- **CSV parsing:** PapaParse
- **AI:** Groq API (user's key) + Google Gemini API (fallback, user's key)
- **Payments:** Razorpay (India-first, supports UPI, cards, net banking)

---

## USER WORKFLOW (Web App — Streamlined)

Current Apps Script (8 manual steps) → Web App (3 steps):

1. Log in → Select client account
2. Upload MTD Daily CSV (downloaded from Meta/Google)
3. Click Generate → Preview → Download or Share

Everything else (column detection, objective mapping, AI writing, template filling, date formatting, currency, account health calculation) happens automatically.

---

## MARKET CONTEXT

- **Primary market:** India — 25,000-40,000 active agencies/freelancers running paid campaigns for clients
- **Secondary:** Middle East (UAE, Saudi Arabia) — same workflow, billing in USD
- **Tertiary:** US/UK — later expansion, higher competition
- **Revenue target:** ₹999-₹2,999/month per agency
- **Break-even:** 200-300 paying customers
- **No Indian competitor** at this price point with this feature set

---

## ARCHITECTURE LINEAGE

- **Architecture 1:** Original Apps Script. Weekly CSV + Period CSV + Budgets. Tested on ~5 accounts. Breaks on new account configurations.
- **Architecture 2:** MTD Daily CSV split system. One download covers weekly + MTD. Better workflow. Still brittle on objective detection.
- **Architecture 3 (this — NRE v1):** Schema-first universal engine. Column dictionary, data-first objective detection, adaptive slide filling, multi-tenant user accounts, client profiles, pre-generation validation. Built from the ground up in Next.js.

---

## SESSION START INSTRUCTION FOR CLAUDE CODE

When opening Claude Code, paste this as the first message:

"We are building NextReport — an automated ad reporting web application for Indian digital agencies. The product is called NextReport and the domain is nextreport.in.

I have a fully tested Apps Script prototype (meta_ads_report_v4.js attached) that generates branded PowerPoint reports from Meta Ads CSV data. I also have 6 pre-built PPT templates (attached).

The full specification is in claude_code_webapp_prompt.md (attached). The core architecture is the NextReport Engine (NRE v1) — a schema-first universal reporting engine with column auto-detection, data-first objective recognition, and adaptive slide filling.

Build this as a Next.js web application. Start with:
1. User authentication (NextAuth — email/password + Google OAuth)
2. Multi-client workspace (CRUD for client profiles)
3. CSV upload + column auto-detection
4. Report generation using exact logic from meta_ads_report_v4.js
5. Download as PPTX

Do not deviate from the core logic in meta_ads_report_v4.js — it has been tested on real accounts and edge cases are already handled. Use the specification in claude_code_webapp_prompt.md as the single source of truth."

---

## FILES TO ATTACH IN CLAUDE CODE SESSION

1. `claude_code_webapp_prompt.md` — This document
2. `meta_ads_report_v4.js` — Tested Apps Script (all logic to translate)
3. `META_ADS_REPORT_TEMPLATE_DARK.pptx` — Primary template
4. `META_ADS_REPORT_TEMPLATE_LIGHT.pptx`
5. `META_ADS_REPORT_TEMPLATE_EMERALD.pptx`
6. `META_ADS_REPORT_TEMPLATE_PURPLE.pptx`
7. `META_ADS_REPORT_TEMPLATE_CRIMSON.pptx`
8. `META_ADS_REPORT_TEMPLATE_GRAPHITE.pptx`
9. Sample Meta Ads CSV (MTD Daily format)
10. Sample Google Ads CSV (when ready)


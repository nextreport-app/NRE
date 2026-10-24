# Vercel Function Storage — runbook (project-nre)

Use this when Vercel emails **“100% of Function Storage (10 GB)”** or the dashboard shows high **Function Storage** on the **Hobby / free** team.

## What it is (and is not)

| Meter | What it measures |
|--------|------------------|
| **Function Storage** | Total size of **serverless function bundles** stored for **all deployments** (Production + every Preview). Each deploy uploads ~100+ functions. |
| **Not this** | Live traffic, request count, or **Vercel Blob** (reports, wizard CSV cache, logos). |

Heavy **Preview** usage (PR branches, Cloud Agent deploys) can fill the 10 GB free quota **without** production traffic.

**Blob** cleanup is separate — see [Blob / wizard cleanup](#blob-wizard-storage-separate) below.

---

## Quick fix (when you get the email)

**Goal:** Remove old Preview deployments so stored bundles drop. New code merges only shrink **future** deploys; **deleting old deploys** is what lowers the meter.

1. Open [Vercel Dashboard](https://vercel.com) → team **project-nre** → project **NRE** (or your production project name).
2. Go to **Deployments**.
3. Filter **Environment: Preview** (leave **Production** alone unless you know you need to roll back).
4. **Bulk-select** old previews → **Delete**  
   - Keep: **Production** (latest).  
   - Keep: 0–2 recent previews you are actively testing.  
   - Delete: stale `cursor/*` branch previews, merged PR previews, failed/abandoned builds.
5. Wait **15–60 minutes**, then check **Settings → Usage** (Function Storage should trend down).

Optional one-time deep clean:

- **Settings → General → Deployment Retention** → set **Preview** retention to **7 days** (or **1 day** during heavy agent/PR weeks).
- Enable **Automatically delete deployments** for previews if available on your plan.

---

## Recommended retention (ongoing)

| Environment | Suggested retention | Notes |
|-------------|---------------------|--------|
| **Production** | Default / longer | Needed for rollbacks. |
| **Preview** | **7 days** (or **1–3 days** while many agent branches deploy) | Cuts Function Storage growth from CI + Cloud Agents. |

After changing retention, **manually delete** previews already on the account once; retention only applies to **future** expiry.

---

## Monthly checklist (5 minutes)

- [ ] **Deployments** → delete Preview deploys older than you need.
- [ ] **Usage** → Function Storage under ~70% on free tier (headroom before email).
- [ ] Confirm **Production** deploy is the one you intend (not an old preview).
- [ ] If Blob grows (reports / uploads): confirm daily cron runs — see below.

---

## How to confirm it worked

1. **Vercel** → **Settings → Usage** → **Function Storage** (team **project-nre**).
2. Usage may lag the dashboard by up to ~1 hour after bulk deletes.
3. If still at 100% after 24h: delete more Preview deployments or shorten retention further.

---

## Blob / wizard storage (separate)

Wizard upload sessions and drafts live in **Vercel Blob**, not Function Storage.

- **TTL:** upload sessions 24h (`WIZARD_UPLOAD_SESSION_TTL_MS`); server drafts per `WIZARD_SERVER_DRAFT_TTL_MS`.
- **Cron:** `GET /api/cron/purge-reports` daily (`vercel.json` → `0 4 * * *`) runs stale wizard blob purge + report retention.
- **Requires:** `CRON_SECRET` on Production.
- **Manual maintenance** (authorized):  
  `GET /api/cron/purge-reports?wizardPurge=all` with `Authorization: Bearer <CRON_SECRET>`  
  deletes **all** ephemeral wizard blobs (does **not** delete `reports/`, `logos/`, `previous-month-data/`).

Report PPTX files: removed by report retention in the same cron when past each user’s retention window.

---

## Why NRE deploys add up quickly

- Next.js App Router → many API routes = many function bundles per deploy.
- Each **Preview** is a full duplicate of that set.
- Codebase avoids pulling heavy deps into every function (see below); **old previews still count** until deleted.

### What we keep out of most functions

- `@sparticuz/chromium` (PDF path disabled; ~66 MB if traced everywhere)
- `templates/*.pptx` except on PPTX worker API routes
- Musl Sharp libs on glibc Vercel (Open Graph route)

Report **enqueue** routes import job payload types only; PPTX rendering loads in `/api/jobs/generate-report`.

---

## When to upgrade vs clean

| Situation | Action |
|-----------|--------|
| Many PR/agent previews, Hobby 10 GB full | **Delete previews + shorten retention** (this runbook). |
| Steady production growth, need long preview history | **Pro** (higher Function Storage allowance). |
| “Unexpected” 100% with almost no deploys | Check for runaway CI (duplicate projects, fork deploys) in **Deployments** list. |

---

## Do not

- Delete **Production** unless you are intentionally rolling back or redeploying.
- Confuse Function Storage with **Blob** — fixing Blob cron does not fix Function Storage.
- Delete the Vercel project to “reset” unless you intend to recreate env vars, domains, and Blob store links.

---

## Related

- `vercel.json` — cron schedule for purge job
- `src/lib/wizard-storage-cleanup.ts` — wizard blob purge implementation
- `src/lib/report-retention.ts` — expired report + blob deletion

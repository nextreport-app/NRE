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
4. Delete previews **one at a time** via **⋯ → Delete** (the dashboard has **no multi-select bulk delete** as of 2026).
5. Wait **15–60 minutes**, then check **Settings → Usage** (Function Storage should trend down).

For many previews, use [Bulk delete (CLI or API)](#bulk-delete-preview-deployments) below instead of clicking each row.

Optional one-time deep clean:

- **Settings → General → Deployment Retention** → set **Preview** retention to **7 days** (or **1 day** during heavy agent/PR weeks).
- Enable **Automatically delete deployments** for previews if available on your plan.

---

## Bulk delete preview deployments

The dashboard only deletes **one deployment per action**. These options remove **many previews at once**.

### Option A — Vercel CLI (simplest one-shot)

Prerequisites: [Vercel CLI](https://vercel.com/docs/cli) installed, logged in (`vercel login`), correct team scope.

From your linked NRE project directory (or pass `--cwd`):

```bash
# List recent deploys (sanity check)
vercel list --scope project-nre

# Remove all deployments for this project EXCEPT those still tied to
# production domain or an active preview URL (--safe).
# Does NOT delete the Vercel project itself when --safe is set.
vercel remove <project-name> --safe --yes --scope project-nre
```

Replace `<project-name>` with the project slug from the dashboard URL (often `nre`, not the team name `project-nre`).

**Warning:** Do **not** run `vercel remove <project-name>` **without** `--safe` — that removes the **entire project** from the team, not just old deploys.

After a big purge, confirm **Production** still shows the deployment you expect under **Deployments → Production**.

### Option B — CLI: delete several URLs in one command

```bash
vercel remove deployment-a.vercel.app deployment-b.vercel.app --yes --scope project-nre
```

Use `vercel list` (or the dashboard) to copy preview URLs. Impractical for hundreds of agent branches; use Option A or C.

### Option C — REST API (scriptable, preview-only)

1. Create a token: [Vercel → Account → Tokens](https://vercel.com/account/tokens).
2. Find **Project ID** and **Team ID** (Project → Settings → General, or `vercel project ls`).

```bash
export VERCEL_TOKEN="..."
export VERCEL_TEAM_ID="team_..."      # team project-nre
export VERCEL_PROJECT_ID="prj_..."

# List deployments (paginate with `until` from pagination.next if needed)
curl -s "https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&limit=100" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  | jq -r '.deployments[] | select(.target != "production") | .uid' \
  | while read -r uid; do
      echo "Deleting $uid"
      curl -s -X DELETE "https://api.vercel.com/v13/deployments/${uid}?teamId=${VERCEL_TEAM_ID}" \
        -H "Authorization: Bearer ${VERCEL_TOKEN}"
      sleep 0.5   # reduce 429 rate limits
    done
```

Re-run the list/delete loop until previews stop appearing or usage drops. Respect API rate limits (back off on HTTP 429).

### Option D — Retention only (no bulk delete)

Your **Deployment Retention Policy** (e.g. Pre-Production **1 day**) deletes previews **automatically after they age out**. It does **not** remove deploys already on the account — use A or C once, then let retention prevent recurrence.

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

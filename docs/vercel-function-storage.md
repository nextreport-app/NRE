# Vercel Function Storage (free tier)

**Function Storage** is the total size of serverless function bundles **across all deployments** on your team—not traffic or Blob storage. Many preview deployments (Cloud Agent / PR branches) each upload ~100+ functions; that adds up toward the 10 GB free limit even with zero visitors.

## Free up space on Vercel

1. Open [Vercel Dashboard](https://vercel.com) → team **project-nre** → **Deployments**.
2. Filter **Preview** deployments and bulk-delete old ones (keep **Production** and the latest preview you care about).
3. Optional: **Settings → General → Deployment Retention** → shorten preview retention.

After merging storage fixes, **new** deployments are smaller; deleting old deployments is what actually drops usage toward 75% → 0%.

## What we keep out of most functions

- `@sparticuz/chromium` (PDF path disabled; ~66 MB if traced everywhere)
- `templates/*.pptx` except on PPTX worker API routes
- Musl Sharp libs on glibc Vercel (Open Graph route)

Report **enqueue** routes import job payload types only; PPTX rendering loads in `/api/jobs/generate-report`.

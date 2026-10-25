# Google OAuth verification — demo UI unlock

Production is **Meta-first**: Account settings normally show Agency branding, Report retention, Google Drive, Meta Ads (CSV), Slack/Zapier, and Billing only. Google Ads, GA4, TikTok, and wizard **Sync from API** are gated in code until launch parity is done.

For **Google OAuth app verification** (restricted scopes `adwords` + `analytics.readonly`), turn on a temporary env flag so reviewers can see the real connect + read-only API flows in the demo video.

## Enable on Vercel (production)

1. **Project → Settings → Environment Variables** (Production):
   - `GOOGLE_OAUTH_VERIFICATION_UI` = `true`
2. Confirm OAuth clients and redirect URIs are set (see `.env.example`):
   - `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` → `/api/google-ads/callback`
   - `GA4_CLIENT_ID` / `GA4_CLIENT_SECRET` → `/api/ga4/callback`
3. **Redeploy** production (env is inlined at build time for client bundles).
4. Add reviewer Gmail(s) under **Google Cloud → OAuth consent screen → Test users** while the app stays in Testing mode.

Optional: you can still set `AD_PLATFORM_API_SYNC_ENABLED=true` instead of (or in addition to) the verification flag; the verification flag already enables API import + Google Ads connect UI.

## What becomes visible

| Area | When flag is `true` |
|------|---------------------|
| **Account → Google Ads** | Connect OAuth, disconnect, **Verify API access** (ListAccessibleCustomers) |
| **Account → Google Analytics (GA4)** | Connect OAuth, list properties, disconnect |
| **Client → Platform connections** | Google Ads customer link + GA4 property picker |
| **Report wizard** | Google Ads platform + **Sync from API** toggle; GA4 website path |
| **`/clients/[id]/reports/website/new`** | Full **Website Traffic** wizard (not “launching soon”) |

**Still hidden:** TikTok, public marketing “full launch” copy, and `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED` (login with Google) unless you set that separately.

## After Google approves

1. Set `GOOGLE_OAUTH_VERIFICATION_UI` to `false` or remove it.
2. Redeploy — Account settings return to the Meta-only surface unless you promote platforms in `src/lib/meta-launch-scope.ts` (`LAUNCH_ENABLED_PLATFORMS`).

## Suggested Loom script (read-only app)

1. Log in with the **test user** you email to Google (email + password — not “Continue with Google” unless sign-in flag is on).
2. **Account settings** → scroll to **Google Ads** → **Connect Google Ads** → complete consent → **Verify API access** (show account list; no edits in Google Ads).
3. Same page → **Google Analytics (GA4)** → **Connect** → **List properties** (read-only).
4. **Clients** → pick a client → link GA4 property if needed → **Website Traffic report** (or wizard → Google Analytics card) → preview/generate to show `analytics.readonly` use.
5. Optional: **Report wizard** → Google Ads → **Sync from API** → run sync (read-only reporting).

In the verification reply, state clearly that NextReport is **read-only** for Ads and Analytics — no create/update/delete of campaigns or GA config.

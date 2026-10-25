# Google OAuth verification — demo video

Product UI exposes **Google Ads**, **GA4**, **TikTok**, and **Sync from API** by default after the multi-platform launch (`src/lib/meta-launch-scope.ts`). No temporary env flag is required for the verification Loom.

## Before recording

1. Confirm OAuth clients and redirect URIs (`.env.example`):
   - `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` → `/api/google-ads/callback`
   - `GA4_CLIENT_ID` / `GA4_CLIENT_SECRET` → `/api/ga4/callback`
2. For wizard **Sync from API** in the video, set **`AD_PLATFORM_API_SYNC_ENABLED=true`** on Vercel Production. Account **Connect** + **Verify API access** / **List properties** work without it (default off).
3. Add reviewer Gmail(s) under **Google Cloud → OAuth consent screen → Test users** while the app stays in Testing mode.

## Suggested Loom script (read-only app)

1. Log in with the **test user** you email to Google (email + password — not “Continue with Google” unless sign-in flag is on).
2. **Account settings** → **Google Ads** → **Connect** → **Verify API access** (account list only).
3. **Google Analytics (GA4)** → **Connect** → **List properties**.
4. **Clients** → link GA4 property → **Website Traffic report** or wizard → **Google Analytics** card → preview/generate.
5. Optional: wizard → **Google Ads** or **Meta** → **Sync from API**.

State in your verification reply that NextReport is **read-only** for Ads and Analytics.

# Google OAuth — test users & Drive connect

NextReport uses one Google Cloud **OAuth 2.0 Web client** (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`) for:

- **Sign in with Google** (NextAuth)
- **Connect Google Drive** (`/api/google-drive/connect` → callback `/api/google-drive/callback`)

Google Ads and GA4 use **separate** OAuth clients (see `.env.example`).

For **OAuth verification demo video**, see [google-oauth-verification-demo.md](./google-oauth-verification-demo.md).

## Error: “Access blocked — has not completed the Google verification process” (403)

If the OAuth consent screen is in **Testing** mode, only listed test users can approve access. This error alone does not establish that the project is in Testing: also inspect the exact error details, requested scopes, user quota and verification status. Keep the project In production when the verification team instructs you to do so.

### Fix (for a new tester like `ayuhherbs@gmail.com`)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → the project that owns `AUTH_GOOGLE_ID`.
2. **APIs & Services** → **OAuth consent screen**.
3. Under **Test users**, click **Add users** → add the exact Google account email (e.g. `ayuhherbs@gmail.com`).
4. Save. Wait a minute, then retry **Account → Connect Google Drive** (or Sign in with Google).

Also confirm:

- **Google Drive API** is enabled (APIs & Services → Library → “Google Drive API”).
- **Credentials** → your Web client → **Authorized redirect URIs** include:
  - `https://nextreport.in/api/auth/callback/google` (login)
  - `https://nextreport.in/api/google-drive/callback` (Drive connect)
  - Same paths for `www.nextreport.in` if you use www, plus any Vercel preview URLs you test on.

## “Connected ✓” but Verify API access / List properties fails (401 or refresh error)

The UI can still show **Connected** while tokens in the database are **stale**. Typical causes:

1. **OAuth client secret rotated** in Google Cloud — existing refresh tokens stop working until **Disconnect → Connect** again.
2. **Vercel Production env mismatch** — `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` (and `GA4_CLIENT_*` if used) must match the Web client that issued the tokens.
3. **GA4 vs Ads client drift** — GA4 connect uses `GA4_CLIENT_*` when set, otherwise falls back to `GOOGLE_ADS_*`. Changing Production env without reconnecting breaks refresh.
4. **Expired access token** — retry after a fresh connect so refresh_token is reissued with `prompt=consent`.

**Fix on prod:**

1. Account → **Google Ads** → **Disconnect** → **Connect Google Ads** → Allow on consent.
2. Account → **GA4** → **Disconnect** → **Connect Google Analytics** → Allow.
3. Retry **Verify API access** / **List GA4 properties**.

Confirm redirect URIs on the **Ads/GA4 OAuth client** (not necessarily the Drive client):

- `https://nextreport.in/api/google-ads/callback`
- `https://nextreport.in/api/ga4/callback`

## Already signed up with Google (founder / early accounts)

**Continue with Google is enabled on login and signup.** The former `NEXT_PUBLIC_GOOGLE_SIGNIN_ENABLED` gate is retired; stale environment values no longer disable the button or omit the NextAuth provider. Google-only accounts have no password until they set one — a guessed password will fail.

**Recommended (no Google approval needed):**

1. Go to **Forgot password** on [nextreport.in](https://nextreport.in/forgot-password).
2. Enter the same Gmail you used for Google sign-up.
3. Open the reset link and **set a password** (this updates your existing user — same clients, reports, and admin access).
4. Log in with **email + password**.

**Use Google again:**

1. Deploy the restored Google sign-in change.
2. Confirm `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and the exact `/api/auth/callback/google` redirect URI match the Cloud client.
3. Use **Continue with Google** on login or signup and capture the exact error if Google rejects the request. In Testing projects, the account must be a listed test user.

Login uses basic identity permissions. Ads, Analytics and Drive have separate connection flows; enabling login does not add their scopes or prove that those integrations are verified.

### Production (all users)

When you are ready for any Google user to connect without being listed as a tester:

1. OAuth consent screen → **Publish app** (move to **In production**).
2. Complete Google’s verification if you use sensitive/restricted scopes beyond what you already use (`drive.file` is a non-sensitive scope for verification purposes, but publishing still requires a completed consent screen configuration).

For a project actually in Testing, add each test account under **Test users**. For an In production project under review, follow the verification team’s staging instructions and diagnose the specific error rather than switching publishing modes.

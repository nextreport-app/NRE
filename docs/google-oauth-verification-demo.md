# Google OAuth verification — recording guide

Updated 27 October 2026. Google signup/login is public and requests only `openid profile email`. The owner confirmed a previously unused Google account successfully created a NextReport account through the login screen. That combined signup/sign-in behavior is intentional. It does not grant Ads, Analytics, Gmail inbox or Drive access.

## What the screenshots establish

- Branding is verified; homepage and branding requirements passed.
- Data access is still under review. `adwords` and `analytics.readonly` explicitly remain unverified.
- The audience screen shows **3 users / 100 user cap** for unapproved sensitive/restricted-scope authorizations. This is not a three-account signup limit or a universal 100-user limit for basic identity-only login.
- Keep publishing status **In production**, as the verification team instructed. Do not change to Testing merely to prepare the video.
- The console's **Use secure flows** warning needs inspection. Current code uses authorization-code flows, state and PKCE (S256). The screenshot alone cannot establish which OAuth client or observed request triggered the warning, whether it reflects old traffic, or whether a Cloud client setting remains wrong. Expand the warning and inspect the actual client/request; do not claim it is resolved because login succeeds.
- Missing Cloud billing association is a separate project configuration item. It does not prove that free/basic Google login needs billing, nor does adding billing approve scopes.

## Before recording another scope-review video

The current launch scope remains Meta-only. Account Settings shows Ads/GA4 connections, but Google Ads wizard selection and the GA4 report page remain hidden. There is no full public Ads/GA4 recording journey today. The owner requested **only signup/login improvements for now**. This change does not unhide those integrations or implement a review environment.

Prepare a stable, access-controlled review/staging environment with the complete integrations before recording their report-generation sections. This needs a separate implementation and live-provider test. Do not change the global production platform list or enable production API sync just to record. Login can remain public independently.

In the Cloud project owning each OAuth client:

1. **Google Auth Platform → Clients**: map login (`AUTH_GOOGLE_ID`), Ads (`GOOGLE_ADS_CLIENT_ID`), and Analytics (`GA4_CLIENT_ID`, falling back to the Ads client) to their actual Cloud projects. Separate client IDs in one project share project-level consent configuration.
2. Register exact callback URLs on the appropriate Web clients:
   - Login: `https://<host>/api/auth/callback/google`
   - Ads: `https://<host>/api/google-ads/callback`
   - Analytics: `https://<host>/api/ga4/callback`
   - Existing Drive connection, if applicable: `https://<host>/api/google-drive/callback`
3. **APIs & Services → Library**: confirm Ads, Analytics Admin and Analytics Data APIs as needed. Google Ads API access approval/credentials are separate from OAuth consent verification.
4. **Google Auth Platform → Data Access**: align submitted scopes with the features actually demonstrated in that project. Do not add Ads/Analytics permissions to login. Show separate incremental connections. Account for existing `drive.file` requests if Drive uses this project.
5. Update the justification to explain both Ads and GA4; the screenshot's current text describes only Ads.
6. Test complete API-to-report journeys using owned source accounts with data. CSV-generated reports do not prove API-scope use. Do not fabricate results or submit planned functionality as working.

## Video sequence

Use an owned Google account with accessible Ads and GA4 data. Keep the browser URL visible, show permission details legibly, and avoid recording credentials, tokens or private client data. Include all OAuth clients relevant to the submission and show any unverified-app warning encountered in the authorized test flow, as Google requested. Do not attempt to bypass a blocked authorization.

### 1. Introduce NextReport and demonstrate identity-only login

- Open the homepage and privacy policy.
- Open signup → **Continue with Google** → select the account → finish authorization → show the new client workspace.
- Sign out → login → **Continue with Google** → select the same account → show the existing workspace.
- Explain: Google verifies identity. A new Google user automatically gets a NextReport account and trial; an existing account is signed in. No Ads or Analytics permission is requested here.

This section alone is insufficient for the pending Ads/GA4 review.

### 2. Demonstrate Google Ads, once the review environment is ready

- Account Settings → **Google Ads → Connect Google Ads**.
- Show the account picker, warning if displayed, and consent details for `https://www.googleapis.com/auth/adwords`.
- Return to NextReport → **Verify API access** → show accessible accounts.
- Client → Generate report → select Google Ads → API import/sync → select account and dates → fetch campaigns → review campaigns/objectives and metrics → generate → open the report.
- Open Google Ads with the same account/dates and compare representative metrics.
- Explain that Google Ads uses the broad `adwords` permission because no narrower read-only reporting OAuth scope is available; NextReport's implementation makes reporting calls and no mutate calls. Do not call the permission itself read-only.

### 3. Demonstrate GA4, once the review environment is ready

- Account Settings → **Google Analytics (GA4) → Connect Google Analytics**.
- Show its separate consent flow and `https://www.googleapis.com/auth/analytics.readonly` permission.
- Return → **List GA4 properties**.
- Client → Website Analytics → select/save the property → Website Traffic Report → **Sync from GA4 API**.
- Select dates and supported breakdowns → load preview → generate → open the output.
- Open Analytics with the same property/dates and compare supported metrics such as sessions, engagement rate and views. Show the supported report options relevant to the submitted feature.
- Do not promise generic search impressions/clicks from GA4: Search Console or linked Ads reporting can require separate integrations/data availability.

### 4. Demonstrate connection control and submit

- Show disconnecting the integration in NextReport. Describe local removal accurately; do not claim Google-side grant revocation unless implemented and demonstrated.
- If Drive is part of the reviewed scope inventory, show its own consent and the working save-to-Drive feature as well.
- Upload an **Unlisted** YouTube video. Add timestamps for identity, Ads consent/report, Analytics consent/report and any other demonstrated flow. Do not use a private video that reviewers cannot open.
- Update **Google Auth Platform → Data Access → Demo video** and save. Follow any resubmission step shown in Verification Center, then reply directly to the review email with the link, timestamps and explanation of the separate authorization flows.

## Scope justification example (896 characters)

Use only once the described functionality is demonstrably working. Add a separate explanation if Drive is in scope.

> NextReport creates marketing reports from user-selected accounts and dates. Google sign-in uses only basic identity scopes. Google Ads is an optional, separate connection using https://www.googleapis.com/auth/adwords to list accessible customer accounts and read campaign/ad-group performance via Google Ads API reporting queries. Google Ads does not provide a narrower read-only OAuth reporting scope; our implementation performs no mutate operations. GA4 is a separate optional connection using https://www.googleapis.com/auth/analytics.readonly to list accessible properties through Analytics Admin API and read website performance through Analytics Data API runReport. Users select a property and dates, preview metrics, and generate a report. CSV upload requires neither API permission. Tokens are stored server-side; users can disconnect connections. Privacy: https://nextreport.in/privacy.

## Reply outline

Explain that the previous explanation/video omitted sufficient GA4 evidence; identify the separate identity, Ads and Analytics authorization flows; link the replacement video with timestamps; identify the review environment; confirm publishing remains In production and unverified scope demonstrations are isolated from ordinary production traffic. Do not state that review environments or features exist until they do.

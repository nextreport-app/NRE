# Google Search Console integration

## User workflow

Performance → **SEO (Search Console)** lists clients, linked sites first. An unconfigured client opens **Client settings → Connections for this client → Google Search Console**. Users connect the Google login that can access the site, load their accessible sites, select the exact Domain (`sc-domain:example.com`) or URL-prefix property, and save it. Unchanged sites do not need re-saving. The same section contains View SEO performance. Starting with no clients uses `/clients/new?task=search-console`; after creation it returns directly to site setup, rather than the Meta report wizard. Inside a selected client, its name/site is fixed; All search properties returns to the portfolio. Meta Ads, GA4 and SEO tabs preserve the client.

Account → Google Search Console manages the agency default. Each client can instead choose its own Google login. Connecting/replacing a client grant clears only that client's site/cache. Choosing Use agency login removes only its override and requires site selection again. Replacing/disconnecting the agency default clears inherited site assignments/cache and preserves client-specific grants. This never disconnects GA4, Google Ads or Drive. Local disconnection removes saved credentials; it does not revoke other integrations' Google grants.

The dashboard contains current/previous clicks, impressions, average CTR and average position; daily charts; top 20 queries/pages; top 10 country codes; device breakdown. Data is for Google **Web Search**, not Discover, Google News or all search types. Tables are current-period top rows, not exhaustive exports. Google anonymizes some queries; query/page rows cannot be assumed to sum to headline totals. Search clicks differ from GA4 sessions, CTR is Google's rate and average position is not a single fixed ranking. Lower position is better. Zero-impression periods have unavailable CTR/position rather than invented zero rank. Successful empty responses are shown as empty, separately from request failures.

Default Last 30 days ends three Pacific calendar days before today to allow normal reporting delay. Final-data requests use `America/Los_Angeles` date windows and the preceding equal-length period. Custom ranges support 1–90 days within the last 16 months, including the preceding period. Final data can still omit days; charts leave gaps rather than inventing zeros. No realtime or live indexing claims are made.

## Deployment setup required before live acceptance

1. Deploy migration `20261125170000_search_console` with the generated Prisma client. The normal production build runs `prisma migrate deploy`. This adds three User fields, Client.gscSiteUrl and a cascading SearchConsoleSnapshot table. No existing client assignments or grants are migrated or overwritten.
2. In the Google Cloud project owning the chosen OAuth Web client, enable **Google Search Console API** (`searchconsole.googleapis.com`). Listing sites alone is not enough to validate reporting.
3. Register the exact authorized redirect URI: `https://nextreport.in/api/gsc/callback` for production, and the appropriate HTTPS host for review/staging. No wildcard callbacks. Configure the authorized application domains and existing privacy policy URL.
4. Set both `GSC_CLIENT_ID` and `GSC_CLIENT_SECRET` in the deployment environment. If both are absent, the code can reuse the complete GA4 OAuth client pair, then the complete Google Ads pair. It never mixes an ID from one pair with a secret from another. Reusing a client configuration does not reuse its GA4/Ads refresh token or change their requested scopes.
5. Add `https://www.googleapis.com/auth/webmasters.readonly`, `openid`, and `email` to the appropriate Google Auth Platform consent configuration. Complete Google's applicable data-access verification/testing-user requirements before broad customer use. The NextReport login flow does not request Search Console access. Do not claim existing Google verification automatically covers this new scope.
6. Keep the existing token encryption key configuration stable (`META_TOKEN_ENCRYPTION_KEY`/supported AUTH_SECRET keys). Both agency refresh grants and client overrides are encrypted at rest using authenticated encryption. Do not put client secrets or tokens in NEXT_PUBLIC variables. Tokens are never included in dashboard responses.
7. On the deployed review environment, connect an authorized Google test identity, list sites, choose the correct client property, and refresh both 7/30-day and custom ranges. Compare the exact Web Search/Pacific dates with Google Search Console. Test a second client under another Google identity, expired/denied access, removing a site and disconnecting the agency grant. Verify unrelated GA4/Drive/Meta and client-specific connections stay intact.

Google Cloud/consent configuration and live Google permissions cannot be completed by merging source code alone. No live OAuth grants, production migrations or real site reports are created during mocked verification.

## Persistence, privacy and safety

Only authenticated owners can read clients, site options, saved snapshots or refresh data. Selecting a site verifies membership against Google's accessible site list (excluding unverified access). Background/async writes match the same owner, site and exact credential row/token; a concurrent connection/site replacement cannot publish results under the new assignment. Domain identifiers and URL prefixes are encoded on a fixed Google API host; user values never become fetch destinations.

Only read-only Search Console scope is requested. This integration does not verify sites, submit sitemaps, change settings, request indexing, publish reports, send emails or share queries with an AI service. Search query/page caches stay private. Changing/unlinking a site or its applicable connection deletes those caches; client/account deletion cascades. Old snapshots are retained visibly on refresh failure and hidden after credential/site replacement.

Each client holds at most three cache slots (7, 30 and the latest custom window), bounded top rows and a five-minute refresh cooldown. A lease prevents concurrent refresh work; requests are batched at most three at once, with timeouts. GET reads cache only and never calls Google. Fresh snapshots are bound to their site's current grant. HTTP errors return safe diagnostics, including disabled API, expired authorization, access denied and quota, without exposing raw Google error bodies or credentials.

## Verification

Unit/route tests cover scope/PKCE/state/owner binding, encrypted agency/client persistence, credential mismatch, site verification, inherited/scoped reset behavior, Pacific dates, data lag, equal comparisons, range limits, successful empty data, unavailable ranks, fixed API hosts, query privacy-safe errors, cache/grant isolation, bounded concurrency, cooldown and stale writers.

Mocked Chromium flows exercise portfolio → client Connections → site load/save → SEO → refresh → tables/chart → portfolio in desktop/mobile and dark/light layouts. Real Google consent, enabled Cloud APIs and live data parity remain deployment acceptance steps, not claims made by those mocks.

Rollback after users connect Search Console requires keeping the schema/credential-aware code or explicitly disabling this new feature first. Do not drop the encrypted credential or snapshot columns without a planned retention/deletion migration.

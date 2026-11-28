# Client-specific provider logins

Each unconfigured client starts GA4 and Search Console setup independently. Connect the Google login with access to that client’s property/site from **My Clients → Client settings → Connections for this client**. This does not change the NextReport sign-in or another client's credentials.

Supported connection scopes: GA4, Search Console, Meta Ads, Google Drive, Google Ads and TikTok Ads. Existing platform launch/reporting and TikTok regional restrictions remain in place. Connecting a provider does not enable an unsupported report type.

## Workflow

- Existing User provider fields remain agency defaults for account-level tools and other provider flows. GA4/Search Console do not inherit them for an unconfigured client: its effective token, email and enabled status are cleared until it completes client-scoped OAuth. Existing clients with a saved GA4 property or Search Console site can keep using their original agency grant, so this update does not break established links. No data migration is required.
- A client starts OAuth with `clientId`. The provider uses its own consent/account chooser (Google requests `consent select_account`). For Meta, switch the active Meta profile on Meta if its dialog shows the wrong profile; do not sign out of NextReport.
- OAuth state is paired with encrypted, HttpOnly owner/client scope. Callbacks validate the initiating owner and state before exchanging a code. Missing or mismatched context cannot fall back to writing agency credentials.
- Successful consent returns to the client's settings (or the existing safe Meta wizard return), displays status, and stores an encrypted client override.
- Choose different login changes only the selected client/provider. For GA4/Search Console, “Disconnect login” removes the client login and resource link; it does not fall back to a shared login. Other providers retain the explicit “Use agency login” action. It does not revoke grants which another client might use.
- Changing a client Meta/GA4/Drive login clears its saved ad account/property/folder so the user explicitly chooses an asset accessible to that identity. GA4 caches are cleared. Existing monitoring/email preferences are preserved.
- GA4 property selection shows the connected email. Account/property pickers, imports, live comparisons, budget monitoring, scheduled preparation, website reports and Drive exports resolve client overrides before applicable agency defaults. Client-scoped property/site-listing APIs enforce the same GA4/Search Console onboarding rule as the settings UI.
- A corrupt override is treated as disconnected; a revoked grant prompts reconnection on use. Neither silently inherits another identity's token. Token refreshes target their originating row and reject concurrent replacement. GA4 cached reads are keyed to the selected refresh grant. Live GA4 writes additionally match the credential row; Meta monitoring writes match the resolved scope.
- Meta data-deletion callbacks clear both agency and matching client grants. Client deletion cascades to its connection rows.

## Storage and deployment

`20261124220000_client_provider_connections` adds Client.hasProviderConnections (default false) and ClientProviderConnection, unique per client/provider. Credentials are encrypted using the existing AES-GCM token protection/key rotation support. The separate table prevents token blobs from entering ClientForm or client-list props. Only safe identity/status summaries reach the browser.

No existing client assignment or agency credential is migrated or overwritten. No production migration or live provider authorization is executed during implementation. The migration must deploy with the new Prisma client before client-specific connections can be used. Once clients use overrides, rolling back to code which does not understand them would use agency defaults; avoid such a rollback without a connection-aware transition.

## Verification

API/service suites cover existing agency behavior, scoped OAuth for supported providers, owner/state mismatch, encrypted storage, explicit override removal, property verification, cache isolation, background services and concurrent token replacement. Mocked browser checks exercise scoped connection links, identity labels, property load/save, explicit agency fallback and desktop/mobile layouts. Real consent screens and provider permissions still require testing with authorized test identities after deployment; automated validation makes no real provider calls or email sends.

## Client settings layout

Provider logins and GA4 property selection live together in Connections for this client. Slack and Zapier/Make settings are editable in the same section, explicitly marked agency-wide because they affect all clients. Optional provider help and automation controls are collapsed to keep the page compact. Client tasks are launched from My Clients. Task pages no longer repeat a cross-task toolbar; report scheduling returns to My Clients, while provider/property setup links remain beside the controls that need them.


## Weekly review screen and help spacing

Weekly dates are chosen and any long-range confirmation completed on Import. Review & generate keeps the read-only Report includes summary; it has no duplicate weekly date editor or Change dates button. An exceptional invalid/unconfirmed selection points back to Import. Campaign, metrics and final report help sit apart from the primary actions with explicit spacing.

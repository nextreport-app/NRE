# Client-specific provider logins

An agency can use one login for many clients when that identity has access to their assets. When a client's assets belong to another login, connect that identity from **My Clients → Manage client → Connections for this client**. This does not change the NextReport sign-in or another client's credentials.

Supported connection scopes: GA4, Meta Ads, Google Drive, Google Ads and TikTok Ads. Existing platform launch/reporting and TikTok regional restrictions remain in place. Connecting a provider does not enable an unsupported report type.

## Workflow

- Existing User provider fields remain agency defaults. Account settings clearly describe this scope.
- A client starts OAuth with `clientId`. The provider uses its own consent/account chooser (Google requests `consent select_account`). For Meta, switch the active Meta profile on Meta if its dialog shows the wrong profile; do not sign out of NextReport.
- OAuth state is paired with encrypted, HttpOnly owner/client scope. Callbacks validate the initiating owner and state before exchanging a code. Missing or mismatched context cannot fall back to writing agency credentials.
- Successful consent returns to the client's settings (or the existing safe Meta wizard return), displays status, and stores an encrypted client override.
- Connect a different login changes only the selected client/provider. “Use agency connection” explicitly removes that override. It does not revoke grants which another client might use.
- Changing a client Meta/GA4/Drive login clears its saved ad account/property/folder so the user explicitly chooses an asset accessible to that identity. GA4 caches are cleared. Existing monitoring/email preferences are preserved.
- GA4 property selection shows the connected email. Account/property pickers, imports, live comparisons, budget monitoring, scheduled preparation, website reports and Drive exports resolve client overrides before agency defaults.
- A corrupt override is treated as disconnected; a revoked grant prompts reconnection on use. Neither silently inherits another identity's token. Token refreshes target their originating row and reject concurrent replacement. GA4 cached reads are keyed to the selected refresh grant. Live GA4 writes additionally match the credential row; Meta monitoring writes match the resolved scope.
- Meta data-deletion callbacks clear both agency and matching client grants. Client deletion cascades to its connection rows.

## Storage and deployment

`20261124220000_client_provider_connections` adds Client.hasProviderConnections (default false) and ClientProviderConnection, unique per client/provider. Credentials are encrypted using the existing AES-GCM token protection/key rotation support. The separate table prevents token blobs from entering ClientForm or client-list props. Only safe identity/status summaries reach the browser.

No existing client assignment or agency credential is migrated or overwritten. No production migration or live provider authorization is executed during implementation. The migration must deploy with the new Prisma client before client-specific connections can be used. Once clients use overrides, rolling back to code which does not understand them would use agency defaults; avoid such a rollback without a connection-aware transition.

## Verification

API/service suites cover existing agency behavior, scoped OAuth for all five providers, owner/state mismatch, encrypted storage, explicit override removal, property verification, cache isolation, background services and concurrent token replacement. Mocked browser checks exercise scoped connection links, identity labels, property load/save, explicit agency fallback and desktop/mobile layouts. Real consent screens and provider permissions still require testing with authorized test identities after deployment; automated validation makes no real provider calls or email sends.

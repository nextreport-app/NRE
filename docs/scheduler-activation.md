# Scheduler activation in plain English

The scheduler and production acceptance workflow are built. Activation is a one-time configuration step; acceptance is checking them with real accounts, not another feature to implement.

The connected GitHub integration can edit code but cannot read/write Actions variables and secret metadata (HTTP 403), even though repository ownership is admin. Selecting the repository again or adding a collaborator does not expand permissions that the GitHub App does not request. No GitHub password or personal access token is needed for the following owner-operated setup.

1. Merge the dedicated scheduler-key fix and wait for successful deployment.
2. Generate a new long random secret (32+ characters), preferably with your password manager. Keep it private. It is not your GitHub, Google or Meta password. Use the identical value in the next two places; never send it in chat.
3. Open Vercel → the NextReport/NRE project → Settings → Environment Variables. For **Production**, add `REPORT_SCHEDULER_CRON_SECRET` with the new private value, and set `REPORT_SCHEDULER_ENABLED` to `true`. Leave the existing `CRON_SECRET` unchanged. Redeploy the latest Production deployment from Deployments so the new settings take effect.
4. Open https://github.com/nextreport-app/NRE/settings/secrets/actions → New repository secret. Name: `REPORT_SCHEDULER_CRON_SECRET`. Secret: the same new private value. Click Add secret. Do not add it under Variables.
5. Open https://github.com/nextreport-app/NRE/settings/variables/actions → New repository variable. Name: `NEXTREPORT_SCHEDULER_RUNNER_ENABLED`. Value: `true`. Click Add variable.
6. Open https://github.com/nextreport-app/NRE/actions/workflows/report-scheduler.yml → Run workflow → choose `main` → Run workflow. The tick job should run, not be skipped. A green result means the timer reached the app and completed a tick. It does not mean every report or email has been accepted.
7. In NextReport, open Express Text → Scheduled reports. The scheduler warning should clear after a successful tick. Keep client schedules paused until the first owner-controlled test is ready. Check at least two consecutive scheduled runs before relying on recurring preparation.
8. For the first scheduled test, use your own email address. Enable one schedule, review the prepared draft in Reports, approve it, then explicitly send it to yourself. Saving or enabling a schedule does not send a client report automatically. Do not use real client recipients during acceptance.

The NRE repository was confirmed public on November 23, 2026. Standard GitHub-hosted Ubuntu runners for public repositories normally do not consume paid private-repository Actions minutes; check the current account policy before opting in. If the repository becomes private, revisit the runner-usage warning in phase-two-completion.md. GitHub scheduled runs are best-effort and may be delayed.

For troubleshooting: a skipped job usually means the repository variable is missing/not `true`; an HTTP 401 usually means the two secret values differ or Production has not been redeployed; HTTP 503 means app activation/authentication is missing or another worker error needs inspection. Share only the workflow run link or a sanitized error message—never secret values. Existing schedules, provider limits and all other cron keys remain unchanged by this setup.

Full production acceptance still includes Meta/GA4 numeric parity, PPTX/browser/Slides review and owner-controlled email delivery as listed in phase-two-completion.md. Creative reporting remains Beta/on hold.

# Phase 2 pre-demo workflow audit — 2026-11-23

## Scope and evidence

This pass checks navigation, state transitions and provider-independent behavior. It does not replace live Meta/GA4 data reconciliation, actual provider email delivery, native PowerPoint/Google Slides acceptance, or an observed automatic timer occurrence. No real client email or production data mutation was made during the browser checks.

| Workflow | Checked |
| --- | --- |
| My Clients / Reports → choose client → Schedule reports | Direct owner-scoped scheduling route, correct client, return paths, paused save, Prepare now, private draft and unlinked-account recovery |
| Meta Import → Campaigns → Metrics → Review & generate → Report ready | Schedule shortcut across all steps; existing unfinished-input guard; client settings in separate tab; source/period/selection and completion regression suites |
| Meta Overview | 30-account cached portfolio, filters, detailed signals, bounded due refresh, skipped disabled/custom monitors, visible refresh failures |
| GA4 Website overview | Cached window switching, explicit refresh, channel comparison, missing/stale/limited evidence, property/client isolation and setup links |
| Agency templates | Upload/check → sample review → approve → client assignment; no selection before approval; reset to built-in design; Account report-design and client Manage links |
| Report inbox | Client navigation, search and pagination, exact-digest approval, changed-content re-review, approval does not send, explicit send and ambiguous-delivery guards |
| Scheduled timezone | Account calendar, Chicago/India/London/Sydney conversions, local weekdays, DST gaps/folds and closed reporting dates |

Validation: 401 tests across 52 suites; TypeScript and scoped ESLint. Current UI components exercised with mocked APIs and production CSS at 1440px and 390px, without page overflow. Artifacts are in `/workspace/review-artifacts` under scheduling-navigation, portfolio, website-changes, agency-templates and report-inbox (local review evidence, not deployed product assets).

## Live gate still open

GitHub listed a successful manually dispatched scheduler run, but no `schedule` event during this audit. The application correctly exposes a stale heartbeat and disables activation when unhealthy. A paused schedule is not expected to run, and scheduled preparation is not a client send. Use manual Prepare now for the demo, then observe recurring ticks and an owner-controlled draft/approval/send before calling automatic scheduling production-accepted. Do not remove the health guard or claim exact email delivery at the preparation time.

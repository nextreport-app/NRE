# Client report reminders

Each client can have one reminder, separate from report-draft scheduling. Configure it from **Set report reminder** on the client card in My Clients. `/dashboard` already redirects to My Clients, where the reminder panel shows approaching, due-today and overdue items.

The setup offers Every 7 days, Every 2 weeks and Once a month. The shared calendar selects the first reminder; monthly alarms select a day of the month. Time uses 24-hour hour/minute controls. Dashboard advance notice offers the reminder date or 1–3 days before. Existing custom/one-time/legacy-monthly reminders keep running until explicitly replaced by saving the form; the form explains this. Existing 7/14-day advance notices become 3 days only on save, with a notice. Saving activates the alarm; there is one optional email checkbox. Time zone and advance dashboard notice live under More options. Existing reminders can be paused/resumed below the form. A verified active account is required for email delivery. No email/report is automatically sent to the client by this feature.

Confirmed direct report-email sends and approved scheduled deliveries update the actual last-sent timestamp. Generation, download, copied links and mailto/WhatsApp share clicks do not prove delivery. Use **Mark as sent** for those external sends. Intervals start from the confirmed sent date. New fixed monthly reminders keep the selected day even when a report is sent late, clamping to the last day of shorter months. One-time reminders turn off after a confirmed/manual send. Legacy monthly-after-sending reminders retain their old behavior until changed. Repeated acknowledgements on the same local day do not advance a second cycle.

The existing hourly monitoring runner now calls `/api/cron/report-reminders` using the existing `CRON_SECRET` / GitHub `MONITORING_CRON_SECRET`. Keep `NEXTREPORT_MONITORING_RUNNER_ENABLED=true`. No additional secret or provider connection is needed. Job timing is approximate; GitHub schedule delays or a large queue can delay notifications.

Email is optional and opt-in. At most one approaching, one due and one overdue notification is queued per cycle. The durable email queue uses stable cycle/stage idempotency keys, retries delivery, and revalidates owner, recipient, verification, subscription, enabled preference and current due stage before sending. Pausing, changing settings or completing the cycle invalidates stale pending messages. Reporting delivery acceptance means provider acceptance, not proof that the recipient read the email.

## Deployment

Includes additive migration `20261127110000_report_reminders` and constraint expansion `20261127190000_reminder_alarm_modes` for fixed-monthly and one-time alarms. The repository's existing build command runs `prisma migrate deploy` before Next builds; the target environment must apply this migration before serving the new code. Never run that command locally against an unknown/prod database just to test the UI. No migration was applied to a live database during implementation.

Last-sent history begins with newly confirmed sends or manual acknowledgements. Old generation timestamps are not backfilled as sends. Legacy client cards continue displaying their generation activity separately as **Last generated**.

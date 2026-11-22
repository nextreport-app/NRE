import { pathToFileURL } from 'node:url';

/** Fixed destination: never forward the production cron secret to a configurable URL or redirect. */
export async function runSchedulerTick({ secret, fetchImpl = globalThis.fetch, log = console.log }) {
  if (!secret?.trim()) throw new Error('Set the private REPORT_SCHEDULER_CRON_SECRET repository secret before enabling this runner.');
  let response;
  try {
    response = await fetchImpl('https://nextreport.in/api/cron/report-schedules', {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(330000),
      headers: { Authorization: `Bearer ${secret.trim()}` },
    });
  } catch { throw new Error('Scheduler request failed or timed out. Check the app deployment and hosting logs; no response body was logged.'); }
  if (!response.ok) throw new Error(`Scheduler returned HTTP ${response.status}. Check app activation, matching secrets and hosting logs.`);
  let body;
  try { body = await response.json(); } catch { throw new Error('Scheduler returned an invalid response. Check the app deployment.'); }
  if (body?.ok !== true || !['enqueued', 'processed', 'remaining'].every(key => Number.isSafeInteger(body[key]) && body[key] >= 0))
    throw new Error('Scheduler did not confirm a successful tick. Check the app deployment.');
  // Only whitelisted numeric counters are logged, never secrets, payloads or provider error bodies.
  const counters = { enqueued: body.enqueued, processed: body.processed, remaining: body.remaining };
  if (body.emailRetries && ['checked', 'accepted', 'failed'].every(key => Number.isSafeInteger(body.emailRetries[key]) && body.emailRetries[key] >= 0))
    counters.emailRetries = { checked: body.emailRetries.checked, accepted: body.emailRetries.accepted, failed: body.emailRetries.failed };
  log(JSON.stringify(counters));
  if (counters.remaining > 0) log('::warning::Draft work remains queued. Check the backlog and worker capacity.');
  if (counters.emailRetries?.failed > 0) log('::warning::Some email intents remain pending or need review. Check app and provider configuration.');
  if (body.emailRetries?.skipped === true) log('::warning::Email recovery was deferred by this tick time budget.');
  return counters;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSchedulerTick({ secret: process.env.REPORT_SCHEDULER_CRON_SECRET }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

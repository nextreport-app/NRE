import { pathToFileURL } from 'node:url';

const endpoints = ['budget-monitor', 'performance-monitor', 'monitor-alert-retries'];
/** Fixed destinations and no redirects: never disclose secrets or provider response bodies. */
export async function runMonitoringAlerts({ secret, fetchImpl = globalThis.fetch, log = console.log }) {
  if (!secret?.trim()) throw Error('Set MONITORING_CRON_SECRET to the deployed app CRON_SECRET before enabling the monitoring runner.');
  const failed = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetchImpl(`https://nextreport.in/api/cron/${endpoint}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(330000),
        headers: { Authorization: `Bearer ${secret.trim()}` },
      });
      if (!response.ok) throw Error('Request did not complete successfully.');
      const body = await response.json();
      if (!['checked', 'failed'].every(key => Number.isSafeInteger(body[key]) && body[key] >= 0)) throw Error('Invalid counters.');
      const counters = Object.fromEntries(['checked', 'failed', 'skipped', 'remaining', 'accepted'].filter(key => Number.isSafeInteger(body[key]) && body[key] >= 0).map(key => [key, body[key]]));
      log(JSON.stringify({ endpoint, ...counters }));
      if (body.failed > 0) failed.push(endpoint);
      if (body.remaining > 0) log('::warning::Monitoring work remains queued; increase runner frequency or capacity to drain the backlog.');
    } catch { failed.push(endpoint); }
  }
  if (failed.length) throw Error(`Monitoring needs attention: ${[...new Set(failed)].join(', ')}. Check deployment, matching secrets and provider configuration. Response bodies were not logged.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMonitoringAlerts({ secret: process.env.MONITORING_CRON_SECRET }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

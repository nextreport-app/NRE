import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonitoringAlerts } from './run-monitoring-alerts.mjs';
test('fails before contacting production when secret is absent', async () => {
  await assert.rejects(runMonitoringAlerts({ secret:'', fetchImpl:()=>assert.fail('no requests') }), /Set MONITORING/);
});
test('uses fixed destinations, bearer headers and no redirects; logs only counters', async () => {
  const calls=[], logs=[];
  await runMonitoringAlerts({ secret:'test-secret', fetchImpl:async(url,init)=>{calls.push([url,init]);return Response.json({checked:1,failed:0,accepted:1,private:'never log me'});},log:s=>logs.push(s) });
  assert.equal(calls.length,3);
  for(const[url,init]of calls){assert.ok(url.startsWith('https://nextreport.in/api/cron/'));assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer test-secret');}
  assert.ok(!logs.join('').includes('never log me'));assert.ok(!logs.join('').includes('test-secret'));
});
test('still attempts performance and delivery retries when budget check fails', async () => {
  let calls=0;const logs=[];
  await assert.rejects(runMonitoringAlerts({secret:'secret',fetchImpl:async()=>{calls++;return calls===1?new Response('private upstream detail',{status:503}):Response.json({checked:1,failed:0});},log:s=>logs.push(s)}), /budget-monitor/);
  assert.equal(calls,3);assert.ok(!logs.join('').includes('private upstream detail'));
});

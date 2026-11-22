import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSchedulerTick } from './run-report-scheduler.mjs';
const secret='private-test-secret';
test('uses a fixed HTTPS destination, private header, no redirects and logs only counters',async()=>{
 const logs=[];let request;
 const result=await runSchedulerTick({secret,log:value=>logs.push(value),fetchImpl:async(url,options)=>{request={url,options};return new Response(JSON.stringify({ok:true,enqueued:2,processed:1,remaining:1,emailRetries:{checked:1,accepted:1,failed:0},secret,payload:'private mail'}));}});
 assert.equal(request.url,'https://nextreport.in/api/cron/report-schedules');assert.equal(request.options.headers.Authorization,`Bearer ${secret}`);assert.equal(request.options.redirect,'error');assert.ok(request.options.signal);assert.equal(result.enqueued,2);assert.equal(logs.join('').includes(secret),false);assert.equal(logs.join('').includes('private mail'),false);
});
test('does not make a request without a private secret',async()=>{let called=false;await assert.rejects(runSchedulerTick({secret:'',fetchImpl:async()=>{called=true;}}),/repository secret/);assert.equal(called,false);});
test('sanitizes thrown network errors instead of logging possible header details',async()=>{await assert.rejects(runSchedulerTick({secret,fetchImpl:async()=>{throw Error(secret);}}),error=>!error.message.includes(secret)&&error.message.includes('failed or timed out'));});
test('does not expose provider error bodies',async()=>{await assert.rejects(runSchedulerTick({secret,fetchImpl:async()=>new Response(secret,{status:503})}),error=>!error.message.includes(secret)&&error.message.includes('HTTP 503'));});
test('rejects HTML/interstitial responses',async()=>{await assert.rejects(runSchedulerTick({secret,fetchImpl:async()=>new Response('<html>not the API</html>')}),/invalid response/);});
test('rejects unsuccessful or invalid tick counters',async()=>{for(const body of [{ok:false,enqueued:1,processed:1,remaining:0},{ok:true,enqueued:-1,processed:1,remaining:0},{ok:true,enqueued:1,processed:'one',remaining:0}])await assert.rejects(runSchedulerTick({secret,fetchImpl:async()=>new Response(JSON.stringify(body))}),/did not confirm/);});
test('surfaces backlog and failed recovery without claiming inbox delivery',async()=>{const logs=[];await runSchedulerTick({secret,log:line=>logs.push(line),fetchImpl:async()=>new Response(JSON.stringify({ok:true,enqueued:0,processed:0,remaining:2,emailRetries:{checked:2,accepted:0,failed:2}}))});assert.ok(logs.some(line=>line.includes('Draft work remains queued')));assert.ok(logs.some(line=>line.includes('email intents remain pending')));});

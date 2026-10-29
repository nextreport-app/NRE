import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
test('Guardian intake deduplicates and redacts production signals while only queuing trusted regressions',()=>{
 const temp=mkdtempSync(join(tmpdir(),'nextreport-intake-test-'));
 try{
  const preload=join(temp,'fetch.mjs'),output=join(temp,'posts.json');
  writeFileSync(preload,`import {writeFileSync} from 'node:fs';
const posts=[];globalThis.fetch=async(input,options={})=>{
const url=new URL(String(input));
if(url.hostname==='api.github.com'){
 if(url.pathname.endsWith('/labels'))return new Response('{}',{status:201});
 if(url.pathname.endsWith('/issues')&&options.method==='POST'){posts.push(JSON.parse(options.body));writeFileSync(process.env.TEST_POSTS,JSON.stringify(posts));return new Response('{}',{status:201})}
 if(url.pathname.endsWith('/issues'))return new Response(JSON.stringify([{body:'<!-- nextreport-incident:cexistingincident123456789 -->'}]));
}
if(url.hostname==='nextreport.in'){
 if(options.redirect!=='error')throw Error('Feed redirects must not forward the credential');
 return new Response(JSON.stringify({incidents:[{id:'cexistingincident123456789',kind:'CSV_MISMATCH',platform:'META',reportType:'WEEKLY',signalCodes:['CPC']},{id:'cnewincidentreference12345',kind:'CSV_MISMATCH',platform:'META',reportType:'MONTHLY',signalCodes:['CPC','private-name'],userId:'private-user',message:'private-message',csvDisplay:'$12345'}],nextCursor:null}));
}
throw Error('Unexpected network destination')};`);
  const run=spawnSync(process.execPath,['--import',preload,resolve('scripts/agents/guardian-intake.mjs')],{encoding:'utf8',timeout:10000,env:{...process.env,TEST_POSTS:output,GITHUB_REPOSITORY:'synthetic/repository',GH_TOKEN:'synthetic-token',QUALITY_AGENT_READ_TOKEN:'synthetic-feed-token',GUARDIAN_CHECKS_FAILED:'true',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123'}});
  assert.equal(run.status,0,run.stderr);
  const posts=JSON.parse(readFileSync(output,'utf8'));assert.equal(posts.length,2);
  assert.ok(posts.find(p=>p.title.includes('Reporting regression')).labels.includes('agent:repair-ready'));
  const incident=posts.find(p=>p.title.includes('CSV_MISMATCH'));assert.deepEqual(incident.labels,['agent:quality','agent:needs-reproduction']);
  for(const secret of ['private-name','private-user','private-message','$12345'])assert.ok(!JSON.stringify(posts).includes(secret));
 }finally{rmSync(temp,{recursive:true,force:true})}
});

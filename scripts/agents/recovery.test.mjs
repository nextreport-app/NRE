import {test} from 'node:test';import assert from 'node:assert/strict';
import {eligibleAutomaticInvestigation,issueForIncident} from './policy.mjs';
const row={id:'cincidentreference123456789',kind:'CSV_MISMATCH',state:'QUEUED',platform:'META',reportType:'WEEKLY',signalCodes:['CPC'],diagnosticProfile:{version:1,rowCount:30,signalCount:1,missingReportValues:true,missingCsvValues:false,reportDisplay:'PRIVATE_VALUE',csvDisplay:'PRIVATE_CSV'}};
test('production mismatches can enter investigation without a customer ticket or manual label',()=>{assert.equal(eligibleAutomaticInvestigation(row),true);const issue=issueForIncident(row);assert.match(issue.body,/A report value is missing/);assert.ok(!issue.body.includes('PRIVATE_'))});
test('verified, in-progress, unsupported and evidence-free cases cannot be automatically requeued',()=>{for(const patch of [{state:'VERIFIED'},{state:'INVESTIGATING'},{platform:'GOOGLE'},{diagnosticProfile:null},{diagnosticProfile:{...row.diagnosticProfile,rowCount:0}}])assert.equal(eligibleAutomaticInvestigation({...row,...patch}),false)});
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
test('deployment monitor requires both a merged fix and production ancestry before offering a retry',()=>{
 for(const scenario of ['preview','behind','ahead']){
  const dir=mkdtempSync(join(tmpdir(),'nextreport-deployment-proof-'));
  try{
   const preload=join(dir,'fetch.mjs'),output=join(dir,'posts.json');writeFileSync(output,'[]');
   writeFileSync(preload,`import {writeFileSync} from 'node:fs';
const scenario=process.env.SCENARIO;globalThis.fetch=async(input,options={})=>{
 const url=new URL(String(input));let data;
 if(url.hostname==='nextreport.in'){
  if(url.pathname.endsWith('quality-incidents'))data={incidents:[{id:'cincidentreference123456789',state:'FIX_PROPOSED',fixPrNumber:123}],nextCursor:null};
  else if(options.method==='POST'){writeFileSync(process.env.POSTS,JSON.stringify([JSON.parse(options.body)]));data={updated:true}}
  else data={production:scenario!=='preview',revision:'b'.repeat(40)};
 }else if(url.hostname==='api.github.com'){
  data=url.pathname.includes('/compare/')?{status:scenario}:{merged:true,merge_commit_sha:'a'.repeat(40)};
 }else throw Error('Unexpected external request');
 return new Response(JSON.stringify(data));};`);
   const result=spawnSync(process.execPath,['--import',preload,resolve('scripts/agents/recovery-deployment-sync.mjs')],{encoding:'utf8',timeout:10000,env:{...process.env,SCENARIO:scenario,POSTS:output,GH_TOKEN:'synthetic',GITHUB_REPOSITORY:'synthetic/repository',QUALITY_AGENT_READ_TOKEN:'synthetic-read',QUALITY_AGENT_WORKER_TOKEN:'synthetic-worker'}});
   assert.equal(result.status,0,result.stderr);const posts=JSON.parse(readFileSync(output,'utf8'));assert.equal(posts.length,scenario==='ahead'?1:0);if(posts.length)assert.equal(posts[0].revision,'b'.repeat(40));
  }finally{rmSync(dir,{recursive:true,force:true})}
 }
});

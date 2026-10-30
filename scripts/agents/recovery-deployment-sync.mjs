/** A merged PR is insufficient: confirm its commit is in the actual production revision. */
const repo=process.env.GITHUB_REPOSITORY,readToken=process.env.QUALITY_AGENT_READ_TOKEN,workerToken=process.env.QUALITY_AGENT_WORKER_TOKEN,gh=process.env.GH_TOKEN;
if(!readToken||!workerToken){console.log('Recovery deployment sync is not configured.');process.exit(0)}
if(!/^[\w.-]+\/[\w.-]+$/.test(repo??'')||!gh)throw new Error('Invalid repository context');
const origin=new URL(process.env.NEXTREPORT_APP_ORIGIN||'https://nextreport.in');if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new Error('HTTPS application origin required');
async function app(path,token,body){const response=await fetch(new URL(path,origin),{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Recovery service failed (${response.status})`);return response.json()}
async function github(path){const response=await fetch(`https://api.github.com/repos/${repo}/${path}`,{headers:{Authorization:`Bearer ${gh}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`GitHub verification failed (${response.status})`);return response.json()}
const production=await app('/api/internal/quality-recovery',workerToken);
if(!production.production||!/^[a-f\d]{40}$/.test(production.revision??'')){console.log('No verifiable production revision; no customer retry promises made.');process.exit(0)}
let cursor,checked=0;
for(let page=0;page<10;page++){
 const feed=await app('/api/internal/quality-incidents'+(cursor?'?cursor='+encodeURIComponent(cursor):''),readToken);
 for(const incident of feed.incidents??[]){
  if(incident.state!=='FIX_PROPOSED'||!Number.isSafeInteger(incident.fixPrNumber)||incident.fixPrNumber<1||!/^c[a-z0-9]{15,40}$/.test(incident.id))continue;
  if(++checked>10)break;
  const pr=await github(`pulls/${incident.fixPrNumber}`);if(!pr.merged||!/^[a-f\d]{40}$/.test(pr.merge_commit_sha??''))continue;
  const compare=await github(`compare/${pr.merge_commit_sha}...${production.revision}`);
  if(!['ahead','identical'].includes(compare.status))continue;
  await app('/api/internal/quality-recovery',workerToken,{action:'deployed',incidentId:incident.id,prNumber:incident.fixPrNumber,revision:production.revision});
 }
 if(!feed.nextCursor||checked>=10)break;
 if(!/^c[a-z0-9]{15,40}$/.test(feed.nextCursor)||feed.nextCursor===cursor)throw new Error('Invalid recovery cursor');cursor=feed.nextCursor;
}
console.log('Deployment sync completed; report correctness still requires a CSV recheck.');

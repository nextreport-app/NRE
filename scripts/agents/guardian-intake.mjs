import { issueForIncident, GUARDIAN_LABEL, eligibleAutomaticInvestigation } from './policy.mjs';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) throw new Error('Repository-scoped GitHub credentials required');
async function github(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
for (const [name,color] of [[GUARDIAN_LABEL,'1d76db'],['agent:needs-reproduction','fbca04'],['agent:repair-ready','0e8a16'],['agent:repair-running','5319e7'],['agent:needs-review','0052cc'],['agent:needs-attention','d93f0b']]) {
  try { await github('labels','POST',{name,color}); } catch { /* Existing label; subsequent operations still fail on genuine permission errors. */ }
}
const existing = [];
for (let page = 1; page <= 10; page++) {
  const batch = await github(`issues?state=all&labels=${GUARDIAN_LABEL}&per_page=100&page=${page}`);
  existing.push(...batch);
  if (batch.length < 100) break;
  if (page === 10) throw new Error('Issue history exceeds deduplication limit; operator must archive/adjust before resuming');
}
if (process.env.GUARDIAN_CHECKS_FAILED === 'true') {
  const sha = process.env.GITHUB_SHA;
  if (!/^[a-f\d]{40}$/.test(sha ?? '')) throw new Error('Invalid revision');
  const marker = `<!-- nextreport-regression:${sha} -->`;
  if (!existing.some(i => i.body?.includes(marker))) await github('issues','POST', {
    title: `[Quality Guardian] Reporting regression on ${sha.slice(0, 8)}`,
    body: `${marker}\nTrusted synthetic regression checks failed on the default branch. Reproduce locally before changing code.\n\nRun: https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}\n\nNo customer data was used. The repair workflow may attempt a synthetic reproduction; its output remains a draft PR.`,
    labels: [GUARDIAN_LABEL, 'agent:repair-ready'],
  });
}
const secret = process.env.QUALITY_AGENT_READ_TOKEN;
if (!secret) { console.log('Production incident intake is disabled; no feed credential supplied.'); process.exit(0); }
const origin = new URL(process.env.NEXTREPORT_APP_ORIGIN || 'https://nextreport.in');
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Use an HTTPS application origin only');
let created = 0, cursor;
for (let page = 0; page < 10 && created < 10; page++) {
 const url = new URL('/api/internal/quality-incidents',origin);
 if(cursor)url.searchParams.set('cursor',cursor);
 const response = await fetch(url,{headers:{Authorization:`Bearer ${secret}`},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Quality feed failed (${response.status})`);
 const {incidents,nextCursor}=await response.json();
 if(!Array.isArray(incidents)||incidents.length>100)throw new Error('Invalid feed');
 for(const incident of incidents){
  if(incident.state==='VERIFIED')continue;
  const issue=issueForIncident(incident);
  const previous=existing.find(i=>i.body?.includes(`<!-- nextreport-incident:${incident.id} -->`));
  const auto=process.env.AUTO_INVESTIGATE==='true'&&eligibleAutomaticInvestigation(incident);
  if(previous){
   if(auto&&previous.state==='open'&&!previous.labels?.some(l=>['agent:repair-ready','agent:repair-running','agent:needs-review','agent:needs-attention'].includes(typeof l==='string'?l:l.name))) {
    await github(`issues/${previous.number}`,'PATCH',{body:issue.body});
    await github(`issues/${previous.number}/labels`,'POST',{labels:['agent:repair-ready']});
   }
   continue;
  }
  if(created>=10)break;
  await github('issues','POST',{...issue,labels:[GUARDIAN_LABEL,auto?'agent:repair-ready':'agent:needs-reproduction']});created++;
 }
 if(!nextCursor)break;
 if(!/^c[a-z0-9]{15,40}$/.test(nextCursor)||nextCursor===cursor)throw new Error('Invalid feed cursor');
 cursor=nextCursor;
 if(page===9&&created<10)throw new Error('Feed exceeds intake page limit; operator intervention required');
}
console.log(`Intake completed: ${created} new redacted incidents; duplicate issues skipped.`);

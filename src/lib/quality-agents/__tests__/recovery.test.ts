import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('@/lib/prisma',()=>({prisma:{reportQualityIncident:{upsert:vi.fn(),updateMany:vi.fn(),findUnique:vi.fn(),findFirst:vi.fn()},reportRepairAttempt:{findUnique:vi.fn()},$transaction:vi.fn()}}));
import {prisma} from '@/lib/prisma';
import {recoveryContextKey,buildPrivateDiagnostics,safeDiagnosticProfile} from '../recovery-diagnostics';
import {captureCsvQualityIncident} from '../incidents';
import {reserveRepairAttempt,finishRepairAttempt,markProductionUpdate} from '../recovery-worker';
import {recoveryMessage} from '../recovery-policy';
import type {CsvVerificationResult} from '@/lib/nre/csv-report-reconciliation';
const ok:CsvVerificationResult={status:'ok',checks:[{metric:'CPC',scope:'Private client',status:'ok',csvDisplay:'$1',reportDisplay:'$1'}]};
const bad:CsvVerificationResult={status:'mismatch',checks:[{...ok.checks[0],status:'mismatch',reportDisplay:'—'}]};
const context={userId:'owner',clientId:'client',contextKey:'bound-source-and-settings',platform:'META',reportType:'WEEKLY',recheckIncidentId:'cincidentreference123456789'};
describe('recovery evidence and revalidation',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(prisma.reportQualityIncident.updateMany).mockResolvedValue({count:1});vi.mocked(prisma.reportQualityIncident.upsert).mockResolvedValue({id:context.recheckIncidentId} as never)});
 it('binds rechecks to source and calculation settings, but not retry flags',()=>{
  const form=new FormData();form.set('selectedCampaigns',JSON.stringify(['private']));form.set('dateSelection',JSON.stringify({mode:'custom',customStart:'2026-09-01',customEnd:'2026-09-30'}));
  const hash=recoveryContextKey('source',form);form.set('recoveryIncidentId','untrusted-case');expect(recoveryContextKey('source',form)).toBe(hash);
  form.set('dateSelection',JSON.stringify({customEnd:'2026-09-30',customStart:'2026-09-01',mode:'custom'}));expect(recoveryContextKey('source',form)).toBe(hash);
  form.set('csvAlignResults','true');expect(recoveryContextKey('source',form)).not.toBe(hash);expect(recoveryContextKey('different-source',form)).not.toBe(hash);
 });
 it('does not conflate currencies, timezones or a replaced previous-month source',()=>{
  const form=new FormData();form.set('dateSelection',JSON.stringify({mode:'custom',customStart:'2026-09-01',customEnd:'2026-09-30'}));form.set('includePreviousMonthComparison','true');
  const client={currency:'USD',previousMonthDataUrl:'private-source-1',previousMonthDataUpdatedAt:new Date('2026-10-01T00:00:00Z')};
  const hash=recoveryContextKey('file',form,'UTC',client);
  expect(recoveryContextKey('file',form,'UTC',{...client,currency:'EUR'})).not.toBe(hash);
  expect(recoveryContextKey('file',form,'Asia/Calcutta',client)).not.toBe(hash);
  expect(recoveryContextKey('file',form,'UTC',{...client,previousMonthDataUrl:'private-source-2'})).not.toBe(hash);
 });
 it('exports only controlled diagnostic shape, not private mismatch values or source headers',()=>{
  const diagnostics=buildPrivateDiagnostics([{campaign_name:'Private agency',_raw:{'private@example.test':'secret'}}],{spend:'Confidential source header'},bad);
  const profile=safeDiagnosticProfile(JSON.stringify({...diagnostics,token:'secret'}));expect(profile).toMatchObject({sourceColumns:['spend'],missingReportValues:true,rowCount:1});
  for(const privateValue of ['Private agency','private@example.test','Confidential source header','$1','token'])expect(JSON.stringify(profile)).not.toContain(privateValue);
 });
 it('only server-generated passing nonempty checks can verify the bound owner/client/context',async()=>{
  const result=structuredClone(ok);await captureCsvQualityIncident(context,result);
  expect(result.qualityIncidentId).toBe(context.recheckIncidentId);
  const where=vi.mocked(prisma.reportQualityIncident.updateMany).mock.calls[0][0].where;
  expect(where).toMatchObject({id:context.recheckIncidentId,userId:'owner',clientId:'client'});expect(where?.contextHash).toMatch(/^[a-f0-9]{64}$/);
 });
 it('does not resolve skipped/empty checks or unbound rechecks',async()=>{
  await captureCsvQualityIncident(context,{status:'skipped',checks:[]});await captureCsvQualityIncident(context,{status:'ok',checks:[]});await captureCsvQualityIncident({...context,clientId:undefined},structuredClone(ok));expect(prisma.reportQualityIncident.updateMany).not.toHaveBeenCalled();
 });
 it('a still-failing post-deployment recheck returns the case to review, not resolved',async()=>{
  await captureCsvQualityIncident(context,structuredClone(bad));expect(vi.mocked(prisma.reportQualityIncident.updateMany).mock.calls[0][0]).toMatchObject({where:{state:'READY_TO_RECHECK'},data:{state:'NEEDS_REVIEW'}});
 });
 it('copy distinguishes a proposed fix, deployed update and actual revalidation',()=>{
  expect(recoveryMessage('FIX_PROPOSED').detail).toContain('not confirmed live');expect(recoveryMessage('READY_TO_RECHECK').detail).toContain('Rebuild');expect(recoveryMessage('VERIFIED').detail).toContain('listed CSV checks');expect(recoveryMessage('INVESTIGATING',true).title).toContain('pending');
 });
});
describe('worker safety gates',()=>{
 afterEach(()=>vi.unstubAllEnvs());beforeEach(()=>vi.clearAllMocks());
 it('reserves idempotently without a second allowance hit',async()=>{
  const tx={reportRepairAttempt:{findUnique:vi.fn().mockResolvedValue({issueNumber:12,incidentId:null})},$executeRaw:vi.fn(),$queryRaw:vi.fn()};vi.mocked(prisma.$transaction).mockImplementation(async callback=>(callback as unknown as (tx:unknown)=>Promise<unknown>)(tx) as never);
  expect(await reserveRepairAttempt({runId:'1',runAttempt:1,issueNumber:12})).toMatchObject({duplicate:true});expect(tx.$queryRaw).not.toHaveBeenCalled();
 });
 it('stops at the daily allowance before creating an attempt or calling a model',async()=>{
  const tx={reportRepairAttempt:{findUnique:vi.fn().mockResolvedValue(null),create:vi.fn()},$executeRaw:vi.fn(),$queryRaw:vi.fn().mockResolvedValue([{hits:2}])};vi.mocked(prisma.$transaction).mockImplementation(async callback=>(callback as unknown as (tx:unknown)=>Promise<unknown>)(tx) as never);
  await expect(reserveRepairAttempt({runId:'2',runAttempt:1,issueNumber:12})).rejects.toMatchObject({status:429});expect(tx.reportRepairAttempt.create).not.toHaveBeenCalled();
 });
 it('requires a known run and PR before claiming a candidate exists',async()=>{
  vi.mocked(prisma.reportRepairAttempt.findUnique).mockResolvedValue(null);await expect(finishRepairAttempt({runId:'1',runAttempt:1,state:'FIX_PROPOSED',prNumber:3})).rejects.toMatchObject({status:404});
  vi.mocked(prisma.reportRepairAttempt.findUnique).mockResolvedValue({incidentId:'case'} as never);await expect(finishRepairAttempt({runId:'1',runAttempt:1,state:'FIX_PROPOSED'})).rejects.toMatchObject({status:400});
 });
 it('rejects a preview deployment or mismatched production revision',async()=>{
  vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('VERCEL_GIT_COMMIT_SHA','a'.repeat(40));await expect(markProductionUpdate({incidentId:'case',prNumber:3,revision:'a'.repeat(40)})).rejects.toMatchObject({status:409});
  vi.stubEnv('VERCEL_ENV','production');await expect(markProductionUpdate({incidentId:'case',prNumber:3,revision:'b'.repeat(40)})).rejects.toMatchObject({status:409});expect(prisma.reportQualityIncident.updateMany).not.toHaveBeenCalled();
 });
});

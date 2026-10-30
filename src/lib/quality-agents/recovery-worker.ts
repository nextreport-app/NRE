import {prisma} from '@/lib/prisma';
import {safeDiagnosticProfile} from './recovery-diagnostics';
export class RecoveryWorkerError extends Error{constructor(public status:number,message:string){super(message)}}
export async function reserveRepairAttempt(input:{runId:string;runAttempt:number;issueNumber:number;incidentId?:string}){
 const runKey=`${input.runId}:${input.runAttempt}`;
 const limit=Math.max(1,Math.min(3,Number(process.env.REPORT_REPAIR_DAILY_LIMIT)||1));
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${runKey}))`;
  const prior=await tx.reportRepairAttempt.findUnique({where:{runKey}});
  if(prior){if(prior.issueNumber!==input.issueNumber||prior.incidentId!==(input.incidentId??null))throw new RecoveryWorkerError(409,'Run already bound to another investigation');return{reserved:true,duplicate:true};}
  if(input.incidentId){const incident=await tx.reportQualityIncident.findUnique({where:{id:input.incidentId}});if(!incident||incident.state!=='QUEUED'||!safeDiagnosticProfile(incident.diagnosticsJson))throw new RecoveryWorkerError(409,'Investigation is not eligible');}
  const start=Math.floor(Date.now()/86400000)*86400000;
  const key=`report-repair-daily:${start}`;const expiresAt=new Date(start+86400000);
  const [bucket]=await tx.$queryRaw<{hits:number}[]>`INSERT INTO "UsageBucket" ("key","hits","expiresAt") VALUES (${key},1,${expiresAt}) ON CONFLICT ("key") DO UPDATE SET "hits"="UsageBucket"."hits"+1 RETURNING "hits"`;
  if(bucket.hits>limit)throw new RecoveryWorkerError(429,'Daily repair attempt allowance reached');
  if(input.incidentId){const claim=await tx.reportQualityIncident.updateMany({where:{id:input.incidentId,state:'QUEUED'},data:{state:'INVESTIGATING',stateUpdatedAt:new Date(),issueNumber:input.issueNumber}});if(claim.count!==1)throw new RecoveryWorkerError(409,'Investigation changed before claim');}
  await tx.reportRepairAttempt.create({data:{runKey,incidentId:input.incidentId,issueNumber:input.issueNumber}});
  return{reserved:true,duplicate:false};
 });
}
export async function finishRepairAttempt(input:{runId:string;runAttempt:number;state:'FIX_PROPOSED'|'NEEDS_REVIEW';prNumber?:number}){
 const attempt=await prisma.reportRepairAttempt.findUnique({where:{runKey:`${input.runId}:${input.runAttempt}`}});
 if(!attempt)throw new RecoveryWorkerError(404,'Unknown repair attempt');
 if(!attempt.incidentId)return{updated:false};
 if(input.state==='FIX_PROPOSED'&&!input.prNumber)throw new RecoveryWorkerError(400,'A candidate PR is required');
 const result=await prisma.reportQualityIncident.updateMany({where:{id:attempt.incidentId,state:'INVESTIGATING'},data:{state:input.state,stateUpdatedAt:new Date(),...(input.prNumber?{fixPrNumber:input.prNumber}:{})}});
 return{updated:result.count===1};
}
export async function markProductionUpdate(input:{incidentId:string;prNumber:number;revision:string}){
 const current=process.env.VERCEL_GIT_COMMIT_SHA;
 if(process.env.VERCEL_ENV!=='production'||!current||input.revision!==current)throw new RecoveryWorkerError(409,'Production revision has not been verified');
 const result=await prisma.reportQualityIncident.updateMany({where:{id:input.incidentId,state:'FIX_PROPOSED',fixPrNumber:input.prNumber},data:{state:'READY_TO_RECHECK',deployedRevision:current,stateUpdatedAt:new Date()}});
 return{updated:result.count===1};
}

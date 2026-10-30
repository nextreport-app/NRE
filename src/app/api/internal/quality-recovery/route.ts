import {NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {qualityAgentAuthorized} from '@/lib/quality-agents/incident-policy';
import {reserveRepairAttempt,finishRepairAttempt,markProductionUpdate,RecoveryWorkerError} from '@/lib/quality-agents/recovery-worker';
const id=z.string().regex(/^c[a-z0-9]{15,40}$/);const positive=z.number().int().positive().max(1_000_000_000);
const run={runId:z.string().regex(/^\d{1,20}$/),runAttempt:z.number().int().min(1).max(100)};
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('reserve'),...run,issueNumber:positive,incidentId:id.optional()}),
 z.object({action:z.literal('result'),...run,state:z.enum(['FIX_PROPOSED','NEEDS_REVIEW']),prNumber:positive.optional()}),
 z.object({action:z.literal('deployed'),incidentId:id,prNumber:positive,revision:z.string().regex(/^[a-f\d]{40}$/)}),
]);
function denied(request:Request){const secret=process.env.QUALITY_AGENT_WORKER_TOKEN;const headers={'Cache-Control':'private, no-store'};if(!secret||secret.length<32)return NextResponse.json({error:'Recovery worker is not configured'},{status:503,headers});if(!qualityAgentAuthorized(request,secret))return NextResponse.json({error:'Unauthorized'},{status:401,headers});return null;}
export async function GET(request:Request){const denial=denied(request);if(denial)return denial;const sha=process.env.VERCEL_GIT_COMMIT_SHA;return NextResponse.json({revision:sha&&/^[a-f\d]{40}$/.test(sha)?sha:null,production:process.env.VERCEL_ENV==='production'},{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(request:Request){
 const denial=denied(request);if(denial)return denial;
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Invalid recovery update'},{status:400});
 try{const value=parsed.data;const result=value.action==='reserve'?await reserveRepairAttempt(value):value.action==='result'?await finishRepairAttempt(value):await markProductionUpdate(value);return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}})}catch(error){
 if(error instanceof RecoveryWorkerError&&error.status===409&&parsed.data.action==='reserve'&&parsed.data.incidentId)await prisma.reportQualityIncident.updateMany({where:{id:parsed.data.incidentId,state:'QUEUED',diagnosticsJson:null},data:{state:'NEEDS_REVIEW',stateUpdatedAt:new Date()}}).catch(()=>undefined);
 return NextResponse.json({error:error instanceof RecoveryWorkerError?error.message:'Recovery service temporarily unavailable'},{status:error instanceof RecoveryWorkerError?error.status:503})}
}

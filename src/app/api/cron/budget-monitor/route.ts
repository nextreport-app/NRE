import { ServiceError } from "@/lib/service-error";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkClientBudget } from "@/lib/budget-monitor";
export const maxDuration=300;
/** Bounded oldest-first sweeper. Call regularly for intraday monitoring; no provider credentials in output. */
export async function GET(req:Request) {
  const secret=process.env.CRON_SECRET?.trim();
  if(!secret)return NextResponse.json({error:"CRON_SECRET is not configured"},{status:503});
  if(req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
  const started=Date.now();let checked=0,failed=0,skipped=0;
  const clients=await prisma.client.findMany({where:{budgetMonitorEnabled:true,monthlyBudget:{gt:0},metaAdAccountId:{not:null},
    AND:[{OR:[{budgetMonitorLastAttemptAt:null},{budgetMonitorLastAttemptAt:{lte:new Date(Date.now()-15*60000)}}]}]},
    orderBy:{budgetMonitorLastAttemptAt:{sort:"asc",nulls:"first"}},take:50,select:{id:true,userId:true}});
  // At most three account queries concurrently. Leases protect overlapping invocations.
  for(let offset=0;offset<clients.length && Date.now()-started<140000;offset+=3) {
    await Promise.all(clients.slice(offset,offset+3).map(async client=>{
      try {const snapshot=await checkClientBudget(client.id,client.userId);if(snapshot.error)failed++;}catch(error){if(error instanceof ServiceError && [403,404,429].includes(error.status))skipped++;else failed++;}finally{checked++;}
    }));
  }
  return NextResponse.json({ok:failed===0,checked,failed,skipped,remaining:Math.max(0,clients.length-checked)}, {status:failed?503:200});
  } catch(error){return apiErrorResponse(error,"cron:budget-monitor");}
}

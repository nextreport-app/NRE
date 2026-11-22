import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ServiceError } from "@/lib/service-error";
import { checkClientBudget } from "@/lib/budget-monitor";
import { readBudgetSnapshot, effectiveBudgetTolerance } from "@/lib/budget-monitor-facts";
export const maxDuration=180;
const input=z.discriminatedUnion("action",[
  z.object({action:z.literal("check")}),
  z.object({action:z.literal("settings"),enabled:z.boolean(),emailEnabled:z.boolean(),tolerance:z.number().finite().min(0).max(1e12).optional()}),
]);
async function owned(id:string,userId:string) {
  const client=await prisma.client.findUnique({where:{id}});
  if(!client || client.userId!==userId)throw new ServiceError("Not found",404);
  return client;
}
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await auth();if(!session?.user)return NextResponse.json({error:"Unauthorized"},{status:401});
  try {const {id}=await params;const client=await owned(id,session.user.id);
    return NextResponse.json({asOf:Date.now(),enabled:client.budgetMonitorEnabled,emailEnabled:client.budgetMonitorEmailEnabled,
      tolerance:effectiveBudgetTolerance(client),budget:client.monthlyBudget,currency:client.currency,timezone:client.timezone,linked:!!client.metaAdAccountId,
      adsManagerUrl:client.metaAdAccountId && /^(act_)?\d+$/.test(client.metaAdAccountId) ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${client.metaAdAccountId.replace(/^act_/,"")}` : null,
      snapshot:readBudgetSnapshot(client.budgetMonitorSnapshot,client)}, {headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return apiErrorResponse(error,"budget:get");}
}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await auth();if(!session?.user)return NextResponse.json({error:"Unauthorized"},{status:401});
  try {const {id}=await params;const client=await owned(id,session.user.id);const parsed=input.safeParse(await req.json().catch(()=>null));
    if(!parsed.success)throw new ServiceError("Invalid monitoring settings.");
    if(parsed.data.action==="settings") {
      if(parsed.data.enabled && (!client.monthlyBudget || client.monthlyBudget<=0 || !client.metaAdAccountId))throw new ServiceError("Save a positive monthly budget and link a Meta account first.");
      if(parsed.data.tolerance !== undefined && (!client.monthlyBudget || parsed.data.tolerance > client.monthlyBudget)) throw new ServiceError("Allowed variance must not exceed the approved budget.");
      await prisma.client.update({where:{id},data:{budgetMonitorEnabled:parsed.data.enabled,budgetMonitorEmailEnabled:parsed.data.emailEnabled,...(parsed.data.tolerance !== undefined ? {budgetMonitorTolerance:parsed.data.tolerance} : {})}});
      return NextResponse.json({ok:true});
    }
    return NextResponse.json({snapshot:await checkClientBudget(id,session.user.id)}, {headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return apiErrorResponse(error,"budget:check");}
}

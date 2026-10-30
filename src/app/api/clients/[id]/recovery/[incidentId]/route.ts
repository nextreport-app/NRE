import {NextResponse} from 'next/server';
import {auth} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {RECOVERY_STATES} from '@/lib/quality-agents/recovery-policy';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;incidentId:string}>}){
 const session=await auth();const headers={'Cache-Control':'private, no-store'};
 if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 const {id,incidentId}=await params;
 const incident=await prisma.reportQualityIncident.findFirst({where:{id:incidentId,clientId:id,userId:session.user.id},select:{id:true,state:true,stateUpdatedAt:true}});
 if(!incident)return NextResponse.json({error:'Not found'},{status:404,headers});
 const state=RECOVERY_STATES.find(state=>state===incident.state)??'RECORDED';
 return NextResponse.json({id:incident.id,state,updatedAt:incident.stateUpdatedAt.toISOString(),stale:state==='INVESTIGATING'&&Date.now()-incident.stateUpdatedAt.getTime()>60*60*1000},{headers});
}

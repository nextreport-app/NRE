import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateShareToken } from "@/lib/share-token";
import { apiErrorResponse } from "@/lib/api-error";

/** Owner-only token revocation/rotation; old URLs stop resolving immediately. */
export async function POST(request: Request, {params}: {params: Promise<{id:string}>}) {
  const session=await auth();
  if (!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});
  const origin=request.headers.get("origin");
  if (origin && origin!==new URL(request.url).origin) return NextResponse.json({error:"Invalid origin"},{status:403});
  const body=await request.json().catch(()=>null);
  if (!body || !["disable","reset"].includes(body.action)) return NextResponse.json({error:"Choose disable or reset."},{status:400});
  try {
    const {id}=await params;
    const shareToken=body.action === "disable" ? null : generateShareToken();
    const updated=await prisma.report.updateMany({where:{id,status:"COMPLETE",client:{userId:session.user.id}},data:{shareToken}});
    if (!updated.count) return NextResponse.json({error:"Report not found"},{status:404});
    return NextResponse.json({shareToken});
  } catch(error) { return apiErrorResponse(error,"reports:share-link"); }
}

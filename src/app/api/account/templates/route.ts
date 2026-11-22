import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const templates = await prisma.agencyTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        baseVariant: true,
        status: true,
        digest: true,
        approvedAt: true,
        archivedAt: true,
        createdAt: true,
        _count: { select: { clients: true, reports: true } },
      },
    });
    return NextResponse.json(
      { templates },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "templates:list");
  }
}

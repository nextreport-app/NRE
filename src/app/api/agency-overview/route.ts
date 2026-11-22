import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { overviewRow } from "@/lib/agency-overview";
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const clients = await prisma.client.findMany({
      where: { userId: session.user.id },
      orderBy: { accountName: "asc" },
      select: {
        id: true,
        accountName: true,
        currency: true,
        timezone: true,
        monthlyBudget: true,
        metaAdAccountId: true,
        budgetMonitorEnabled: true,
        budgetMonitorTolerance: true,
        budgetMonitorSnapshot: true,
        performanceMonitorEnabled: true,
        performanceMonitorEmailEnabled: true,
        performanceMonitorSnapshot: true,
      },
    });
    const now = new Date();
    return NextResponse.json(
      {
        asOf: now.toISOString(),
        clients: clients.map((c) => overviewRow(c, now)),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "agency:overview");
  }
}

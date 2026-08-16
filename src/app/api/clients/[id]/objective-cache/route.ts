import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * Part 5 — the client Manage page's "Reset campaign objective memory"
 * escape hatch. Nulls out Client.campaignObjectiveCache so every campaign
 * goes back to fresh engine detection on this client's next report — for
 * when a campaign's real objective has genuinely changed and the old
 * cached confirmation would otherwise keep silently overriding it.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.client.update({ where: { id }, data: { campaignObjectiveCache: null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "clients:objective-cache:reset");
  }
}

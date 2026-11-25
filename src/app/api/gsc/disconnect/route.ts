import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function POST() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.$transaction(async (tx) => {
    const inherited = {
      userId: session.user.id,
      providerConnections: { none: { provider: "gsc" } },
    };
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        gscEnabled: false,
        gscRefreshToken: null,
        gscConnectedEmail: null,
      },
    });
    await tx.client.updateMany({
      where: inherited,
      data: { gscSiteUrl: null },
    });
    await tx.searchConsoleSnapshot.deleteMany({ where: { client: inherited } });
  });
  return NextResponse.json({ ok: true });
}

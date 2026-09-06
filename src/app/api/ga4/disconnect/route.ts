import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ga4Enabled: false,
      ga4AccessToken: null,
      ga4RefreshToken: null,
      ga4ConnectedEmail: null,
    },
  });

  return NextResponse.json({ ok: true });
}

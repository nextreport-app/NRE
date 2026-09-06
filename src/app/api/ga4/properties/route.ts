import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listGa4Properties, refreshGa4AccessToken } from "@/lib/ga4-api";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ga4RefreshToken: true, ga4AccessToken: true },
  });

  if (!user?.ga4RefreshToken) {
    return NextResponse.json({ error: "Google Analytics is not connected" }, { status: 400 });
  }

  let accessToken = user.ga4AccessToken ?? "";
  try {
    const refreshed = await refreshGa4AccessToken(user.ga4RefreshToken);
    accessToken = refreshed.access_token;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { ga4AccessToken: accessToken },
    });
  } catch {
    return NextResponse.json({ error: "Could not refresh GA4 access token — reconnect in Account Settings" }, { status: 400 });
  }

  const properties = await listGa4Properties(accessToken);
  return NextResponse.json({ properties });
}

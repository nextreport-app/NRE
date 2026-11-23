import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { websiteConnectionKey } from "@/lib/website-dashboard/service";
import {
  parseWebsiteSnapshot,
  websiteSnapshotFresh,
} from "@/lib/website-dashboard/model";
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [user, clients] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          ga4Enabled: true,
          ga4RefreshToken: true,
          ga4ConnectedEmail: true,
        },
      }),
      prisma.client.findMany({
        where: { userId: session.user.id },
        orderBy: { accountName: "asc" },
        select: {
          id: true,
          accountName: true,
          ga4PropertyId: true,
          ga4PropertyName: true,
        },
      }),
    ]);
    const connected = !!user?.ga4Enabled && !!user.ga4RefreshToken;
    const requested = new URL(req.url).searchParams.get("clientId"),
      selected = requested
        ? clients.find((c) => c.id === requested)
        : (clients.find((c) => c.ga4PropertyId) ?? clients[0]);
    if (requested && !selected)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const records =
      connected && selected?.ga4PropertyId
        ? await prisma.websiteDashboardSnapshot.findMany({
            where: {
              clientId: selected.id,
              propertyId: selected.ga4PropertyId,
              connectionKey: websiteConnectionKey(user!.ga4RefreshToken!),
            },
          })
        : [];
    const snapshots = records
      .filter((r) => r.days === 0 || r.days === 7 || r.days === 30)
      .map((r) => {
        const data = parseWebsiteSnapshot(
          r.dataJson,
          r.propertyId,
          r.days as 0 | 7 | 30,
        );
        return {
          days: r.days,
          data,
          error: r.error,
          fresh: !r.error && websiteSnapshotFresh(data),
          refreshing: !!r.leaseUntil && r.leaseUntil > new Date(),
        };
      });
    return NextResponse.json(
      {
        clients: clients.map((c) => ({
          id: c.id,
          name: c.accountName,
          propertyId: c.ga4PropertyId,
          propertyName: c.ga4PropertyName,
        })),
        selectedClientId: selected?.id ?? null,
        connected,
        connectedEmail: connected ? user?.ga4ConnectedEmail : null,
        snapshots,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "website:overview");
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveClientUser } from "@/lib/client-provider-connections";
import { apiErrorResponse } from "@/lib/api-error";
import { gscConnectionKey } from "@/lib/search-console/service";
import { gscDateBounds, parseGscSnapshot } from "@/lib/search-console/model";
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [user, clients] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          gscEnabled: true,
          gscRefreshToken: true,
          gscConnectedEmail: true,
        },
      }),
      prisma.client.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          userId: true,
          hasProviderConnections: true,
          accountName: true,
          gscSiteUrl: true,
        },
        orderBy: { accountName: "asc" },
      }),
    ]);
    const effective = await Promise.all(
        clients.map((c) => resolveClientUser(user, c)),
      ),
      requested = new URL(req.url).searchParams.get("clientId"),
      index = clients.findIndex((c) => c.id === requested);
    if (requested && index < 0)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const selected = index < 0 ? null : clients[index],
      grant = index < 0 ? null : effective[index],
      bounds = gscDateBounds();
    const records =
      selected?.gscSiteUrl && grant?.gscEnabled && grant.gscRefreshToken
        ? await prisma.searchConsoleSnapshot.findMany({
            where: {
              clientId: selected.id,
              siteUrl: selected.gscSiteUrl,
              connectionKey: gscConnectionKey(grant.gscRefreshToken),
            },
          })
        : [];
    return NextResponse.json(
      {
        clients: clients.map((c, i) => ({
          id: c.id,
          name: c.accountName,
          siteUrl: c.gscSiteUrl,
          connected:
            !!effective[i]?.gscEnabled && !!effective[i]?.gscRefreshToken,
        })),
        selectedClientId: selected?.id ?? null,
        ...bounds,
        snapshots: records.map((r) => {
          const data = parseGscSnapshot(r.dataJson, r.siteUrl);
          return {
            days: r.days,
            data,
            error: r.error,
            refreshing: !!r.leaseUntil && r.leaseUntil > new Date(),
            fresh:
              !!data &&
              !r.error &&
              Date.now() - Date.parse(data.checkedAt) < 26 * 3600000 &&
              data.currentPeriod.endIso <= bounds.maxDate &&
              (r.days === 0 || data.currentPeriod.endIso === bounds.maxDate),
          };
        }),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiErrorResponse(e, "gsc:overview");
  }
}

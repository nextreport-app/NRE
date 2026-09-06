import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGa4AccessTokenForUser } from "@/lib/ga4-session";
import { defaultWebsiteReportRanges, fetchGa4WebsiteReport } from "@/lib/nre/fetch-ga4-website-report";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await requireActiveSubscription(session.user.id);
  if (guard) return guard;

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      userId: true,
      accountName: true,
      timezone: true,
      currency: true,
      ga4PropertyId: true,
      ga4PropertyName: true,
    },
  });
  if (!client || client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!client.ga4PropertyId) {
    return NextResponse.json(
      { error: "Link a GA4 property to this client first (Manage page → Website Analytics)." },
      { status: 400 },
    );
  }

  const accessToken = await getGa4AccessTokenForUser(session.user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Connect Google Analytics in Account Settings first." },
      { status: 400 },
    );
  }

  const ranges = defaultWebsiteReportRanges(client.timezone);
  try {
    const data = await fetchGa4WebsiteReport({
      accessToken,
      propertyId: client.ga4PropertyId,
      propertyName: client.ga4PropertyName ?? client.ga4PropertyId,
      currencySymbol: CURRENCY_SYMBOLS[client.currency] ?? "$",
      currentRange: ranges.current,
      comparisonRange: ranges.previous,
    });

    return NextResponse.json({
      data,
      accountName: client.accountName,
      slideCount: 3 + (data.conversionMetrics.length > 0 ? 1 : 0) + (data.topPages.length > 0 ? 1 : 0),
    });
  } catch (err) {
    console.error("[api:website-report:preview]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not fetch GA4 data" },
      { status: 500 },
    );
  }
}

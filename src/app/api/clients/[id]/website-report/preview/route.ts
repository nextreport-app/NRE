import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileFromFormData } from "@/lib/http-file";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { estimateWebsiteSlideCount, parseWebsiteReportConfig, parseWebsiteReportConfigFromSearchParams } from "@/lib/nre/website-report-data";
import { resolveWebsiteReportData } from "@/lib/nre/website-report-resolve";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const url = new URL(req.url);
  const config = parseWebsiteReportConfigFromSearchParams(url.searchParams);

  try {
    const { data, warnings } = await resolveWebsiteReportData({
      userId: session.user.id,
      timezone: client.timezone,
      currencySymbol: CURRENCY_SYMBOLS[client.currency] ?? "$",
      accountName: client.accountName,
      ga4PropertyId: client.ga4PropertyId,
      ga4PropertyName: client.ga4PropertyName,
      config,
      dataSource: "api",
    });

    return NextResponse.json({
      data,
      config,
      accountName: client.accountName,
      dataSource: "api",
      warnings,
      slideCount: estimateWebsiteSlideCount(config.breakdowns, {
        hasConversionSlide: data.conversionMetrics.length > 0,
        hasTopPagesData: data.topPages.length > 0,
      }),
    });
  } catch (err) {
    console.error("[api:website-report:preview]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not fetch GA4 data" },
      { status: 500 },
    );
  }
}

/** Preview from CSV upload (multipart) or JSON config with base64 — uses ga4Csv field. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const formData = await req.formData();
  const csvBuffer = await fileFromFormData(formData, "ga4Csv");
  const configRaw = formData.get("config");
  let config = parseWebsiteReportConfig(null);
  if (typeof configRaw === "string") {
    try {
      config = parseWebsiteReportConfig(JSON.parse(configRaw));
    } catch {
      /* use defaults */
    }
  }

  if (!csvBuffer) {
    return NextResponse.json({ error: "Upload a GA4 CSV file (field: ga4Csv)." }, { status: 400 });
  }

  try {
    const { data, warnings } = await resolveWebsiteReportData({
      userId: session.user.id,
      timezone: client.timezone,
      currencySymbol: CURRENCY_SYMBOLS[client.currency] ?? "$",
      accountName: client.accountName,
      ga4PropertyId: client.ga4PropertyId,
      ga4PropertyName: client.ga4PropertyName,
      config,
      dataSource: "csv",
      csvBuffer,
    });

    return NextResponse.json({
      data,
      config,
      accountName: client.accountName,
      dataSource: "csv",
      warnings,
      slideCount: estimateWebsiteSlideCount(config.breakdowns, {
        hasConversionSlide: data.conversionMetrics.length > 0,
        hasTopPagesData: data.topPages.length > 0,
      }),
    });
  } catch (err) {
    console.error("[api:website-report:preview:csv]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not build report from CSV" },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportBrandingFromShareJson } from "@/lib/report-branding";
import { contentTypeForLogoFormat, detectLogoFormat } from "@/lib/logo-processing";
import { readLogoFile } from "@/lib/storage";

/** Public agency logo for a shared report — token-gated, no login required. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await prisma.report.findUnique({
    where: { shareToken: token },
    select: { status: true, summaryJson: true },
  });
  if (!report || report.status !== "COMPLETE" || !report.summaryJson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(report.summaryJson);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const branding = reportBrandingFromShareJson(parsed);
  if (branding.mode !== "agency" || !branding.agencyLogoUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buffer = await readLogoFile(branding.agencyLogoUrl);
    const format = detectLogoFormat(buffer);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": format ? contentTypeForLogoFormat(format) : "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

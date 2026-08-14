import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * Public PPTX download for the share page's "Download PPTX" button
 * (components/share-report-view.tsx) — no session required, gated only by
 * the same unguessable shareToken that already gates the page itself (see
 * app/r/[token]/page.tsx and proxy.ts's /api/r/ public-path allowance).
 * Anyone who can already see the report's full content on the share page
 * is, by definition, someone the link was meant to be shared with, so this
 * carries no more exposure than the page they're already looking at.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const report = await prisma.report.findUnique({ where: { shareToken: token } });
    if (!report || report.status !== "COMPLETE" || !report.filePath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readReportFile(report.filePath);
    const fileName = report.fileName || "report.pptx";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "share:download");
  }
}

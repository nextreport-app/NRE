import { reportDownloadResponse } from "@/lib/report-download-response";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await prisma.report.findUnique({ where: { id }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (report.status !== "COMPLETE" || !report.filePath) {
      return NextResponse.json({ error: "Report is not ready for download." }, { status: 409 });
    }

    const fileName = report.fileName || "report.pptx";

    return await reportDownloadResponse(req, report.filePath, fileName);
  } catch (err) {
    return apiErrorResponse(err, "reports:download");
  }
}

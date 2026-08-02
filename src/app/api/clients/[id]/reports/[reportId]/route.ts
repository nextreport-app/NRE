import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";

/** Deletes a single generated report — verifies it belongs (via its client) to the current user before touching anything. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id || report.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Best-effort — an orphaned blob file is a smaller problem than failing
    // the whole delete over a storage hiccup (same tolerance as
    // deleteReportFile's own swallowed-error implementation).
    if (report.filePath) await deleteReportFile(report.filePath);

    await prisma.report.delete({ where: { id: reportId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "reports:delete");
  }
}

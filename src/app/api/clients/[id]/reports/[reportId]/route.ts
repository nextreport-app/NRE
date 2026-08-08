import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";

const MAX_DISPLAY_NAME_LENGTH = 200;

/** Feature 4 — the report history lists' pencil-icon inline rename. An empty/whitespace-only name clears the override (falls back to the auto-generated default wherever it's read), rather than saving a blank string. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id || report.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (typeof body?.displayName !== "string") {
      return NextResponse.json({ error: "displayName must be a string." }, { status: 400 });
    }
    const trimmed = body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { displayName: trimmed || null },
    });
    return NextResponse.json({ ok: true, displayName: updated.displayName });
  } catch (err) {
    return apiErrorResponse(err, "reports:rename");
  }
}

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

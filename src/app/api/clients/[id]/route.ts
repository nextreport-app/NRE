import { after } from "next/server";
import { queueBlobDeletions, drainBlobDeletionQueue } from "@/lib/blob-deletion-outbox";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientPatchSchema } from "@/lib/validators/client";
import { apiErrorResponse } from "@/lib/api-error";

async function getOwnedClient(userId: string, id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== userId) return null;
  return client;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await getOwnedClient(session.user.id, id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ client });
  } catch (err) {
    return apiErrorResponse(err, "clients:get");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await getOwnedClient(session.user.id, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const parsed = clientPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const client = await prisma.client.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ client });
  } catch (err) {
    return apiErrorResponse(err, "clients:update");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await getOwnedClient(session.user.id, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const activeJob = await prisma.report.count({ where: { clientId: id, status: "GENERATING", OR: [{ createdAt: { gt: new Date(Date.now() - 600000) } }, { processingStartedAt: { gt: new Date(Date.now() - 600000) } }] } });
    if (activeJob) return NextResponse.json({ error: "Wait for report generation to finish before deleting." }, { status: 409 });
    await prisma.$transaction(async tx => {
      const reports = await tx.report.findMany({ where: { clientId: id }, select: { filePath: true, pdfPath: true } });
      await queueBlobDeletions(tx, [existing.logoUrl, existing.previousMonthDataUrl, ...reports.flatMap(report => [report.filePath, report.pdfPath])]);
      await tx.client.delete({ where: { id } });
    });
    after(async () => { await drainBlobDeletionQueue(); });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "clients:delete");
  }
}

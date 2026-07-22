import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id }, include: { client: true } });
  if (!report || report.client.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (report.status !== "COMPLETE" || !report.filePath) {
    return NextResponse.json({ error: "Report is not ready for download." }, { status: 409 });
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
}

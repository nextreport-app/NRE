import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import { saveReportToDriveFolder } from "@/lib/google-drive";

const bodySchema = z.object({
  folderId: z.string().trim().min(1),
  folderName: z.string().trim().min(1),
});

/**
 * The download screen's "Save to Google Drive" button: uploads the
 * already-generated report into the folder the user picked via the folder
 * browser, converts it to Google Slides, and shares it. Also remembers the
 * chosen folder on the client (Client.lastDriveFolderId/lastDriveFolderName)
 * so the picker pre-selects it as a convenience next time a report is saved
 * for this same client.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await prisma.report.findUnique({ where: { id }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (report.status !== "COMPLETE" || !report.filePath) {
      return NextResponse.json({ error: "Report is not ready yet." }, { status: 409 });
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a folder first." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { googleRefreshToken: true },
    });
    if (!user?.googleRefreshToken) {
      return NextResponse.json({ error: "Google Drive is not connected." }, { status: 400 });
    }

    const pptxBuffer = await readReportFile(report.filePath);
    const fileName = report.fileName?.replace(/\.pptx$/i, "") || `NextReport - ${report.id}`;

    const { webViewLink } = await saveReportToDriveFolder({
      refreshToken: user.googleRefreshToken,
      folderId: parsed.data.folderId,
      fileName,
      pptxBuffer,
    });

    await Promise.all([
      prisma.report.update({ where: { id: report.id }, data: { slidesUrl: webViewLink } }),
      prisma.client.update({
        where: { id: report.client.id },
        data: { lastDriveFolderId: parsed.data.folderId, lastDriveFolderName: parsed.data.folderName },
      }),
    ]);
    return NextResponse.json({ url: webViewLink });
  } catch (err) {
    return apiErrorResponse(err, "reports:save-to-drive");
  }
}

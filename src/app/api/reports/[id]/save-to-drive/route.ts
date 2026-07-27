import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import { saveReportToDriveFolder } from "@/lib/google-drive";

const bodySchema = z.object({
  folderId: z.string().trim().min(1),
});

const FOLDER_ACCESS_ERROR_MESSAGE =
  "Could not access that folder. Make sure the folder is in your connected Google Drive account and the link is correct.";

/**
 * The download screen's "Save to Google Drive" button: uploads the
 * already-generated report into the folder id the client extracted from a
 * pasted Drive link (see lib/drive-link.ts), converts it to Google Slides,
 * and shares it. Also remembers the folder on the client
 * (Client.lastDriveFolderId/lastDriveFolderName) so the download screen
 * shows "Saving to: [name] — Change" instead of asking for a link again
 * next time a report is saved for this same client.
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
      return NextResponse.json({ error: "Paste a Google Drive folder link first." }, { status: 400 });
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

    // The upload attempt itself IS the folder-access check — a bad/deleted/
    // inaccessible folder id surfaces as a thrown error here, mapped to one
    // clear message rather than whatever raw text the Drive API returned.
    let webViewLink: string;
    let folderName: string | null;
    try {
      ({ webViewLink, folderName } = await saveReportToDriveFolder({
        refreshToken: user.googleRefreshToken,
        folderId: parsed.data.folderId,
        fileName,
        pptxBuffer,
      }));
    } catch (err) {
      console.error("[api:reports:save-to-drive] folder upload failed:", err);
      return NextResponse.json({ error: "folder_access_failed", message: FOLDER_ACCESS_ERROR_MESSAGE }, { status: 400 });
    }

    const resolvedName = folderName ?? parsed.data.folderId;
    await Promise.all([
      prisma.report.update({ where: { id: report.id }, data: { slidesUrl: webViewLink } }),
      prisma.client.update({
        where: { id: report.client.id },
        data: { lastDriveFolderId: parsed.data.folderId, lastDriveFolderName: resolvedName },
      }),
    ]);
    return NextResponse.json({ url: webViewLink, folderName: resolvedName });
  } catch (err) {
    return apiErrorResponse(err, "reports:save-to-drive");
  }
}

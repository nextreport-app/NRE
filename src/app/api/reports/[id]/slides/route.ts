import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import {
  GOOGLE_DRIVE_SCOPE,
  getFreshGoogleAccessToken,
  shareFilePublicly,
  uploadPptxAsGoogleSlides,
} from "@/lib/google-drive";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Already created for this report — return the existing link instead of
    // uploading a duplicate file to the user's Drive on every click.
    if (report.slidesUrl) {
      return NextResponse.json({ url: report.slidesUrl });
    }

    const googleAccount = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "google" },
    });

    if (!googleAccount?.refresh_token || !googleAccount.scope?.includes(GOOGLE_DRIVE_SCOPE)) {
      return NextResponse.json(
        {
          error: "google_drive_not_connected",
          message: "Connect Google Drive to create a Google Slides link.",
        },
        { status: 400 },
      );
    }

    const accessToken = await getFreshGoogleAccessToken(googleAccount.refresh_token);
    const pptxBuffer = await readReportFile(report.filePath);
    const fileName = report.fileName?.replace(/\.pptx$/i, "") || `NextReport - ${report.id}`;

    const { id: fileId, webViewLink } = await uploadPptxAsGoogleSlides(accessToken, pptxBuffer, fileName);
    await shareFilePublicly(accessToken, fileId);

    const slidesUrl = webViewLink || `https://docs.google.com/presentation/d/${fileId}/edit`;
    await prisma.report.update({ where: { id: report.id }, data: { slidesUrl } });

    return NextResponse.json({ url: slidesUrl });
  } catch (err) {
    return apiErrorResponse(err, "reports:slides");
  }
}

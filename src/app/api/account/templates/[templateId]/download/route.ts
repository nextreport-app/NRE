import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportDownloadResponse } from "@/lib/report-download-response";
import { apiErrorResponse } from "@/lib/api-error";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { templateId } = await params;
    const asset = await prisma.agencyTemplate.findFirst({
      where: { id: templateId, userId: session.user.id, status: "READY" },
    });
    if (!asset)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const preview = new URL(req.url).searchParams.get("preview") === "1";
    return reportDownloadResponse(
      req,
      preview ? asset.previewPath : asset.filePath,
      preview ? "Sample-template-review.pptx" : "Agency-design.pptx",
    );
  } catch (error) {
    return apiErrorResponse(error, "templates:download");
  }
}

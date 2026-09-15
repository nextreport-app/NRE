import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";

/** Lightweight poll target for async report generation. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        status: true,
        shareToken: true,
        errorMessage: true,
        client: { select: { userId: true } },
      },
    });
    if (!report || report.client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: report.status,
      shareToken: report.status === "COMPLETE" ? report.shareToken : null,
      errorMessage: report.status === "FAILED" ? report.errorMessage : null,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:status");
  }
}

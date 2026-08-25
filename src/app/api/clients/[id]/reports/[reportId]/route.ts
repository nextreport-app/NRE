import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteReportFile } from "@/lib/storage";
import { apiErrorResponse } from "@/lib/api-error";
import type { ShareReportData } from "@/lib/nre/share-report";

const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_COPY_CHARS = 800;

const copySlideSchema = z.object({
  campaignName: z.string(),
  adSetName: z.string().optional(),
  aiSummary: z.string().max(MAX_COPY_CHARS),
  aiInsights: z.string().max(MAX_COPY_CHARS),
});

const copyReviewSchema = z.object({
  campaigns: z.array(copySlideSchema),
  adSets: z.array(copySlideSchema).optional(),
});

function parseShareJson(raw: string | null): ShareReportData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.campaigns)) return null;
    return parsed as ShareReportData;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id || report.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const share = parseShareJson(report.summaryJson);
    if (!share) {
      return NextResponse.json({ ok: true, campaigns: [], adSets: [] });
    }
    return NextResponse.json({
      ok: true,
      campaigns: share.campaigns.map((c) => ({
        campaignName: c.campaignName,
        aiSummary: c.aiSummary,
        aiInsights: c.aiInsights,
      })),
      adSets: share.adSets.map((c) => ({
        campaignName: c.campaignName,
        adSetName: c.adSetName,
        aiSummary: c.aiSummary,
        aiInsights: c.aiInsights,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:copy-get");
  }
}

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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    }

    if (typeof body.displayName === "string") {
      const trimmed = body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
      const updated = await prisma.report.update({
        where: { id: reportId },
        data: { displayName: trimmed || null },
      });
      return NextResponse.json({ ok: true, displayName: updated.displayName });
    }

    if (body.copyReview) {
      const parsed = copyReviewSchema.safeParse(body.copyReview);
      if (!parsed.success) {
        return NextResponse.json({ error: "copyReview is invalid." }, { status: 400 });
      }
      const share = parseShareJson(report.summaryJson);
      if (!share) {
        return NextResponse.json({ error: "This report has no live-link copy to edit." }, { status: 400 });
      }
      const campaignCopy = new Map(parsed.data.campaigns.map((c) => [c.campaignName, c]));
      share.campaigns = share.campaigns.map((c) => {
        const next = campaignCopy.get(c.campaignName);
        return next ? { ...c, aiSummary: next.aiSummary, aiInsights: next.aiInsights } : c;
      });
      if (parsed.data.adSets) {
        share.adSets = share.adSets.map((c) => {
          const next = parsed.data.adSets!.find((a) => a.campaignName === c.campaignName && a.adSetName === c.adSetName);
          return next ? { ...c, aiSummary: next.aiSummary, aiInsights: next.aiInsights } : c;
        });
      }
      await prisma.report.update({
        where: { id: reportId },
        data: { summaryJson: JSON.stringify(share) },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Provide displayName or copyReview." }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err, "reports:rename");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id || report.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (report.filePath) await deleteReportFile(report.filePath);

    await prisma.report.delete({ where: { id: reportId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "reports:delete");
  }
}

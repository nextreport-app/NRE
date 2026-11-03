import { extractCampaignNames, extractCampaignSpend, isLowSpendCampaign, sortCampaignsBySpend } from "@/lib/nre/campaigns";
import { extractSpendingAdSetGroups } from "@/lib/nre/ad-sets";
import { hasAdLevelData } from "@/lib/nre/ad-level";
import { detectMetaCsvExportProfile } from "@/lib/nre/meta-csv-export-profile";
import { analyzeCsvDateGuidance } from "@/lib/nre/csv-date-guidance";
import { buildCsvMetricHeaderProfile } from "@/lib/nre/csv-metric-evidence";
import { enforceWizardLimits } from "@/lib/usage-rate-limit";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { loadWizardUploadSession } from "@/lib/nre/wizard-upload-session";
import { computeWizardUploadDateContext } from "@/lib/nre/wizard-upload-date-context";
import { uploadSessionIdSchema } from "@/lib/validators/report-wizard";

export const maxDuration = 300;

const bodySchema = z.object({
  uploadSessionId: uploadSessionIdSchema,
});

/**
 * Rehydrate CSV-backed facts from the authenticated upload session. Drafts
 * store user choices; spend and ad-set data must come from the original rows.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subscriptionGuard = await requireActiveSubscription(session.user.id);
  if (subscriptionGuard) return subscriptionGuard;
  const throttle = await enforceWizardLimits(session.user.id, "work");
  if (throttle) return throttle;

  try {
    const { id: clientId } = await params;
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid upload session." }, { status: 400 });
    }

    const payload = await loadWizardUploadSession(session.user.id, clientId, parsed.data.uploadSessionId);
    if (!payload) {
      return NextResponse.json(
        { ok: false, uploadSessionExpired: true, error: "Upload session expired. Re-analyze your CSV to continue." },
        { status: 200 },
      );
    }

    const context = computeWizardUploadDateContext(payload.rows, client.timezone);

    const campaignSpend = extractCampaignSpend(payload.rows);
    const campaigns = sortCampaignsBySpend(extractCampaignNames(payload.rows), campaignSpend);
    return NextResponse.json({
      ok: true,
      campaigns,
      campaignSpend,
      lowSpendCampaigns: campaigns.filter(name => isLowSpendCampaign(name, campaignSpend)),
      adSetGroups: extractSpendingAdSetGroups(payload.rows),
      hasAdLevelCsv: hasAdLevelData(payload.headers),
      metaCsvExportProfile: payload.platform === "META" ? detectMetaCsvExportProfile(payload.colMap, payload.rows, payload.headers) : null,
      csvDateGuidance: payload.rows.some(row => row._reportPeriod) ? null : analyzeCsvDateGuidance(payload.rows, new Date(), client.timezone),
      headers: payload.headers,
      metricHeaderProfile: buildCsvMetricHeaderProfile(payload.headers,payload.rows),
      ...context,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:upload-session-context");
  }
}

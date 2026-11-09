import { campaignSelectionSpend } from "@/lib/nre/campaign-selection-spend";
import { resolveReportCurrencySymbol } from "@/lib/nre/csv-currency";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { extractCampaignNames, sortCampaignsBySpend } from "@/lib/nre/campaigns";
import { extractSpendingAdSetGroups } from "@/lib/nre/ad-sets";
import { resolveDefaultSelectedAdSets, newAdSetSlideKeys } from "@/lib/nre/ad-set-slide-preferences";
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
import { uploadSessionIdSchema, reportTypeSchema, dateSelectionSchema, comparisonPeriodSchema, campaignSelectionMemorySchema } from "@/lib/validators/report-wizard";

export const maxDuration = 300;

const bodySchema = z.object({
  uploadSessionId: uploadSessionIdSchema,
  reportType: reportTypeSchema.optional(),
  dateSelection: dateSelectionSchema.optional(),
  comparisonPeriodA: comparisonPeriodSchema.optional(),
  comparisonPeriodB: comparisonPeriodSchema.optional(),
  historicalMonthCount: z.number().int().min(1).max(12).optional(),
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

    const memory = client.lastDeselectedCampaigns ? campaignSelectionMemorySchema.safeParse(JSON.parse(client.lastDeselectedCampaigns)) : null;
    const spendContext = campaignSelectionSpend(payload.rows, {...parsed.data,reportType:parsed.data.reportType ?? "WEEKLY"},client.timezone,new Date(),memory?.success ? memory.data : null);
    const {campaignSpend} = spendContext;
    const campaigns = sortCampaignsBySpend(extractCampaignNames(payload.rows), campaignSpend);
    const adSetGroups = extractSpendingAdSetGroups(payload.rows);
    return NextResponse.json({
      ok: true,
      currencySymbol: resolveReportCurrencySymbol(payload.headers, payload.rows, CURRENCY_SYMBOLS[client.currency]),
      campaigns,
      ...spendContext,
      lowSpendCampaigns: spendContext.zeroSpendCampaigns,
      adSetGroups,
      selectedAdSets: resolveDefaultSelectedAdSets(adSetGroups, client.lastDeselectedAdSets),
      newAdSetKeys: newAdSetSlideKeys(adSetGroups, client.lastDeselectedAdSets),
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

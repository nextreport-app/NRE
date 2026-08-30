import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { extractCampaignNames, extractCampaignSpend, resolveCampaignSelectionWithLowSpend, sortCampaignsBySpend, type CampaignSelectionMemory } from "@/lib/nre/campaigns";
import { extractSpendingAdSetGroups } from "@/lib/nre/ad-sets";
import { computeCsvDateBounds, computeDailyRangeIso, computeMonthComparisonRangeOptions, computeMtdRangeIso, computeWeeklyRangeOptions } from "@/lib/nre/date-range";
import { hasAdLevelData } from "@/lib/nre/ad-level";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { campaignSelectionMemorySchema, dateSelectionSchema, parseJsonFormField, platformSchema, type DateSelection } from "@/lib/validators/report-wizard";
import { detectPlatform, readGoogleRowsWithAutoMap } from "@/lib/nre/google-columns";
import { validateGoogleAdsCsv } from "@/lib/nre/validate-google";
import { parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";

const DEFAULT_DATE_SELECTION: DateSelection = { mode: "last7" };

/**
 * Step 1+2 of the report upload wizard in one round trip: parses and
 * validates the CSV, lists its campaigns, computes the weekly/MTD date
 * options, and returns the client's saved preferences (if any) so the
 * wizard can pre-select the same campaigns/date mode as last time.
 *
 * Platform (Meta vs Google Ads) is auto-detected from the CSV's own
 * headers (see google-columns.ts's detectPlatform), unless the wizard
 * passes an explicit `platform` field (the user manually overrode the
 * badge). Google Ads reports use a deliberately simpler pipeline than
 * Meta's for this first pass — no campaign-selection or date-range steps,
 * always the full MTD dataset — so a GOOGLE response's `campaignStepMode`
 * is unused by the wizard (it goes straight to the preview regardless);
 * "choose" is just a harmless placeholder value.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await req.formData().catch(() => null);
    const mtdDailyBuffer = formData ? await fileFromFormData(formData, "mtdDailyCsv") : null;
    if (!mtdDailyBuffer || mtdDailyBuffer.length === 0) {
      return NextResponse.json(
        { valid: false, errors: [{ field: "mtdDailyCsv", message: "MTD Daily CSV is required." }], warnings: [] },
        { status: 200 },
      );
    }

    const { headers, dataRows } = parseUploadedFileHeadersAndRows(mtdDailyBuffer, "MTD Daily CSV");
    const platformOverride = formData ? parseJsonFormField(formData, "platform", platformSchema) : undefined;
    const detectedPlatform = detectPlatform(headers);
    const platform = platformOverride ?? detectedPlatform;

    if (platform === "GOOGLE") {
      const { colMap, rows } = readGoogleRowsWithAutoMap(headers, dataRows);
      const validation = validateGoogleAdsCsv(colMap, rows, undefined, headers);
      if (!validation.valid) {
        return NextResponse.json(
          { valid: false, errors: validation.errors, warnings: validation.warnings, detectedPlatform, platform },
          { status: 200 },
        );
      }

      return NextResponse.json({
        valid: true,
        errors: [],
        warnings: validation.warnings,
        detectedPlatform,
        platform,
        headers,
        campaigns: [],
        selectedCampaigns: [],
        campaignStepMode: "choose",
        adSetGroups: [],
        dateBounds: null,
        weeklyOptions: null,
        mtdRange: null,
        dateSelection: DEFAULT_DATE_SELECTION,
      });
    }

    const mtdParsed = parseUploadedFile(mtdDailyBuffer, "MTD Daily CSV");
    const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);
    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          detectedPlatform,
          platform,
          // The wizard's PreviousMonthSummaryOption replaces the hard
          // NO_DATA_ROWS_MESSAGE error with a "generate from Previous Month
          // Data instead" offer whenever both are true.
          noCampaignData: validation.noCampaignData,
          hasPreviousMonthData: !!client.previousMonthDataUrl,
        },
        { status: 200 },
      );
    }

    // Step 2 spec — campaigns sorted by total spend descending, with the
    // spend value itself returned so the wizard can render each row's
    // amber spend badge. Sorted BEFORE resolveCampaignSelection so its own
    // order-preserving filter naturally keeps selectedCampaigns in the same
    // spend-descending order.
    const campaignSpend = extractCampaignSpend(mtdParsed.rows);
    const campaigns = sortCampaignsBySpend(extractCampaignNames(mtdParsed.rows), campaignSpend);

    let campaignMemory: CampaignSelectionMemory | null = null;
    if (client.lastDeselectedCampaigns) {
      const parsed = campaignSelectionMemorySchema.safeParse(JSON.parse(client.lastDeselectedCampaigns));
      if (parsed.success) campaignMemory = parsed.data;
    }
    const { selectedCampaigns, stepMode: campaignStepMode, lowSpendCampaigns } = resolveCampaignSelectionWithLowSpend(
      campaigns,
      campaignMemory,
      campaignSpend,
    );

    // Improvement 2 — the Campaigns step's per-campaign expandable ad-set
    // checklist. Every qualifying ad set (spend > 0) starts pre-checked;
    // there's no saved memory for this like campaigns have (see
    // ad-sets.ts's file header — deselection only ever affects this one
    // report's ad-set slides, nothing persists across uploads).
    const adSetGroups = extractSpendingAdSetGroups(mtdParsed.rows);

    let dateSelection: DateSelection = DEFAULT_DATE_SELECTION;
    if (client.lastDateSelection) {
      const parsed = dateSelectionSchema.safeParse(JSON.parse(client.lastDateSelection));
      if (parsed.success) dateSelection = parsed.data;
    }

    const dateBounds = computeCsvDateBounds(mtdParsed.rows);
    const weeklyOptions = computeWeeklyRangeOptions(mtdParsed.rows);
    const mtdRange = computeMtdRangeIso(mtdParsed.rows);
    // Comparison Report's "This week vs Last week" preset reuses
    // weeklyOptions.last7/prev7 directly (already exactly Period A/B); "This
    // month vs Last month" needs its own computation, additive alongside
    // the existing three.
    const monthComparisonOptions = computeMonthComparisonRangeOptions(mtdParsed.rows);
    const dailyRange = computeDailyRangeIso(mtdParsed.rows);
    const hasAdLevelCsv = hasAdLevelData(mtdParsed.headers);

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings: validation.warnings,
      detectedPlatform,
      platform,
      headers: mtdParsed.headers,
      campaigns,
      campaignSpend,
      selectedCampaigns,
      campaignStepMode,
      lowSpendCampaigns,
      adSetGroups,
      dateBounds,
      weeklyOptions,
      mtdRange,
      monthComparisonOptions,
      dailyRange,
      hasAdLevelCsv,
      dateSelection,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:analyze");
  }
}

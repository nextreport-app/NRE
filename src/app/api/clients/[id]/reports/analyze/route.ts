import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUploadedFile } from "@/lib/nre/parse-file";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { extractCampaignNames, resolveCampaignSelection, type CampaignSelectionMemory } from "@/lib/nre/campaigns";
import { computeCsvDateBounds, computeMtdRangeIso, computeWeeklyRangeOptions } from "@/lib/nre/date-range";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { campaignSelectionMemorySchema, dateSelectionSchema, parseJsonFormField, platformSchema, type DateSelection } from "@/lib/validators/report-wizard";
import { detectPlatform, readGoogleRowsWithAutoMap } from "@/lib/nre/google-columns";
import { validateGoogleAdsCsv } from "@/lib/nre/validate-google";
import { parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import { detectCampaignObjectives } from "@/lib/nre/detect-objective";

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
        { valid: false, errors: validation.errors, warnings: validation.warnings, detectedPlatform, platform },
        { status: 200 },
      );
    }

    const campaigns = extractCampaignNames(mtdParsed.rows);
    // Fix 6: objective detection runs per campaign (not once for the whole
    // account) — an account mixing Reach + Traffic + Lead Gen campaigns
    // needs each campaign's own majority result type considered, or a
    // single account-wide guess silently hides half of them from the
    // wizard's auto-suggested metric selection (see metric-selector.ts's
    // selectMetrics, which now accepts this whole array and unions every
    // campaign's relevant secondaries).
    const detectedObjectives = detectCampaignObjectives(mtdParsed.rows, mtdParsed.headers);

    let campaignMemory: CampaignSelectionMemory | null = null;
    if (client.lastDeselectedCampaigns) {
      const parsed = campaignSelectionMemorySchema.safeParse(JSON.parse(client.lastDeselectedCampaigns));
      if (parsed.success) campaignMemory = parsed.data;
    }
    const { selectedCampaigns, stepMode: campaignStepMode } = resolveCampaignSelection(campaigns, campaignMemory);

    let dateSelection: DateSelection = DEFAULT_DATE_SELECTION;
    if (client.lastDateSelection) {
      const parsed = dateSelectionSchema.safeParse(JSON.parse(client.lastDateSelection));
      if (parsed.success) dateSelection = parsed.data;
    }

    const dateBounds = computeCsvDateBounds(mtdParsed.rows);
    const weeklyOptions = computeWeeklyRangeOptions(mtdParsed.rows);
    const mtdRange = computeMtdRangeIso(mtdParsed.rows);

    return NextResponse.json({
      valid: true,
      errors: [],
      warnings: validation.warnings,
      detectedPlatform,
      platform,
      headers: mtdParsed.headers,
      detectedObjectives,
      campaigns,
      selectedCampaigns,
      campaignStepMode,
      dateBounds,
      weeklyOptions,
      mtdRange,
      dateSelection,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:analyze");
  }
}

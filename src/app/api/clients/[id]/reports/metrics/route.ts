import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { validateGoogleAdsCsv } from "@/lib/nre/validate-google";
import { detectPlatform, readGoogleRowsWithAutoMap } from "@/lib/nre/google-columns";
import { filterRowsByCampaigns } from "@/lib/nre/campaigns";
import { buildCampaignObjectiveMapWithConfidence } from "@/lib/nre/objective";
import { parseObjectiveCache, lookupCachedObjective } from "@/lib/nre/objective-cache";
import { detectGoogleObjectiveKey } from "@/lib/nre/detect-objective";
import { defaultGoogleSelection, defaultMetaSelection, filterAddableMetrics, listSelectableMetrics, type AvailableMetric, type SelectedMetric } from "@/lib/nre/available-metrics";
import { objectiveKeyFor, stripNeverKeys } from "@/lib/nre/slot-assignment";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { parseJsonFormField, platformSchema, selectedCampaignsSchema } from "@/lib/validators/report-wizard";

/**
 * Part 3's optional Metric Review wizard step: run AFTER campaign selection
 * (so the engine knows which campaigns are actually being reported on and
 * can pick the right objective-based default), BEFORE dates — no
 * date-filtered data exists yet at this point, so this only ever returns
 * metric LABELS (the wizard's own dropdown pool + the engine's default 8),
 * never aggregated values; see available-metrics.ts's own file header for
 * why that's fine — the wizard step doesn't show numbers either.
 *
 * Re-parses the CSV rather than reusing analyze/route.ts's own parse, same
 * stateless-round-trip pattern preview/route.ts and reports/route.ts
 * already use (the wizard re-sends the file on every step; nothing is
 * persisted server-side between them).
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
      return NextResponse.json({ error: "MTD Daily CSV is required." }, { status: 400 });
    }

    const { headers, dataRows } = parseUploadedFileHeadersAndRows(mtdDailyBuffer, "MTD Daily CSV");
    const platformOverride = formData ? parseJsonFormField(formData, "platform", platformSchema) : undefined;
    const platform = platformOverride ?? detectPlatform(headers);
    const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;

    if (platform === "GOOGLE") {
      const { colMap, rows } = readGoogleRowsWithAutoMap(headers, dataRows);
      const validation = validateGoogleAdsCsv(colMap, rows, undefined, headers);
      if (!validation.valid) {
        return NextResponse.json({ error: "CSV failed validation.", errors: validation.errors }, { status: 200 });
      }
      const objectiveKey = detectGoogleObjectiveKey(headers);
      return NextResponse.json({
        defaultSelection: defaultGoogleSelection(objectiveKey),
        availableMetrics: listSelectableMetrics(headers, "GOOGLE"),
      });
    }

    const mtdParsed = parseUploadedFile(mtdDailyBuffer, "MTD Daily CSV");
    const validation = validateMtdDailyCsv(mtdParsed.colMap, mtdParsed.rows, undefined, mtdParsed.headers);
    if (!validation.valid) {
      return NextResponse.json({ error: "CSV failed validation.", errors: validation.errors }, { status: 200 });
    }

    const rowsForObjective = filterRowsByCampaigns(mtdParsed.rows, selectedCampaigns ?? null);

    // Objective Confirmation wizard step — one entry per selected campaign
    // (keyed by objective.ts's own normalizeCampaignName, so the wizard's
    // lookup and the eventual campaignObjectives override sent back to
    // buildReportData use identical keys), from the SAME algorithm
    // buildReportData itself uses (resolveCampaignObjective, via
    // buildCampaignObjectiveMap) — so the dropdown's pre-selected value is
    // never a different guess than what the report would generate if the
    // user changed nothing.
    //
    // Objective Confirmation memory cache — a campaign this client has
    // confirmed on any PRIOR report's Objective Confirmation step (see
    // objective-cache.ts) always wins over a fresh engine re-detection: it's
    // the single most reliable signal available, since it came from a human
    // actually looking at the campaign, not an inference from column data —
    // treated as "high" confidence, requiring no further confirmation.
    // Every other campaign keeps the engine's own 4-tier confidence
    // (high/medium/low/verify — see objective.ts's ObjectiveConfidence) so
    // the wizard can show the right badge and block Continue for a "verify"
    // campaign until the user picks a value.
    const objectiveCache = parseObjectiveCache(client.campaignObjectiveCache);
    const campaignObjectiveEntries: [
      string,
      { resultLabel: string; costLabel: string; confidence: "cached" | "high" | "medium" | "low" | "verify"; requiresConfirmation: boolean },
    ][] = Array.from(buildCampaignObjectiveMapWithConfidence(rowsForObjective)).map(([name, detected]) => {
      const cached = lookupCachedObjective(objectiveCache, name);
      if (cached) {
        return [name, { resultLabel: cached.resultLabel, costLabel: cached.costLabel, confidence: "cached", requiresConfirmation: false }];
      }
      return [
        name,
        {
          resultLabel: detected.resultLabel,
          costLabel: detected.costLabel,
          confidence: detected.confidence,
          requiresConfirmation: detected.requiresConfirmation,
        },
      ];
    });
    const campaignObjectives = Object.fromEntries(campaignObjectiveEntries);

    // Thing 3 (three-layer objective architecture rebuild) — each SELECTED
    // campaign gets its OWN correct pre-selected 8 metrics, from
    // defaultMetaSelection called with THAT campaign's own confirmed
    // objective (never an account-wide union across every objective
    // present) — a campaign whose objective is META FORM LEADS never sees
    // another campaign's WEBSITE LEADS pair in its own pre-selected list,
    // and vice versa. Thing 1's stripNeverKeys is the hard backstop on top:
    // even if defaultMetaSelection's own per-objective switch ever assigned
    // a forbidden cross-objective key, it's stripped here before the wizard
    // ever sees it.
    const fullPool = listSelectableMetrics(mtdParsed.headers, "META");
    const perCampaignSelection: Record<string, SelectedMetric[]> = {};
    const perCampaignAvailable: Record<string, SelectedMetric[]> = {};

    for (const [normalizedName, info] of Object.entries(campaignObjectives)) {
      const objectiveKey = objectiveKeyFor(info.resultLabel);
      const selection = stripNeverKeys(defaultMetaSelection(info.resultLabel, info.costLabel, mtdParsed.headers), objectiveKey).filter(
        (m): m is SelectedMetric => m !== null,
      );
      perCampaignSelection[normalizedName] = selection;

      perCampaignAvailable[normalizedName] = filterAddableMetrics(
        stripNeverKeys(fullPool, objectiveKey).filter((m): m is AvailableMetric => m !== null),
        selection,
      );
    }

    return NextResponse.json({
      perCampaignSelection,
      perCampaignAvailable,
      campaignObjectives,
    });
  } catch (err) {
    return apiErrorResponse(err, "reports:metrics");
  }
}

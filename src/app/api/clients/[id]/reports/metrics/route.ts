import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWizardMtdFromFormData } from "@/lib/nre/resolve-wizard-upload";
import { filterRowsByCampaigns } from "@/lib/nre/campaigns";
import { buildCampaignObjectiveMapWithConfidence } from "@/lib/nre/objective";
import { parseObjectiveCache, lookupCachedObjective, cachedObjectiveAgreesWithDetection } from "@/lib/nre/objective-cache";
import type { SelectedMetric } from "@/lib/nre/available-metrics";
import {
  googleObjectiveKeyFromHeaders,
  googleSlideObjectiveLabels,
  usesMetaObjectiveEngine,
} from "@/lib/nre/platform-reporting";
import { buildCampaignMetricBundle } from "@/lib/nre/wizard-campaign-metrics";
import { apiErrorResponse } from "@/lib/api-error";
import { parseJsonFormField, selectedCampaignsSchema } from "@/lib/validators/report-wizard";

/**
 * Part 3's optional Metric Review wizard step: run AFTER campaign selection
 * (so the engine knows which campaigns are actually being reported on and
 * can pick the right objective-based default), BEFORE dates — no
 * date-filtered data exists yet at this point, so this only ever returns
 * metric LABELS (the wizard's own dropdown pool + the engine's default 8),
 * never aggregated values; see available-metrics.ts's own file header for
 * why that's fine — the wizard step doesn't show numbers either.
 *
 * Loads the parsed CSV from the analyze upload session when uploadSessionId
 * is sent — otherwise falls back to parsing mtdDailyCsv (backward compatible).
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
    const resolved = await resolveWizardMtdFromFormData(formData, { userId: session.user.id, clientId: id });
    if (!resolved.ok) {
      return NextResponse.json(resolved.body, { status: resolved.status });
    }
    const { parsed: mtdParsed } = resolved.data;
    const platform = mtdParsed.platform;
    const selectedCampaigns = formData ? parseJsonFormField(formData, "selectedCampaigns", selectedCampaignsSchema) : undefined;

    const rowsForObjective = filterRowsByCampaigns(mtdParsed.rows, selectedCampaigns ?? null);
    const googleObjectiveKey = platform === "GOOGLE" ? googleObjectiveKeyFromHeaders(mtdParsed.headers) : undefined;
    const googleLabels = googleSlideObjectiveLabels(googleObjectiveKey ?? "search");

    const objectiveCache = parseObjectiveCache(client.campaignObjectiveCache);
    const campaignObjectiveEntries: [
      string,
      { resultLabel: string; costLabel: string; confidence: "cached" | "high" | "medium" | "low" | "verify"; requiresConfirmation: boolean },
    ][] = Array.from(buildCampaignObjectiveMapWithConfidence(rowsForObjective)).map(([name, detected]) => {
      if (platform === "GOOGLE") {
        return [name, { ...googleLabels, confidence: "high" as const, requiresConfirmation: false }];
      }
      const cached = lookupCachedObjective(objectiveCache, name);
      if (cachedObjectiveAgreesWithDetection(cached, detected)) {
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

    const perCampaignSelection: Record<string, SelectedMetric[]> = {};
    const perCampaignAvailable: Record<string, SelectedMetric[]> = {};

    for (const [normalizedName, info] of Object.entries(campaignObjectives)) {
      const bundle = buildCampaignMetricBundle(
        platform,
        mtdParsed.headers,
        info.resultLabel,
        info.costLabel,
        googleObjectiveKey,
      );
      perCampaignSelection[normalizedName] = bundle.selection;
      perCampaignAvailable[normalizedName] = bundle.available;
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

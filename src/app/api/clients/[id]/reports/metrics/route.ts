import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import type { NreRow } from "@/lib/nre/columns";
import { validateMtdDailyCsv } from "@/lib/nre/validate";
import { validateGoogleAdsCsv } from "@/lib/nre/validate-google";
import { detectPlatform, readGoogleRowsWithAutoMap } from "@/lib/nre/google-columns";
import { filterRowsByCampaigns } from "@/lib/nre/campaigns";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "@/lib/nre/objective";
import { parseObjectiveCache, lookupCachedObjective } from "@/lib/nre/objective-cache";
import { detectGoogleObjectiveKey } from "@/lib/nre/detect-objective";
import { defaultGoogleSelection, defaultMetaSelection, listSelectableMetrics, objectiveMetricKeys, type SelectedMetric } from "@/lib/nre/available-metrics";
import { filterMetricsForCampaignObjective } from "@/lib/nre/slot-assignment";
import { aggregateDynamicMetrics } from "@/lib/nre/dynamic-metrics";
import { apiErrorResponse } from "@/lib/api-error";
import { fileFromFormData } from "@/lib/http-file";
import { parseJsonFormField, platformSchema, selectedCampaignsSchema } from "@/lib/validators/report-wizard";

/**
 * Part 3's optional Metric Review wizard step: run AFTER campaign selection
 * (so the engine knows which campaigns are actually being reported on and
 * can pick the right objective-based default), BEFORE dates — no
 * date-filtered data exists yet at this point.
 *
 * Meta's response is entirely per-campaign (Step 4 rebuild): each selected
 * campaign gets its own `defaultMetaSelection` call using THAT campaign's
 * own confirmed objective (never an account-wide union across every
 * objective present), returned as `perCampaignSelection`, plus its own
 * "add a metric" pool (`perCampaignAvailable` — objective-relevant/generic-
 * secondary CSV columns not already pre-selected, filtered to ones with a
 * real non-zero value for THAT campaign specifically). Both are keyed by
 * objective.ts's normalizeCampaignName, matching campaignObjectives' own
 * key convention. `perCampaignAvailable`'s non-zero check is the one place
 * this route aggregates real numbers — everywhere else it only deals in
 * metric LABELS, since no date range is chosen yet at this point in the
 * wizard (see available-metrics.ts's own file header); the full uploaded
 * CSV is the closest available proxy.
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
    // actually looking at the campaign, not an inference from column data.
    // Every other campaign keeps the engine's own detection (Priority
    // 1/RESULT_TYPE_MAP text match = "resultType", everything else =
    // "columnData") so the wizard can show the right confidence badge.
    const objectiveCache = parseObjectiveCache(client.campaignObjectiveCache);
    const campaignObjectiveEntries: [string, { resultLabel: string; costLabel: string; source: "cached" | "resultType" | "columnData" }][] = Array.from(
      buildCampaignObjectiveMapWithConfidence(rowsForObjective),
    ).map(([name, detected]) => {
      const cached = lookupCachedObjective(objectiveCache, name);
      if (cached) {
        return [name, { resultLabel: cached.resultLabel, costLabel: cached.costLabel, source: "cached" }];
      }
      return [
        name,
        {
          resultLabel: detected.resultLabel,
          costLabel: detected.costLabel,
          source: detected.confidence === "high" ? "resultType" : "columnData",
        },
      ];
    });
    const campaignObjectives = Object.fromEntries(campaignObjectiveEntries);

    // Step 4 rebuild — each campaign gets its OWN correct pre-selected 8
    // metrics, from defaultMetaSelection called with THAT campaign's own
    // confirmed objective (never an account-wide union) — a campaign whose
    // objective is META FORM LEADS never sees another campaign's WEBSITE
    // LEADS pair in its own pre-selected list, and vice versa.
    const rowsByCampaign = new Map<string, NreRow[]>();
    for (const row of rowsForObjective) {
      const name = normalizeCampaignName(row.campaign_name);
      const group = rowsByCampaign.get(name);
      if (group) group.push(row);
      else rowsByCampaign.set(name, [row]);
    }

    const fullPool = listSelectableMetrics(mtdParsed.headers, "META");
    const perCampaignSelection: Record<string, SelectedMetric[]> = {};
    const perCampaignAvailable: Record<string, SelectedMetric[]> = {};

    for (const [normalizedName, info] of Object.entries(campaignObjectives)) {
      // defaultMetaSelection reuses the dictionary's own generic "results"/
      // "cost_per_result" keys (just relabeled) for every non-dedicated
      // objective (WEBSITE LEADS, PURCHASES, APP INSTALLS, ...) — fine when
      // there's only one flat account-wide selection, but two DIFFERENT
      // selected campaigns with two different non-dedicated objectives
      // would then collide under the identical "results" key once the
      // wizard unions every campaign's own metric objects into one
      // selectedMetrics payload (report-data.ts's key-based override
      // resolution needs each distinct label to have its own key — see
      // currentSelectedMetricsPayload's own comment in the wizard).
      // objectiveMetricKeys already derives exactly the right unique
      // synthetic key per objective (report-data.ts's computeMetaSlideMetrics
      // populates baselineValues under this same key for a non-dedicated
      // campaignObjective, so this remap needs no report-data.ts change) —
      // reusing it here keeps every campaign's own pair collision-free. A
      // "dedicated" objective (REACH/LINK CLICKS/VIDEO VIEWS) already uses a
      // real, distinct dictionary key from defaultMetaSelection itself, so
      // it's left untouched.
      const { resultKey, costKey, dedicated } = objectiveMetricKeys(info.resultLabel);
      const preSelected = defaultMetaSelection(info.resultLabel, info.costLabel, mtdParsed.headers).map((m) => {
        if (dedicated) return m;
        if (m.key === "results") return { ...m, key: resultKey };
        if (m.key === "cost_per_result") return { ...m, key: costKey };
        return m;
      });
      perCampaignSelection[normalizedName] = preSelected;

      // "Add metric" pool (Step 4 spec): relevant to this campaign's own
      // objective OR a generic secondary (filterMetricsForCampaignObjective,
      // minCount 0 — no dropped-metric padding wanted here, just the real
      // relevance filter), not already pre-selected for this campaign, AND
      // present with a real non-zero aggregated value across THIS
      // campaign's own raw rows (no date range chosen yet at this point in
      // the wizard, so this checks across the full uploaded CSV — the
      // closest available proxy; see aggregateDynamicMetrics).
      const selectedKeys = new Set(preSelected.map((m) => m.key));
      const relevant = filterMetricsForCampaignObjective(fullPool, { resultLabel: info.resultLabel, costLabel: info.costLabel }, 0).filter(
        (m) => !selectedKeys.has(m.key),
      );
      const campaignRows = rowsByCampaign.get(normalizedName) ?? [];
      const aggregated = aggregateDynamicMetrics(campaignRows, relevant, "meta");
      perCampaignAvailable[normalizedName] = relevant.filter((m) => {
        const value = aggregated[m.key];
        return value !== undefined && !Number.isNaN(value) && value > 0;
      });
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

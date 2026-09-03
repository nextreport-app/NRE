import { z } from "zod";

export const DATE_SELECTION_MODES = ["last7", "prev7", "custom"] as const;

export const dateSelectionSchema = z
  .object({
    mode: z.enum(DATE_SELECTION_MODES),
    customStart: z.string().trim().min(1).optional(),
    customEnd: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.mode !== "custom" || (v.customStart && v.customEnd), {
    message: "customStart and customEnd are required when mode is 'custom'.",
  });

export type DateSelection = z.infer<typeof dateSelectionSchema>;

export const selectedCampaignsSchema = z.array(z.string());

// Persisted shape of Client.lastDeselectedCampaigns — the full campaign
// list from the upload that saved it, alongside the excluded subset. Both
// are needed (not just the excluded set) to tell a genuinely new campaign
// apart from one that was always there and simply never excluded — see
// campaigns.ts's resolveCampaignSelection, which is what actually reads
// this shape.
export const campaignSelectionMemorySchema = z.object({
  campaigns: z.array(z.string()),
  deselected: z.array(z.string()),
});

// Ad set entries are composite "campaign adset" keys from ad-sets.ts's
// adSetKey() — same selected/excluded distinction as campaigns above.
export const selectedAdSetsSchema = z.array(z.string());
export const deselectedAdSetsSchema = z.array(z.string());

export const reportTitleSchema = z.string().trim().min(1).max(100);

// Fix 8 — Monthly Report option; Comparison Report added later. Matches
// prisma/schema.prisma's ReportType enum. Absent/undefined (an older
// client, or a request that never sends it) means "WEEKLY" everywhere this
// is consumed — see buildReportData's own default. "COMPARISON" routes to
// an entirely separate pipeline (buildComparisonReportData/
// renderComparisonPptx) rather than buildReportData/renderPptx — see the
// generate/preview routes, which branch on this value before either path.
//
// "PREVIOUS_MONTH_SUMMARY" is the one value that does NOT match the Prisma
// enum — it's a request-only routing signal for the generate route's own
// dedicated branch (buildPreviousMonthSummaryReportData), used when the
// uploaded CSV has no usable current-period data but the client has
// Previous Month Data on file (see validate.ts's noCampaignData and
// report-upload-wizard.tsx's PreviousMonthSummaryOption). The generated
// Report row is still stored with reportType "MONTHLY" — the closest real
// enum value — never this literal; no database/schema change needed.
export const reportTypeSchema = z.enum(["WEEKLY", "MONTHLY", "DAILY", "COMPARISON", "CREATIVE", "PREVIOUS_MONTH_SUMMARY"]);

/** Wizard Step 5 report types (excludes generate-only PREVIOUS_MONTH_SUMMARY). */
export type WizardReportType = Exclude<z.infer<typeof reportTypeSchema>, "PREVIOUS_MONTH_SUMMARY">;

// Matches prisma/schema.prisma's Platform enum. Absent/undefined means the
// server falls back to auto-detection from the CSV's own headers (see
// lib/nre/google-columns.ts's detectPlatform) — sent explicitly only when
// the wizard's user has manually overridden the detected platform.
export const platformSchema = z.enum(["META", "GOOGLE"]);

/** Wizard data source — CSV upload vs API sync. */
export const dataSourceSchema = z.enum(["csv", "api"]);

export const metaAdAccountIdSchema = z.string().trim().min(1);
export const googleCustomerIdSchema = z.string().trim().min(1);

// Comparison Report's two wizard-picked date windows — plain ISO dates,
// same shape as lib/nre/date-range.ts's own DateRangeIso (not imported
// directly: that module pulls in the NRE engine's CSV-parsing types, which
// this validators file otherwise stays independent of). Both required
// together — there's no "half a comparison" request.
export const comparisonPeriodSchema = z.object({
  startIso: z.string().trim().min(1),
  endIso: z.string().trim().min(1),
});

// Part 3 — one metric card, as picked in the wizard's optional Metric
// Review step. Matches available-metrics.ts's SelectedMetric shape
// (validated independently here rather than importing that module, same
// "stay independent of the NRE engine's own types" reasoning as
// comparisonPeriodSchema above). `format`/`perUnitOf`/`perUnitScale` all
// come straight from a dictionary lookup, never typed by hand in the
// browser, but are still validated here since the request body is
// untrusted regardless of source.
export const selectedMetricSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  format: z.enum(["currency", "number", "percentage", "duration", "ratio", "text"]),
  csvName: z.string().trim().min(1),
  perUnitOf: z.string().trim().min(1).optional(),
  perUnitScale: z.number().optional(),
});

// Part 4's own cap (available-metrics.ts's MAX_TOTAL_METRICS) — validated
// again here at the request boundary rather than trusted from the client.
export const selectedMetricsSchema = z.array(selectedMetricSchema).max(16);

// Objective Confirmation wizard step's output — user-reviewed/corrected
// per-campaign objectives, keyed by normalized campaign name (matches
// objective.ts's normalizeCampaignName and buildCampaignObjectiveMap's own
// Map<string, ResultLabels> shape, serialized as a plain object for JSON
// transport — see report-data.ts's own campaignObjectives field). Every
// campaign is optional; a campaign absent from this object simply keeps
// its engine-detected objective.
export const objectiveInfoSchema = z.object({
  resultLabel: z.string().trim().min(1),
  costLabel: z.string().trim().min(1),
});
export const campaignObjectivesSchema = z.record(z.string(), objectiveInfoSchema);

// Step 4 Section B (Per Campaign Customisation) — a user-edited campaign's
// explicit final metric-key list, keyed by normalized campaign name (same
// convention as campaignObjectivesSchema above; see report-data.ts's
// campaignMetricOverrides doc comment for the hard-replacement semantics).
// A campaign absent from this object keeps the automatic per-objective
// filtering, unchanged.
export const campaignMetricOverridesSchema = z.record(z.string(), z.array(z.string().trim().min(1)));

// Objective Confirmation memory cache (Part 3) — every campaign shown on
// the Objective Confirmation step (cached pre-fills, untouched engine
// detections, and user edits alike), sent only on the final generate
// request so the client's campaignObjectiveCache (objective-cache.ts) can
// be updated in the background after the report finishes. Distinct from
// campaignObjectivesSchema above (which carries only the touched/cached
// subset actually used to BUILD this report) — this one additionally
// requires `key` (result-type-map.ts's stable machine identifier), which
// the cache stores so it can round-trip losslessly on the next report.
export const confirmedObjectiveSchema = objectiveInfoSchema.extend({
  key: z.string().trim().min(1),
});
export const confirmedCampaignObjectivesSchema = z.record(z.string(), confirmedObjectiveSchema);

/** Parses a FormData field expected to hold a JSON-encoded value, returning `undefined` if absent/blank/invalid. */
export function parseJsonFormField<T>(formData: FormData, field: string, schema: z.ZodType<T>): T | undefined {
  const raw = formData.get(field);
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

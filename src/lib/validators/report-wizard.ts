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

// Fix 8 — Monthly Report option. Matches prisma/schema.prisma's ReportType
// enum. Absent/undefined (an older client, or a request that never sends
// it) means "WEEKLY" everywhere this is consumed — see
// buildReportData's own default.
export const reportTypeSchema = z.enum(["WEEKLY", "MONTHLY"]);

// Matches prisma/schema.prisma's Platform enum. Absent/undefined means the
// server falls back to auto-detection from the CSV's own headers (see
// lib/nre/google-columns.ts's detectPlatform) — sent explicitly only when
// the wizard's user has manually overridden the detected platform.
export const platformSchema = z.enum(["META", "GOOGLE"]);

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

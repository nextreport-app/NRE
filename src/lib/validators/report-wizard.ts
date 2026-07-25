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
// Same shape, different meaning — used where the persisted preference is
// the EXCLUDED set (see Client.lastDeselectedCampaigns's schema comment).
export const deselectedCampaignsSchema = z.array(z.string());

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

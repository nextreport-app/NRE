import { z } from "zod";

export const accountSettingsSchema = z.object({
  agencyName: z.string().trim().max(150).optional().transform((v) => (v ? v : null)),
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

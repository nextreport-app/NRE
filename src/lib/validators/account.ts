import { z } from "zod";

export const DEFAULT_GOOGLE_DRIVE_FOLDER_NAME = "NextReport Reports";

// Each field is genuinely optional here — the PATCH route treats "key
// absent from the request body" as "leave this field alone" (a partial
// update), distinct from "sent as empty," which is why agencyName's
// transform preserves `undefined` rather than always producing
// `string | null`. Account settings has two independently-saving sections
// (agency branding, Google Drive auto-save) that both PATCH this same
// endpoint, so one section's save must never blank out the other's fields.
export const accountSettingsSchema = z.object({
  agencyName: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  googleDriveEnabled: z.boolean().optional(),
  googleDriveFolderName: z.string().trim().min(1).max(200).optional(),
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

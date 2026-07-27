import { z } from "zod";

export const DEFAULT_GOOGLE_DRIVE_FOLDER_NAME = "NextReport Reports";

export const GOOGLE_DRIVE_MODES = ["auto", "root-folder", "ask"] as const;

// Each field is genuinely optional here — the PATCH route treats "key
// absent from the request body" as "leave this field alone" (a partial
// update), distinct from "sent as empty," which is why agencyName's
// transform preserves `undefined` rather than always producing
// `string | null`. Account settings has multiple independently-saving
// sections (agency branding, Google Drive auto-save toggle, Drive
// Destination mode) that all PATCH this same endpoint, so one section's
// save must never blank out another's fields.
//
// googleDriveRootFolderId/Name use `nullable().optional()` rather than
// agencyName's plain-string transform: `undefined` still means "leave
// alone," but `null` is a real, distinct input here (explicitly clearing
// the picked root folder when switching Drive Destination mode away from
// "root-folder"), not just "field omitted."
export const accountSettingsSchema = z.object({
  agencyName: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  googleDriveEnabled: z.boolean().optional(),
  googleDriveFolderName: z.string().trim().min(1).max(200).optional(),
  googleDriveMode: z.enum(GOOGLE_DRIVE_MODES).optional(),
  googleDriveRootFolderId: z.string().trim().min(1).nullable().optional(),
  googleDriveRootFolderName: z.string().trim().min(1).nullable().optional(),
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

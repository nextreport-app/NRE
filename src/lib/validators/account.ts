import { z } from "zod";
import type { ReportBrandingMode } from "@/lib/report-branding";

const webhookUrlField = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const reportBrandingModeSchema = z
  .enum(["nextreport", "agency", "hidden"])
  .optional() satisfies z.ZodType<ReportBrandingMode | undefined>;

export const accountSettingsSchema = z
  .object({
    agencyName: z
      .string()
      .trim()
      .max(150)
      .optional()
      .transform((v) => (v === undefined ? undefined : v || null)),
    reportBrandingMode: reportBrandingModeSchema,
    reportRetentionDays: z.coerce.number().int().positive().optional(),
    slackWebhookUrl: webhookUrlField,
    automationWebhookUrl: webhookUrlField,
  })
  .superRefine((data, ctx) => {
    if (data.reportBrandingMode === "agency" && data.agencyName !== undefined && !data.agencyName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your agency name to show it on client reports.",
        path: ["agencyName"],
      });
    }
  });

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

export const integrationSettingsSchema = z.object({
  slackWebhookUrl: webhookUrlField,
  automationWebhookUrl: webhookUrlField,
});

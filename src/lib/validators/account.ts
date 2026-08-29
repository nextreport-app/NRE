import { z } from "zod";

const webhookUrlField = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

export const accountSettingsSchema = z.object({
  agencyName: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  slackWebhookUrl: webhookUrlField,
  automationWebhookUrl: webhookUrlField,
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

export const integrationSettingsSchema = z.object({
  slackWebhookUrl: webhookUrlField,
  automationWebhookUrl: webhookUrlField,
});

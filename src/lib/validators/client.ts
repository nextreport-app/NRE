import { z } from "zod";

export const CURRENCIES = ["INR", "USD", "GBP", "AUD", "CAD", "AED"] as const;
export const TEMPLATES = [
  "DARK",
  "LIGHT",
  "EMERALD",
  "PURPLE",
  "CRIMSON",
  "GRAPHITE",
] as const;

export const TEMPLATE_LABELS: Record<(typeof TEMPLATES)[number], string> = {
  DARK: "Deep Navy (Dark) — primary, most tested",
  LIGHT: "Ice Blue-Grey (Light)",
  EMERALD: "Dark Forest Green (Emerald)",
  PURPLE: "Royal Indigo (Purple)",
  CRIMSON: "Deep Crimson Red (Crimson)",
  GRAPHITE: "Near-Black Graphite",
};

export const TIMEZONES = [
  "Asia/Kolkata",
  "America/Chicago",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Australia/Sydney",
  "Asia/Dubai",
] as const;

export const clientSchema = z.object({
  accountName: z.string().trim().min(1, "Account name is required").max(150),
  currency: z.enum(CURRENCIES),
  timezone: z.string().trim().min(1),
  monthlyBudget: z
    .union([z.number().positive(), z.nan(), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null)),
  template: z.enum(TEMPLATES),
  groqApiKey: z.string().trim().optional().transform((v) => (v ? v : null)),
  geminiApiKey: z.string().trim().optional().transform((v) => (v ? v : null)),
});

export type ClientInput = z.infer<typeof clientSchema>;

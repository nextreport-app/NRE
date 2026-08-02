import { z } from "zod";

// Kept as the full Prisma enum (still required for clientSchema to accept
// existing rows whose currency is one of the 3 disabled values below — see
// SELECTABLE_CURRENCIES for what the form's dropdown actually offers — and
// for CURRENCY_SYMBOLS's Record<Currency, string> to stay exhaustive).
export const CURRENCIES = [
  "INR",
  "USD",
  "GBP",
  "AUD",
  "CAD",
  "AED",
  "NZD",
  "SGD",
  "MYR",
  "PHP",
  "ZAR",
  "BRL",
  "MXN",
  "EUR",
] as const;

// The currencies a client can actually pick going forward — ZAR/BRL/MXN are
// removed from the UI dropdown but stay in the Prisma enum (and CURRENCIES
// above) so an existing client row set to one of them doesn't fail
// validation on unrelated field saves.
export const SELECTABLE_CURRENCIES = CURRENCIES.filter(
  (c) => c !== "ZAR" && c !== "BRL" && c !== "MXN",
);
// Kept as the full Prisma enum (still required for clientSchema to accept
// existing rows that have one of the 4 disabled values — see
// SELECTABLE_TEMPLATES below for what the form's dropdown actually offers).
export const TEMPLATES = [
  "DARK",
  "LIGHT",
  "EMERALD",
  "PURPLE",
  "CRIMSON",
  "GRAPHITE",
] as const;

// The only two templates a client can actually pick going forward — EMERALD/
// PURPLE/CRIMSON/GRAPHITE never had real template assets (see
// lib/pptx/templates.ts's TODO comments) and are removed from the UI, but
// stay in the Prisma enum so an existing client row set to one of them
// doesn't fail validation; report generation falls back to DARK for those
// (lib/pptx/templates.ts's TEMPLATE_FILES already maps them there).
export const SELECTABLE_TEMPLATES = ["DARK", "LIGHT"] as const;

export const TEMPLATE_LABELS: Record<(typeof TEMPLATES)[number], string> = {
  DARK: "Deep Navy (Dark) — primary, most tested",
  LIGHT: "Warm Amber (Light) — premium, warm-tinted",
  EMERALD: "Dark Forest Green (Emerald)",
  PURPLE: "Royal Indigo (Purple)",
  CRIMSON: "Deep Crimson Red (Crimson)",
  GRAPHITE: "Near-Black Graphite",
};

export interface TimezoneOption {
  value: string;
  /** City + local abbreviation, e.g. "New York (EST)" — the region/flag is shown via the enclosing TimezoneGroup, not repeated per option. */
  label: string;
}

export interface TimezoneGroup {
  flag: string;
  region: string;
  zones: TimezoneOption[];
}

/** Grouped by region for the client form's Timezone dropdown (rendered as <optgroup>s) — see client-form.tsx. */
export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  { flag: "🇮🇳", region: "India", zones: [{ value: "Asia/Kolkata", label: "Kolkata (IST)" }] },
  {
    flag: "🇺🇸",
    region: "United States",
    zones: [
      { value: "America/New_York", label: "New York (EST)" },
      { value: "America/Chicago", label: "Chicago (CST)" },
      { value: "America/Denver", label: "Denver (MST)" },
      { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
      { value: "America/Phoenix", label: "Phoenix (AZ)" },
      { value: "America/Anchorage", label: "Anchorage (AKT)" },
    ],
  },
  {
    flag: "🇨🇦",
    region: "Canada",
    zones: [
      { value: "America/Toronto", label: "Toronto (EST)" },
      // Calgary has no zone of its own in the IANA tz database — Mountain
      // Time Alberta (Calgary, Edmonton) is canonically America/Edmonton,
      // which is what Intl/date libraries actually recognize.
      { value: "America/Edmonton", label: "Calgary (MST)" },
      { value: "America/Vancouver", label: "Vancouver (PST)" },
      { value: "America/Halifax", label: "Halifax (AST)" },
    ],
  },
  { flag: "🇬🇧", region: "United Kingdom", zones: [{ value: "Europe/London", label: "London (GMT/BST)" }] },
  {
    flag: "🇦🇺",
    region: "Australia",
    zones: [
      { value: "Australia/Sydney", label: "Sydney (AEST)" },
      { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
      { value: "Australia/Perth", label: "Perth (AWST)" },
    ],
  },
  { flag: "🇳🇿", region: "New Zealand", zones: [{ value: "Pacific/Auckland", label: "Auckland (NZST)" }] },
  { flag: "🇦🇪", region: "UAE", zones: [{ value: "Asia/Dubai", label: "Dubai (GST)" }] },
  { flag: "🇸🇬", region: "Singapore", zones: [{ value: "Asia/Singapore", label: "Singapore (SGT)" }] },
  {
    flag: "🇹🇭",
    region: "Thailand / Vietnam / Indonesia",
    zones: [{ value: "Asia/Bangkok", label: "Bangkok (ICT)" }],
  },
  { flag: "🇵🇭", region: "Philippines", zones: [{ value: "Asia/Manila", label: "Manila (PHT)" }] },
];

/** Flattened valid timezone values, derived from TIMEZONE_GROUPS — used wherever a flat list is more convenient than the grouped one. */
export const TIMEZONES = TIMEZONE_GROUPS.flatMap((g) => g.zones.map((z) => z.value));

export const clientSchema = z.object({
  accountName: z.string().trim().min(1, "Account name is required").max(150),
  currency: z.enum(CURRENCIES),
  timezone: z.string().trim().min(1),
  monthlyBudget: z
    .union([z.number().positive(), z.nan(), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null)),
  template: z.enum(TEMPLATES),
});

export type ClientInput = z.infer<typeof clientSchema>;

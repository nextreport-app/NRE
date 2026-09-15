/**
 * GA4 website report client-kind dictionary — parallel to meta-objective-dictionary.
 * GA4 has no per-campaign ad objectives; site type (ecommerce / lead gen / content / saas)
 * drives which conversion metrics appear in website reports.
 */

export type WebsiteClientKind = "lead_gen" | "ecommerce" | "hybrid" | "content" | "saas";

/** Minimal totals shape for client-kind auto-detection. */
export interface Ga4ClientKindTotals {
  purchaseRevenue: number;
  transactions: number;
  conversions: number;
}

export interface Ga4ClientKindSpec {
  key: WebsiteClientKind;
  label: string;
  description: string;
  /** Lower number = checked first. */
  detectionPriority: number;
  detect: (totals: Ga4ClientKindTotals) => boolean;
}

export const GA4_CLIENT_KIND_SPECS: readonly Ga4ClientKindSpec[] = [
  {
    key: "hybrid",
    label: "Ecommerce & leads",
    description: "Both purchase revenue/transactions and key-event conversions.",
    detectionPriority: 10,
    detect: (t) => (t.purchaseRevenue > 0 || t.transactions > 0) && t.conversions > 0,
  },
  {
    key: "ecommerce",
    label: "Ecommerce",
    description: "Revenue and transaction metrics without separate conversion signals.",
    detectionPriority: 20,
    detect: (t) => t.purchaseRevenue > 0 || t.transactions > 0,
  },
  {
    key: "lead_gen",
    label: "Lead generation",
    description: "Key events / conversions without ecommerce revenue.",
    detectionPriority: 30,
    detect: (t) => t.conversions > 0,
  },
  {
    key: "saas",
    label: "SaaS / product",
    description: "Manual override only — not auto-detected from totals.",
    detectionPriority: 40,
    detect: () => false,
  },
  {
    key: "content",
    label: "Content / awareness",
    description: "Default when no conversions or revenue signals exist.",
    detectionPriority: 999,
    detect: () => true,
  },
];

export function detectGa4ClientKind(totals: Ga4ClientKindTotals): WebsiteClientKind {
  const sorted = [...GA4_CLIENT_KIND_SPECS].sort((a, b) => a.detectionPriority - b.detectionPriority);
  for (const spec of sorted) {
    if (spec.key === "content") continue;
    if (spec.detect(totals)) return spec.key;
  }
  return "content";
}

export function ga4ClientKindSpec(key: WebsiteClientKind): Ga4ClientKindSpec {
  return GA4_CLIENT_KIND_SPECS.find((s) => s.key === key) ?? GA4_CLIENT_KIND_SPECS[GA4_CLIENT_KIND_SPECS.length - 1];
}

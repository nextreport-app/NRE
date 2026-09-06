/**
 * Maps WebsiteReportData metric cards onto the campaign template's 8 card slots.
 */

import type { DynamicMetricValue } from "@/lib/nre/dynamic-metrics";
import type { MetricFormat } from "@/lib/nre/meta-dictionary";
import type { WebsiteMetricCard } from "@/lib/nre/website-report-data";

function inferFormat(card: WebsiteMetricCard): MetricFormat {
  const key = card.key.toLowerCase();
  const label = card.label.toLowerCase();
  if (key.includes("rate") || label.includes("rate") || label.includes("bounce")) return "percentage";
  if (key.includes("revenue") || key.includes("aov") || label.includes("revenue")) return "currency";
  if (key.includes("duration") || label.includes("duration") || label.includes("engagement time")) return "duration";
  return "number";
}

function slotKey(card: WebsiteMetricCard): string {
  const key = card.key.toLowerCase();
  if (key.includes("session") && !key.includes("rate")) return "sessions";
  if (key.includes("user")) return "users";
  if (key.includes("conversion")) return "conversions";
  if (key.includes("revenue") || key.includes("aov")) return "revenue";
  if (key.includes("rate") || key.includes("bounce")) return "engagement_rate";
  if (key.includes("duration") || key.includes("engagement")) return "duration";
  if (key.includes("page")) return "pageviews";
  return key.replace(/[^a-z0-9]+/g, "_");
}

/** Exactly 8 slots — null pads when fewer metrics are provided. */
export function websiteMetricsToDynamicSlots(cards: WebsiteMetricCard[]): (DynamicMetricValue | null)[] {
  const slots: (DynamicMetricValue | null)[] = cards.slice(0, 8).map((card) => ({
    key: slotKey(card),
    label: card.label.toUpperCase(),
    format: inferFormat(card),
    value: card.value,
  }));
  while (slots.length < 8) slots.push(null);
  return slots;
}

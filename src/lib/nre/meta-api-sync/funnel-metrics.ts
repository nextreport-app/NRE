import type { MetaInsightRow } from "@/lib/meta-api";
import { ServiceError } from "@/lib/service-error";

/** Website evidence first; broader aliases are alternatives, never additional conversions. */
const FUNNEL_EVENTS = [
  {
    header: "Adds to cart",
    aliases: [
      "offsite_conversion.fb_pixel_add_to_cart",
      "onsite_web_add_to_cart",
      "onsite_web_app_add_to_cart",
      "add_to_cart",
      "omni_add_to_cart",
      "onsite_conversion.add_to_cart",
    ],
  },
  {
    header: "Initiate checkout",
    aliases: [
      "offsite_conversion.fb_pixel_initiate_checkout",
      "onsite_web_initiate_checkout",
      "onsite_web_app_initiate_checkout",
      "initiate_checkout",
      "omni_initiated_checkout",
      "onsite_conversion.initiate_checkout",
    ],
  },
] as const;

function eventCount(
  row: MetaInsightRow,
  aliases: readonly string[],
): string | null {
  for (const alias of aliases) {
    for (const channel of ["actions", "conversions"] as const) {
      const entries =
        row[channel]?.filter((item) => item.action_type === alias) ?? [];
      if (!entries.length) continue;
      const counts = entries.map((item) => Number(item.value));
      if (
        entries.some((item) => !String(item.value ?? "").trim()) ||
        counts.some((value) => !Number.isFinite(value) || value < 0) ||
        counts.some((value) => value !== counts[0])
      ) {
        throw new ServiceError(
          "Meta returned invalid or conflicting shopping-event counts. Retry sync; no funnel total has been estimated.",
          422,
        );
      }
      return String(counts[0]);
    }
  }
  return null;
}

/** Keep actual zeroes; absent events stay blank and never become manufactured zeroes. */
export function appendMetaFunnelColumns(
  headers: string[],
  csvRows: string[][],
  insights: MetaInsightRow[],
): void {
  for (const event of FUNNEL_EVENTS) {
    const values = insights.map((row) => eventCount(row, event.aliases));
    if (!values.some((value) => value !== null)) continue;
    headers.push(event.header);
    csvRows.forEach((row, index) => row.push(values[index] ?? ""));
  }
}

import { z } from "zod";
import type { MetaContentOptions, MetaContentSource } from "./types";
export const metaReportSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BREAKDOWN"),
    dimension: z.enum(["age", "location", "placement", "platform"]),
    locationLevel: z.enum(["region", "country"]).optional(),
  }),
  z.object({ kind: z.literal("CREATIVE") }),
]);
export type MetaReportSelection = z.infer<typeof metaReportSelectionSchema>;
export function metaReportTitle(selection: MetaReportSelection): string {
  return selection.kind === "CREATIVE"
    ? "Creative Performance Report"
    : `${{ age: "Age", location: selection.locationLevel === "country" ? "Country" : "Location", placement: "Placement", platform: "Platform" }[selection.dimension]} Breakdown Report`;
}
export function metaReportOptions(
  selection: MetaReportSelection,
): MetaContentOptions {
  return {
    audience: selection.kind === "BREAKDOWN" ? [selection.dimension] : [],
    locationLevel:
      selection.kind === "BREAKDOWN" ? selection.locationLevel : undefined,
    creatives: selection.kind === "CREATIVE",
    includeStandard: false,
    ranking: "cpr",
    minSpend: 0,
    minResults: 5,
  };
}
export function assertMetaReportSource(
  selection: MetaReportSelection,
  source: MetaContentSource,
): void {
  const expected =
    selection.kind === "CREATIVE" ? "creative" : selection.dimension;
  if (
    source.kind !== expected &&
    !(
      source.kind === "platform-placement" &&
      ["platform", "placement"].includes(expected)
    )
  )
    throw Error(
      `Upload the ${expected} CSV selected on Import, or change the report choice.`,
    );
  if (
    selection.kind === "BREAKDOWN" &&
    selection.dimension === "location" &&
    source.locationLevel !== (selection.locationLevel ?? "region")
  )
    throw Error("Include the selected Region or Country breakdown.");
}
export function metaReportRequirement(selection: MetaReportSelection): string {
  if (selection.kind === "CREATIVE")
    return "One Ads-level CSV · Day breakdown · Ad ID + Ad name. Images optional.";
  const names = {
    age: "Age",
    location:
      selection.locationLevel === "country" ? "Country" : "Region/state",
    platform: "Platform",
    placement: "Platform + Placement",
  };
  return `One Campaign-level CSV · Day + ${names[selection.dimension]} breakdown.`;
}

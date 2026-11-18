import type { NreRow } from "./columns";
/** Mapping revision travels with API facts so old zero-filled sessions require a fresh sync. */
export const META_API_RESULT_MAPPING_VERSION = "website-conversions-v2";
export const META_API_RESULT_MAPPING_HEADER = "NRE API result mapping version";

export function hasStaleApplicationApiFacts(rows: NreRow[]): boolean {
  return rows.some(
    (row) =>
      row._raw["NRE API result action"] ===
        "offsite_conversion.fb_pixel_submit_application" &&
      row._raw[META_API_RESULT_MAPPING_HEADER] !==
        META_API_RESULT_MAPPING_VERSION,
  );
}

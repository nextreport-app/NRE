import { describe, expect, it } from "vitest";
import { websiteLeadsFromMetaExportRow } from "../meta-csv-export-counting";

describe("websiteLeadsFromMetaExportRow — Campaigns-table signals", () => {
  it("uses website submission column when Result indicator marks custom conversion", () => {
    const count = websiteLeadsFromMetaExportRow({
      results: "",
      website_leads: "2",
      result_type: "",
      _raw: {
        "Result indicator": "actions:offsite_conversion.custom.446052571654985",
        "website submission": "2",
      },
    });
    expect(count).toBe(2);
  });

  it("prefers Results column when populated", () => {
    const count = websiteLeadsFromMetaExportRow({
      results: "3",
      website_leads: "3",
      result_type: "website submission",
      _raw: {},
    });
    expect(count).toBe(3);
  });
});

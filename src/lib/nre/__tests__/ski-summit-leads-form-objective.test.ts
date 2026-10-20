import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildCampaignCsvResultTypeMap,
  csvResultTypeMatchesDetection,
} from "../campaign-csv-result-type";
import { isWebsiteLeadsCampaignHaystack } from "../campaign-name-heuristics";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";
import { parseCsvText } from "../parse-csv";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ski-summit-leads-form-weekly.csv");

describe("Ski Summit — Leads (form) CSV must not classify as WEBSITE LEADS", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;

  it("does not treat New Leads campaign name as website-leads naming", () => {
    expect(isWebsiteLeadsCampaignHaystack("new leads campaign")).toBe(false);
  });

  it("detects META FORM LEADS from export", () => {
    const map = buildCampaignObjectiveMapWithConfidence(rows);
    const key = normalizeCampaignName("New Leads campaign");
    const detected = map.get(key);
    expect(detected?.resultLabel).toBe("META FORM LEADS");
  });

  it("surfaces CSV Result type for wizard comparison", () => {
    const csvMap = buildCampaignCsvResultTypeMap(rows);
    const key = normalizeCampaignName("New Leads campaign");
    const summary = csvMap.get(key);
    expect(summary?.primary).toBe("Leads (form)");
    expect(summary?.expectedResultLabel).toBe("META FORM LEADS");
    const detected = buildCampaignObjectiveMapWithConfidence(rows).get(key)!;
    expect(csvResultTypeMatchesDetection(summary!, detected.resultLabel)).toBe(true);
  });
});

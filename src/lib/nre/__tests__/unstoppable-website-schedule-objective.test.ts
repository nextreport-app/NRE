import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";
import {
  buildCampaignCsvResultTypeMap,
  csvResultTypeMatchesDetection,
} from "../campaign-csv-result-type";
import { resolveObjectiveFromResultType } from "../result-type-map";

const FIXTURE = resolve(__dirname, "fixtures/dc-unstoppable-website-schedule-weekly.csv");

describe("Unstoppable365 — Website appointments scheduled vs Website_Leads campaign name", () => {
  const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
  const key = normalizeCampaignName("Unstoppable365_Website_Leads");

  it("maps Result type Website appointments scheduled to WEBSITE SCHEDULE", () => {
    expect(resolveObjectiveFromResultType("Website appointments scheduled")?.resultLabel).toBe("WEBSITE SCHEDULE");
  });

  it("engine picks WEBSITE SCHEDULE (not WEBSITE LEADS from campaign name)", () => {
    const detected = buildCampaignObjectiveMapWithConfidence(rows).get(key);
    expect(detected?.resultLabel).toBe("WEBSITE SCHEDULE");
    expect(detected?.confidence).toBe("high");
  });

  it("CSV Result type summary aligns with detection", () => {
    const csvMap = buildCampaignCsvResultTypeMap(rows);
    const summary = csvMap.get(key);
    expect(summary?.primary).toBe("Website appointments scheduled");
    expect(summary?.expectedResultLabel).toBe("WEBSITE SCHEDULE");
    expect(csvResultTypeMatchesDetection(summary!, "WEBSITE SCHEDULE")).toBe(true);
  });
});

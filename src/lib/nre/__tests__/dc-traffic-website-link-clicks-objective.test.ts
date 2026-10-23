import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildCampaignObjectiveMapWithConfidence, normalizeCampaignName } from "../objective";
import {
  buildCampaignCsvResultTypeMap,
  csvResultTypeMatchesDetection,
} from "../campaign-csv-result-type";

const FIXTURE = resolve(__dirname, "fixtures/dc-traffic-website-link-clicks-weekly.csv");

describe("Ad Reporting — TRAFFIC WEBSITE campaign with Link clicks Result type", () => {
  const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
  const key = normalizeCampaignName("DC - TRAFFIC - WEBSITE - Q3 - AUG 2026");

  it("engine picks LINK CLICKS from CSV Result type (not WEBSITE LEADS from name segment WEBSITE)", () => {
    const detected = buildCampaignObjectiveMapWithConfidence(rows).get(key);
    expect(detected?.resultLabel).toBe("LINK CLICKS");

    const summary = buildCampaignCsvResultTypeMap(rows).get(key)!;
    expect(summary.primary).toBe("Link clicks");
    expect(summary.expectedResultLabel).toBe("LINK CLICKS");
    expect(csvResultTypeMatchesDetection(summary, detected!.resultLabel)).toBe(true);
  });
});

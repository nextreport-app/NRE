import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildCampaignObjectiveMap, normalizeCampaignName, resolveCampaignObjectiveWithConfidence } from "../objective";
import { filterRowsByCampaigns } from "../campaigns";
import { isPurchaseCampaignHaystack } from "../campaign-name-heuristics";

const FIXTURE = resolve(__dirname, "fixtures/dream-day-escapes-weekly-oct2026.csv");
const SALES_CAMPAIGN = "DC - Dream Day Escapes | Sales | Campaign #2 | July 2026";
const FORM_CAMPAIGN = "DC - Dream Day Escapes | Instant Form | April 2026";

describe("Dream Day Escapes — Sales segment in campaign name", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;

  it("treats pipe-delimited | Sales | as purchase naming, not brand names like Tractor Sales", () => {
    expect(isPurchaseCampaignHaystack("dc | sales | campaign #2")).toBe(true);
    expect(isPurchaseCampaignHaystack("sherwood tractor sales | lpv campaign")).toBe(false);
  });

  it("detects PURCHASES for Sales campaign when Result type is blank (zero sales week)", () => {
    const campRows = filterRowsByCampaigns(rows, [SALES_CAMPAIGN]);
    expect(campRows.every((r) => !(r.result_type || "").trim())).toBe(true);

    const det = resolveCampaignObjectiveWithConfidence(campRows);
    expect(det.resultLabel).toBe("PURCHASES");
    expect(det.costLabel).toBe("COST PER PURCHASE");
    expect(det.confidence).not.toBe("verify");
  });

  it("still detects META FORM LEADS for Instant Form campaign", () => {
    const campRows = filterRowsByCampaigns(rows, [FORM_CAMPAIGN]);
    const det = resolveCampaignObjectiveWithConfidence(campRows);
    expect(det.resultLabel).toBe("META FORM LEADS");
  });

  it("buildCampaignObjectiveMap assigns PURCHASES to Sales campaign", () => {
    const map = buildCampaignObjectiveMap(rows);
    expect(map.get(normalizeCampaignName(SALES_CAMPAIGN))?.resultLabel).toBe("PURCHASES");
  });
});

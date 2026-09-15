import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { META_OBJECTIVE_REGRESSION_FIXTURES } from "../meta-objective-regression";
import {
  buildCampaignObjectiveMap,
  normalizeCampaignName,
  resolveCampaignObjective,
  resolveCampaignObjectiveWithConfidence,
} from "../objective";
import { parseCsvText } from "../parse-csv";

const FIXTURES_DIR = resolve(process.cwd(), "src/lib/nre/__tests__/fixtures");

const CONFIDENCE_RANK = { verify: 0, low: 1, medium: 2, high: 3 } as const;

describe("Meta objective regression fixtures", () => {
  it.each(META_OBJECTIVE_REGRESSION_FIXTURES.map((f) => [f.id, f] as const))(
    "%s — per-campaign objectives match manifest",
    (_id, fixture) => {
      const csvPath = resolve(FIXTURES_DIR, fixture.file);
      const { rows } = parseCsvText(readFileSync(csvPath, "utf8"));
      const objectiveMap = buildCampaignObjectiveMap(rows);

      for (const expected of fixture.campaigns) {
        const key = normalizeCampaignName(expected.campaignName);
        const detected = objectiveMap.get(key);
        expect(detected, `${expected.campaignName} missing from map`).toBeDefined();
        expect(detected?.resultLabel).toBe(expected.resultLabel);

        const campRows = rows.filter((r) => normalizeCampaignName(r.campaign_name ?? "") === key);
        expect(resolveCampaignObjective(campRows).resultLabel).toBe(expected.resultLabel);

        if (expected.minConfidence) {
          const resolution = resolveCampaignObjectiveWithConfidence(campRows);
          expect(CONFIDENCE_RANK[resolution.confidence]).toBeGreaterThanOrEqual(
            CONFIDENCE_RANK[expected.minConfidence],
          );
        }
      }
    },
  );

  it("manifest covers every major Meta objective family", () => {
    const labels = new Set(
      META_OBJECTIVE_REGRESSION_FIXTURES.flatMap((f) => f.campaigns.map((c) => c.resultLabel)),
    );
    const required = [
      "WEBSITE LEADS",
      "META FORM LEADS",
      "MESSAGING / CONVERSATIONS",
      "PURCHASES",
      "INITIATE CHECKOUT",
      "ADD TO CART",
      "PHONE CALLS",
      "WHATSAPP LEADS",
      "INSTAGRAM DM LEADS",
      "REGISTRATIONS",
      "APP INSTALLS",
      "REACH",
      "LANDING PAGE VIEWS",
      "LINK CLICKS",
      "VIDEO VIEWS",
      "IMPRESSIONS",
      "AD RECALL LIFT",
      "EVENT RESPONSES",
      "STORE VISITS",
    ];
    for (const label of required) {
      expect(labels.has(label), `missing regression coverage for ${label}`).toBe(true);
    }
  });
});

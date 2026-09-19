import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import {
  buildCampaignObjectiveMapWithConfidence,
  resolveCampaignObjectiveWithConfidence,
} from "../objective";
import { resolveObjectiveFromResultType } from "../result-type-map";

const WEEKLY_CSV_PATH = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/bumpertech-sep-weekly-quote-requests.csv",
);

describe("BumperTech September weekly — Quote Request Submitted first-upload detection", () => {
  const { rows } = parseCsvText(readFileSync(WEEKLY_CSV_PATH, "utf8"));
  const retargetRows = rows.filter((r) => r.campaign_name === "Re-Targeting Quote Requests");

  it("maps Quote Request Submitted via exact result_type lookup", () => {
    expect(resolveObjectiveFromResultType("Quote Request Submitted")?.resultLabel).toBe("QUOTE REQUESTS");
  });

  it("detects Re-Targeting Quote Requests from result_type on first upload (not LPV column noise)", () => {
    expect(retargetRows.length).toBeGreaterThan(0);
    expect(retargetRows.every((r) => r.result_type === "Quote Request Submitted")).toBe(true);

    const detected = resolveCampaignObjectiveWithConfidence(retargetRows);
    expect(detected.resultLabel).toBe("QUOTE REQUESTS");
    expect(detected.confidence).toBe("high");
    expect(detected.requiresConfirmation).toBe(false);
  });

  it("buildCampaignObjectiveMapWithConfidence keeps quote campaigns out of LANDING PAGE VIEWS", () => {
    const map = buildCampaignObjectiveMapWithConfidence(rows);
    const retarget = map.get("re-targeting quote requests");
    expect(retarget?.resultLabel).toBe("QUOTE REQUESTS");
    expect(retarget?.resultLabel).not.toBe("LANDING PAGE VIEWS");
  });
});

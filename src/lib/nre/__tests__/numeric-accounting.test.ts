import { describe, expect, it } from "vitest";
import { aggregateNumericFacts } from "../numeric-accounting";
import { aggregateRows } from "../aggregate";
import { buildCampaignObjectiveMap, resultValueForObjective, aggregateObjectiveRows } from "../objective";
import { parseCsvText } from "../parse-csv";

describe("pure numeric accounting and retained observations", () => {
  const facts = [
    { spend: 100, impressions: 1000, clicksAll: 100, results: 2 },
    { spend: 20, impressions: 9000, clicksAll: 90, results: 0 },
  ];
  it("derives all rates from components, including spend on zero-result days", () => {
    expect(aggregateNumericFacts(facts)).toMatchObject({ spend: 120, results: 2, cpr: 60, ctr: 1.9, cpc: 120 / 190 });
    expect(aggregateNumericFacts([...facts].reverse())).toEqual(aggregateNumericFacts(facts));
  });
  it("does not manufacture a zero cost for an undefined denominator", () => {
    expect(aggregateNumericFacts([{ spend: 10, impressions: 0, clicksAll: 0, results: 0 }])).toMatchObject({ cpr: null, ctr: null, cpc: null });
    expect(() => aggregateNumericFacts([{ spend: NaN, impressions: 0, clicksAll: 0, results: 0 }])).toThrow("Non-finite");
  });
  it("retains Results and objective evidence through an ad-set rollup", () => {
    const rows = parseCsvText("Campaign name,Ad set name,Day,Result type,Results,Amount spent,Website leads,Purchases\nA,S,2026-10-01,Website purchases,2,100,1,2\nA,S,2026-10-02,Website purchases,0,20,1,0").rows;
    const rolled = aggregateRows(rows);
    expect(rolled[0].sourceRows).toEqual(rows);
    expect(buildCampaignObjectiveMap(rolled).get("a")?.resultLabel).toBe("PURCHASES");
    expect(resultValueForObjective(rolled[0], "PURCHASES")).toBe(2);
    expect(aggregateObjectiveRows(rows, "PURCHASES")).toEqual(aggregateObjectiveRows(rolled, "PURCHASES"));
    // Duplicates must be rejected by source validation, not silently removed
    // from only the result denominator while spend still includes them.
    expect(aggregateObjectiveRows([...rolled, ...rolled], "PURCHASES").results).toBe(4);
  });
  it("keeps explicit checkout Results over secondary tracking values", () => {
    const rows = parseCsvText("Campaign name,Ad set name,Day,Result type,Results,Amount spent,Initiate checkout\nA,S,2026-10-01,Initiate checkout,2,100,999\nA,S,2026-10-02,Initiate checkout,0,20,999").rows;
    expect(aggregateObjectiveRows(rows, "INITIATE CHECKOUT")).toMatchObject({ results: 2, cpr: 60 });
  });
});

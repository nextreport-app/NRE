import { metricNumber } from "../meta-report-content/format";
import {
  verifyMetaContentTotals,
  mergeMetaVerification,
} from "../meta-report-content/verification";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import {
  parseMetaContentSource,
  buildMetaContentPresentation,
} from "../meta-report-content/data";
import type {
  MetaReportContent,
  MetaContentOptions,
} from "../meta-report-content/types";
const options: MetaContentOptions = {
  audience: ["age"],
  creatives: false,
  includeStandard: true,
  ranking: "cpr",
  minSpend: 0,
  minResults: 5,
};
const range = { startIso: "2026-11-10", endIso: "2026-11-11" };
const headers =
  "Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Clicks (all),Results,Result type";
function source(extra: string, values: string[]) {
  return parseMetaContentSource(
    parseCsvText(`${headers},${extra}\n${values.join("\n")}`),
    "USD",
  );
}
function content(
  sources: MetaReportContent["sources"],
  overrides: Partial<MetaContentOptions> = {},
): MetaReportContent {
  return {
    version: 1,
    options: { ...options, ...overrides },
    sources,
    media: {},
    notices: [],
  };
}
describe("Meta optional content calculation", () => {
  it("rolls up disjoint device-platform rows without conflating Facebook and Instagram placements", () => {
    const csv = [
      "Campaign name,Reporting starts,Reporting ends,Platform,Placement,Device platform,Amount spent (USD),Impressions,Results,Result indicator,Clicks (all)",
      "Example,2026-11-10,2026-11-10,Facebook,Feed,In-app,10,100,2,actions:link_click,4",
      "Example,2026-11-10,2026-11-10,Facebook,Feed,Desktop,2,20,, ,1",
      "Example,2026-11-11,2026-11-11,Facebook,Feed,Mobile web,3,30,1,actions:link_click,2",
      "Example,2026-11-11,2026-11-11,Instagram,Feed,In-app,5,50,2,actions:link_click,3",
    ].join("\n");
    const parsed = parseCsvText(csv);
    const joint = parseMetaContentSource(parsed, "USD");
    expect(joint.rows).toHaveLength(4);
    expect(joint.rows.map(row => row.devicePlatform)).toEqual(["In-app", "Desktop", "Mobile web", "In-app"]);
    const config = content([joint], {audience: ["platform", "placement"]});
    const result = buildMetaContentPresentation(config, [range], null, "$")!;
    const placement = result.pages.find(page => page.kind === "audience" && page.title.startsWith("Placement"))!;
    expect(placement.rows.map(row => row.name)).toEqual(["Facebook · Feed", "Instagram · Feed"]);
    expect(placement.rows[0]).toMatchObject({spend: 15, impressions: 150, results: 3, cpr: 5, ctr: 7 / 150 * 100});
    const platform = result.pages.find(page => page.kind === "audience" && page.title.startsWith("Platform"))!;
    expect(platform.rows[0]).toMatchObject({name: "Facebook", spend: 15, impressions: 150, results: 3});
    expect(verifyMetaContentTotals(config, result, [range], null).status).toBe("ok");
    expect(() => parseMetaContentSource(parseCsvText(csv + "\n" + csv.split("\n")[1]), "USD")).toThrow("duplicate rows");
    for (const deviceTotal of ["", "All devices"]) {
      const total = csv.split("\n")[1].replace(",In-app,", `,${deviceTotal},`);
      expect(() => parseMetaContentSource(parseCsvText(csv + "\n" + total), "USD")).toThrow("overlapping totals");
    }
    const totals = csv.split("\n")[0] + "\n" + csv.split("\n")[1].replace(",In-app,", ",All devices,") + "\n" + csv.split("\n")[1].replace(",In-app,", ",Total,");
    expect(() => parseMetaContentSource(parseCsvText(totals), "USD")).toThrow("duplicate rows");
  });

  it("puts one factual overview before each objective table and excludes it from source accounting", () => {
    const age = source("Age", [
      "Example,Set,2026-11-10,10,100,5,1,Leads (form),25-34",
      "Example,Set,2026-11-11,20,200,10,2,Leads (form),35-44",
    ]);
    const config = content([age]);
    const result = buildMetaContentPresentation(config, [range], null, "$")!;
    expect(result.pages.map(page => page.kind)).toEqual(["summary", "audience"]);
    expect(result.pages[0].rows).toEqual([]);
    expect(result.pages[0].insight).toContain("$30.00");
    expect(result.pages[0].insight).toContain("3 meta form leads");
    expect(result.pages[0].insight).toContain("$10.00");
    expect(result.pages[1].note).toBe("");
    expect(verifyMetaContentTotals(config, result, [range], null).status).toBe("ok");
  });

  it("accepts daily Campaigns-table date pairs and Result indicators without inventing all-click CTR", () => {
    const parsed = parseCsvText([
      "Campaign name,Reporting starts,Reporting ends,Region,Amount spent (USD),Impressions,Results,Result indicator",
      "Lead campaign,2026-11-10,2026-11-10,Delhi,10,100,2,actions:leadgen.other",
      "Lead campaign,2026-11-11,2026-11-11,Delhi,5,50,,",
      "Traffic campaign,2026-11-10,2026-11-10,Delhi,4,80,8,actions:link_click",
      "Traffic campaign,2026-11-11,2026-11-11,Delhi,1,20,,",
    ].join("\n"));
    const region = parseMetaContentSource(parsed, "USD");
    expect(region.coverage).toEqual(range);
    const result = buildMetaContentPresentation(content([region], {audience: ["location"]}), [range], null, "$")!;
    const lead = result.pages.find(page => page.kind !== "summary" && page.objective === "META FORM LEADS")!;
    const traffic = result.pages.find(page => page.kind !== "summary" && page.objective === "LINK CLICKS")!;
    expect(lead.rows[0]).toMatchObject({spend: 15, results: 2, cpr: 7.5, ctr: null});
    expect(traffic.rows[0]).toMatchObject({spend: 5, results: 8, cpr: 0.625, ctr: null});
    expect(verifyMetaContentTotals(content([region], {audience: ["location"]}), result, [range], null).status).toBe("ok");
  });
  it("rejects aggregate or mixed-granularity date pairs instead of assigning totals to one day", () => {
    const header = "Campaign name,Reporting starts,Reporting ends,Region,Amount spent (USD),Impressions,Results,Result indicator";
    for (const lines of [
      ["Lead campaign,2026-11-10,2026-11-11,Delhi,10,100,2,actions:leadgen.other"],
      ["Lead campaign,2026-11-10,2026-11-10,Delhi,10,100,2,actions:leadgen.other", "Lead campaign,2026-11-10,2026-11-11,Mumbai,10,100,2,actions:leadgen.other"],
    ]) expect(() => parseMetaContentSource(parseCsvText([header, ...lines].join("\n")), "USD")).toThrow("Day breakdown");
  });
  it("preserves fractional attributed results in client-facing counts", () => {
    expect(metricNumber(0.5, "number", "$")).toBe("0.5");
    expect(metricNumber(1234, "number", "$")).toBe("1,234");
  });
  it("independently verifies selected source totals and blocks a changed or dropped output row", () => {
    const age = source("Age", [
      "Example,Set,2026-11-10,10,100,5,1,Leads (form),25-34",
      "Example,Set,2026-11-11,20,200,10,2,Leads (form),35-44",
    ]);
    const config = content([age], { includeStandard: false });
    const result = buildMetaContentPresentation(config, [range], null, "$")!;
    expect(verifyMetaContentTotals(config, result, [range], null).status).toBe(
      "ok",
    );
    result.pages.find(page => page.kind !== "summary")!.rows[0].spend += 1;
    const wrong = verifyMetaContentTotals(config, result, [range], null);
    expect(wrong.status).toBe("mismatch");
    expect(
      mergeMetaVerification({ status: "ok", checks: [] }, wrong, true).status,
    ).toBe("mismatch");
    result.pages.find(page => page.kind !== "summary")!.rows.shift();
    expect(verifyMetaContentTotals(config, result, [range], null).status).toBe(
      "mismatch",
    );
  });
  it("separates monthly periods without carrying another month's metrics into them", () => {
    const age = source("Age", [
      "Example,Set,2026-10-01,10,100,5,1,Leads (form),25-34",
      "Example,Set,2026-11-30,20,200,10,2,Leads (form),25-34",
    ]);
    const ranges = [
      { startIso: "2026-10-01", endIso: "2026-10-31" },
      { startIso: "2026-11-01", endIso: "2026-11-30" },
    ];
    const config = content([age]);
    const result = buildMetaContentPresentation(config, ranges, null, "$")!;
    expect(result.pages.filter(page => page.kind !== "summary").map((page) => page.rows[0].spend)).toEqual([10, 20]);
    expect(verifyMetaContentTotals(config, result, ranges, null).status).toBe(
      "ok",
    );
  });
  it("weights rates from counts and retains unknown cohorts", () => {
    const age = source("Age", [
      "Example,Set,2026-11-10,10,100,10,1,Leads (form),18-24",
      "Example,Set,2026-11-11,90,900,9,9,Leads (form),18-24",
      "Example,Set,2026-11-11,20,200,0,0,Leads (form),Unknown",
    ]);
    const pages = buildMetaContentPresentation(
      content([age]),
      [range],
      null,
      "$",
    )!.pages.filter(page => page.kind !== "summary");
    expect(pages[0].rows.find((row) => row.name === "18-24")).toMatchObject({
      spend: 100,
      results: 10,
      ctr: 1.9,
      cpr: 10,
      cpc: 100 / 19,
      cpm: 100,
      roas: null,
    });
    expect(pages[0].rows.find((row) => row.name === "Unknown")).toMatchObject({
      spend: 20,
      results: 0,
      ctr: 0,
      cpr: null,
    });
  });
  it("derives platform and placement independently from one joint file without conflating Feed", () => {
    const joint = source("Platform,Placement", [
      "Example,Set,2026-11-10,10,100,5,1,Leads (form),facebook,Feed",
      "Example,Set,2026-11-11,20,200,6,2,Leads (form),instagram,Feed",
    ]);
    const result = buildMetaContentPresentation(
      content([joint], { audience: ["platform", "placement"] }),
      [range],
      null,
      "$",
    )!;
    expect(result.pages.filter(page => page.kind !== "summary")).toHaveLength(2);
    expect(
      result.pages.filter(page => page.kind !== "summary").map((page) =>
        page.rows.reduce((n, row) => n + row.spend, 0),
      ),
    ).toEqual([30, 30]);
    expect(result.pages.filter(page => page.kind !== "summary")[1].rows.map((row) => row.name).sort()).toEqual([
      "facebook · Feed",
      "instagram · Feed",
    ]);
  });
  it("does not average percentages when exact click counts are missing", () => {
    const age = source("Age", [
      "Example,Set,2026-11-10,10,100,—,1,Leads (form),18-24",
      "Example,Set,2026-11-11,10,100,—,1,Leads (form),18-24",
    ]);
    expect(
      buildMetaContentPresentation(content([age]), [range], null, "$")!.pages.find(page => page.kind !== "summary")!
        .rows[0].ctr,
    ).toBeNull();
  });
  it("checks coverage, currencies, duplicate source grains and changed campaign scopes", () => {
    const age = source("Age", [
      "Example,Set,2026-11-10,10,100,5,1,Leads (form),18-24",
    ]);
    expect(() =>
      buildMetaContentPresentation(content([age]), [range], null, "$"),
    ).toThrow(/does not cover/);
    expect(() =>
      parseMetaContentSource(
        parseCsvText(
          `${headers},Age\nExample,Set,2026-11-10,10,100,5,1,Leads (form),18-24`,
        ),
        "INR",
      ),
    ).toThrow(/currencies/);
    expect(() =>
      source("Age", [
        "Example,Set,2026-11-10,10,100,5,1,Leads (form),18-24",
        "Example,Set,2026-11-10,10,100,5,1,Leads (form),18-24",
      ]),
    ).toThrow(/duplicate rows/);
    expect(() =>
      buildMetaContentPresentation(
        { ...content([age]), campaigns: ["Example"] },
        [range],
        ["Other"],
        "$",
      ),
    ).toThrow(/Campaign selection changed/);
  });
  it("paginates all ads by ID, keeps identical names distinct and ranks only eligible ads", () => {
    const rows = Array.from(
      { length: 11 },
      (_, i) =>
        `Example,Set,2026-11-${i === 0 ? "10" : "11"},${10 + i},100,5,${i === 0 ? 1 : 5},Leads (form),${100 + i},Same name`,
    );
    const ads = source("Ad ID,Ad name", rows);
    const result = buildMetaContentPresentation(
      content([ads], { audience: [], creatives: true }),
      [range],
      null,
      "$",
    )!;
    expect(
      result.pages.filter((p) => p.kind === "creative-table"),
    ).toHaveLength(2);
    const all = result.pages.flatMap((p) => p.rows);
    expect(new Set(all.map((r) => r.adId)).size).toBe(11);
    expect(all.find((r) => r.adId === "100")!.rank).toBeUndefined();
    expect(all.find((r) => r.adId === "101")!.rank).toBe(1);
    expect(result.pages.some((p) => p.kind === "creative-preview")).toBe(false);
  });
  it("calculates website CVR and purchase ROAS only with the required evidence", () => {
    const ads = source(
      "Ad ID,Ad name,Website purchases conversion value,Landing page views",
      [
        "Sales,Set,2026-11-10,20,100,10,2,Website purchases,100,Sale,100,20",
        "Sales,Set,2026-11-11,30,200,20,3,Website purchases,100,Sale,150,30",
      ],
    );
    const result = buildMetaContentPresentation(
      content([ads], { audience: [], creatives: true, ranking: "roas" }),
      [range],
      null,
      "$",
    )!;
    expect(result.pages.find(page => page.kind !== "summary")!.rows[0]).toMatchObject({
      spend: 50,
      results: 5,
      roas: 5,
      websiteCvr: 10,
      eligible: true,
      rank: 1,
    });
  });
  it("keeps cost units for impression objectives and does not add unique reach", () => {
    const impressions = source("Age", [
      "Example,Set,2026-11-10,10,1000,5,1000,Impressions,25-34",
      "Example,Set,2026-11-11,20,1000,5,1000,Impressions,25-34",
    ]);
    expect(
      buildMetaContentPresentation(content([impressions]), [range], null, "$")!
        .pages.find(page => page.kind !== "summary")!.rows[0].cpr,
    ).toBe(15);
    const reach = source("Age", [
      "Example,Set,2026-11-10,10,100,5,50,Reach,25-34",
      "Example,Set,2026-11-11,10,100,5,50,Reach,25-34",
    ]);
    expect(
      buildMetaContentPresentation(content([reach]), [range], null, "$")!
        .pages.find(page => page.kind !== "summary")!.rows[0],
    ).toMatchObject({ results: null, cpr: null });
  });
  it("keeps independent objectives separate and supports selected ads", () => {
    const ads = source("Ad ID,Ad name", [
      "Forms,Set,2026-11-10,10,100,5,5,Leads (form),100,Same",
      "Sales,Set,2026-11-11,10,100,5,5,Website purchases,101,Same",
    ]);
    const result = buildMetaContentPresentation(
      content([ads], { audience: [], creatives: true }),
      [range],
      null,
      "$",
    )!;
    expect(result.pages.filter(page => page.kind !== "summary")).toHaveLength(2);
    expect(result.pages.filter(page => page.kind !== "summary").every((p) => p.rows[0].rank === 1)).toBe(true);
    const selected = buildMetaContentPresentation(
      content([ads], { audience: [], creatives: true, selectedAdIds: ["100"] }),
      [range],
      null,
      "$",
    )!;
    expect(selected.pages.flatMap((p) => p.rows).map((r) => r.adId)).toEqual([
      "100",
    ]);
  });
});

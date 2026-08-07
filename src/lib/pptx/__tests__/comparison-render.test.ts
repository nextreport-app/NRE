import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { describe, expect, it, beforeAll } from "vitest";
import { renderComparisonPptx } from "../render";
import { buildComparisonReportData } from "../../nre/report-data";
import type { NreRow } from "../../nre/columns";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const PRODUCTION_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");
const NOW = new Date("2026-08-07T12:00:00Z");

function comparisonDaysInclusive(startIso: string, endIso: string): string[] {
  const days: string[] = [];
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  for (let ts = start.getTime(); ts <= end.getTime(); ts += 24 * 60 * 60 * 1000) {
    const d = new Date(ts);
    days.push(`${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`);
  }
  return days;
}

function comparisonRows(
  startIso: string,
  endIso: string,
  config: { campaign_name: string; result_type: string; spend: number; reach: number; results: number },
): NreRow[] {
  return comparisonDaysInclusive(startIso, endIso).map((day) => ({
    _raw: { Day: day },
    campaign_name: config.campaign_name,
    ad_set_name: "Ad Set 1",
    result_type: config.result_type,
    spend: String(config.spend),
    reach: String(config.reach),
    impressions: String(config.reach * 2),
    results: String(config.results),
    link_clicks: "0",
    ctr: "1",
    cpc: "1",
    frequency: "1",
    date_start: day,
    date_end: day,
  }));
}

const PERIOD_A = { startIso: "2026-08-01", endIso: "2026-08-06" };
const PERIOD_B = { startIso: "2026-07-01", endIso: "2026-07-06" };

const shoesA = comparisonRows("2026-08-01", "2026-08-06", {
  campaign_name: "Shoes - Purchases",
  result_type: "Purchase",
  spend: 100,
  reach: 1000,
  results: 2,
});
const shoesB = comparisonRows("2026-07-01", "2026-07-06", {
  campaign_name: "Shoes - Purchases",
  result_type: "Purchase",
  spend: 50,
  reach: 800,
  results: 1,
});
const brandA = comparisonRows("2026-08-01", "2026-08-06", {
  campaign_name: "Brand - Reach",
  result_type: "Reach",
  spend: 200,
  reach: 10000,
  results: 0,
});
const brandB = comparisonRows("2026-07-01", "2026-07-06", {
  campaign_name: "Brand - Reach",
  result_type: "Reach",
  spend: 150,
  reach: 8000,
  results: 0,
});

/** Same independent-OOXML-reader approach as render.test.ts's own inspectWithPythonPptx — kept as a local copy (rather than importing) since this is a separate, from-scratch slide pipeline (comparison-slides.ts) with no shared render.test.ts fixtures. */
function inspectWithPythonPptx(pptxPath: string): { slideCount: number; slideTexts: string[] } {
  const script = `
import sys, json
from pptx import Presentation

def collect(shapes, parts):
    for shape in shapes:
        if shape.shape_type == 6:
            collect(shape.shapes, parts)
            continue
        if shape.has_text_frame:
            parts.append(shape.text_frame.text)
        if shape.has_table:
            for row in shape.table.rows:
                for cell in row.cells:
                    parts.append(cell.text)

p = Presentation(sys.argv[1])
texts = []
for slide in p.slides:
    parts = []
    collect(slide.shapes, parts)
    texts.append(" | ".join(parts))
print(json.dumps({"slideCount": len(p.slides.__iter__.__self__._sldIdLst), "slideTexts": texts}))
`;
  const out = execFileSync("python3", ["-c", script, pptxPath], { encoding: "utf-8" });
  return JSON.parse(out);
}

describe("renderComparisonPptx — real template end-to-end", () => {
  it("produces Cover -> one campaign slide per campaign -> summary slide, in that order, with no leftover template tags", async () => {
    if (!fs.existsSync(PRODUCTION_TEMPLATE_PATH)) {
      throw new Error(`Template fixture not found at ${PRODUCTION_TEMPLATE_PATH}`);
    }
    const templateBuffer = fs.readFileSync(PRODUCTION_TEMPLATE_PATH);

    const data = buildComparisonReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "UTC",
      mtdDailyRows: [...shoesA, ...shoesB, ...brandA, ...brandB],
      periodA: PERIOD_A,
      periodB: PERIOD_B,
      now: NOW,
    });

    const buffer = await renderComparisonPptx({ templateBuffer, data });

    const outPath = path.join(os.tmpdir(), `nre-comparison-render-test-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    const { slideCount, slideTexts } = inspectWithPythonPptx(outPath);

    // Cover + 2 campaign comparison slides (Brand - Reach, Shoes - Purchases, alphabetical) + summary = 4.
    expect(slideCount).toBe(4);
    const [cover, campaign1, campaign2, summary] = slideTexts;

    expect(cover).toContain("COMPARISON PERFORMANCE REPORT");
    expect(cover).toContain("Test Agency");
    expect(cover).toContain("Aug 1 - Aug 6, 2026");
    expect(cover).toContain("Jul 1 - Jul 6, 2026");
    expect(cover).not.toContain("{{");
    // Health score is not shown on comparison reports.
    expect(cover).not.toMatch(/Healthy|Needs Attention|Critical/);

    expect(campaign1).toContain("Brand - Reach (Campaign)");
    expect(campaign2).toContain("Shoes - Purchases (Campaign)");
    // Shoes doubled spend A vs B ((100-50)/50*100 = 100%) -> up arrow.
    expect(campaign2).toContain("+100% ↑");

    expect(summary).toContain("CAMPAIGN COMPARISON SUMMARY");
    expect(summary).toContain("Brand - Reach");
    expect(summary).toContain("Shoes - Purchases");
    expect(summary).toContain("TOTAL");

    fs.unlinkSync(outPath);
  }, 30000);

  it("respects a custom reportTitle and agency name on the comparison cover slide", async () => {
    const templateBuffer = fs.readFileSync(PRODUCTION_TEMPLATE_PATH);
    const data = buildComparisonReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "UTC",
      mtdDailyRows: [...shoesA, ...shoesB],
      periodA: PERIOD_A,
      periodB: PERIOD_B,
      now: NOW,
    });

    const buffer = await renderComparisonPptx({ templateBuffer, data, reportTitle: "Q3 Comparison Review", agencyName: "Acme Agency" });
    const outPath = path.join(os.tmpdir(), `nre-comparison-render-test-${Date.now()}-2.pptx`);
    fs.writeFileSync(outPath, buffer);

    const { slideTexts } = inspectWithPythonPptx(outPath);
    expect(slideTexts[0]).toContain("Q3 COMPARISON REVIEW");
    expect(slideTexts[0]).toContain("Prepared by Acme Agency");

    fs.unlinkSync(outPath);
  }, 30000);
});

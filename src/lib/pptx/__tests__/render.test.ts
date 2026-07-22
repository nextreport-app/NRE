import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { renderPptx } from "../render";
import { buildReportData } from "../../nre/report-data";
import type { NreRow } from "../../nre/columns";
import JSZip from "jszip";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const TEMPLATE_PATH = path.resolve(__dirname, "../../../../reference/templates/ADS_TEMPLATE_V2.pptx");
const NOW = new Date("2026-07-20T12:00:00Z");

function daysInclusive(startDay: number, endDay: number): string[] {
  const days: string[] = [];
  for (let d = startDay; d <= endDay; d++) days.push(`${String(d).padStart(2, "0")}-07-2026`);
  return days;
}

function buildDailyRows(config: {
  campaign_name: string;
  ad_set_name: string;
  result_type: string;
  spend: number;
  reach: number;
  impressions: number;
  results: number;
  link_clicks: number;
  ctr: number;
  cpc: number;
  frequency: number;
}): NreRow[] {
  return daysInclusive(13, 19).map((day) => ({
    _raw: { Day: day },
    campaign_name: config.campaign_name,
    ad_set_name: config.ad_set_name,
    result_type: config.result_type,
    spend: String(config.spend),
    reach: String(config.reach),
    impressions: String(config.impressions),
    results: String(config.results),
    link_clicks: String(config.link_clicks),
    ctr: String(config.ctr),
    cpc: String(config.cpc),
    frequency: String(config.frequency),
    date_start: day,
    date_end: day,
  }));
}

const prospecting = buildDailyRows({
  campaign_name: "Shoes - Purchases",
  ad_set_name: "Prospecting",
  result_type: "Purchase",
  spend: 100,
  reach: 1000,
  impressions: 3000,
  results: 2,
  link_clicks: 50,
  ctr: 1.5,
  cpc: 3,
  frequency: 3,
});
const retargeting = buildDailyRows({
  campaign_name: "Shoes - Purchases",
  ad_set_name: "Retargeting",
  result_type: "Purchase",
  spend: 50,
  reach: 800,
  impressions: 2000,
  results: 1,
  link_clicks: 30,
  ctr: 2.5,
  cpc: 4,
  frequency: 2,
});
const awareness = buildDailyRows({
  campaign_name: "Brand - Reach",
  ad_set_name: "Awareness",
  result_type: "Reach",
  spend: 200,
  reach: 10000,
  impressions: 15000,
  results: 0,
  link_clicks: 0,
  ctr: 0.8,
  cpc: 0,
  frequency: 1.5,
});

/** Runs python-pptx (a robust, independent OOXML reader) to structurally validate the generated file. */
function inspectWithPythonPptx(pptxPath: string): {
  slideCount: number;
  slideTexts: string[];
} {
  const script = `
import sys, json
from pptx import Presentation

def collect(shapes, parts):
    for shape in shapes:
        if shape.shape_type == 6:  # GROUP — recurse (CAMPAIGN_SUMMARY lives inside one in this template)
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

describe("renderPptx — real template end-to-end", () => {
  it("produces a valid .pptx that python-pptx can open, with the expected slide structure and content", async () => {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      throw new Error(`Template fixture not found at ${TEMPLATE_PATH}`);
    }
    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: 100000,
      mtdDailyRows: [...prospecting, ...retargeting, ...awareness],
      now: NOW,
    });

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹" });

    const outPath = path.join(os.tmpdir(), `nre-render-test-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    const { slideCount, slideTexts } = inspectWithPythonPptx(outPath);

    // Cover + 2 campaign slides + 2 ad-set slides (multi-adset campaign only) + chart + table + legend = 8
    expect(slideCount).toBe(8);

    const [cover, campaign1, campaign2, adset1, adset2, chart, table, legend] = slideTexts;

    expect(cover).toContain("Test Agency");
    expect(cover).toContain("07-20-2026");
    // This template's cover slide has no {{DATE_RANGE}} placeholder (only
    // ACCOUNT_NAME/REPORT_DATE/ACCOUNT_HEALTH_BADGE/BUDGET_SUMMARY) — the
    // source's replaceAllText('{{DATE_RANGE}}', ...) call on the cover is a
    // harmless no-op against this template too.
    expect(cover).not.toContain("{{"); // no leftover unfilled tags

    expect(campaign1).toContain("Brand - Reach");
    expect(campaign1).toContain("₹1,400");
    expect(campaign1).not.toContain("{{");

    expect(campaign2).toContain("Shoes - Purchases");
    expect(campaign2).toContain("₹1,050");
    expect(campaign2).not.toContain("{{");

    expect(adset1).toContain("Prospecting (Ad Set)");
    expect(adset1).toContain("₹700");

    expect(adset2).toContain("Retargeting (Ad Set)");
    expect(adset2).toContain("₹350");

    expect(chart).toContain("MTD CAMPAIGN PERFORMANCE");
    expect(chart).toContain("Brand - Reach");
    expect(chart).toContain("Shoes - Purchases");

    expect(table).toContain("CAMPAIGN OVERVIEW");
    expect(table).toContain("PURCHASES");
    expect(table).not.toContain("{{");

    expect(legend).toContain("METRIC ABBREVIATION GUIDE");

    // AI copy text boxes (CAMPAIGN_SUMMARY/KEY_INSIGHTS) must render 13pt
    // non-bold Poppins, overriding the template's own bold 12pt Open Sans
    // placeholder styling, per the product owner's explicit spec.
    const zip = await JSZip.loadAsync(buffer);
    const campaignSlideXml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    const aiRunRegex =
      /<a:r><a:rPr[^>]*b="0"[^>]*sz="1300"[^>]*>(?:(?!<\/a:r>)[\s\S])*?<a:latin typeface="Poppins"\/>(?:(?!<\/a:r>)[\s\S])*?<a:t>\[AI unavailable/;
    expect(campaignSlideXml).toMatch(aiRunRegex);

    fs.unlinkSync(outPath);
  }, 30000);

  it("handles a fully paused account", async () => {
    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
    const data = buildReportData({
      accountName: "Idle Co",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      mtdDailyRows: [],
      now: NOW,
    });

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "$" });
    const outPath = path.join(os.tmpdir(), `nre-render-paused-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    const { slideCount, slideTexts } = inspectWithPythonPptx(outPath);
    // Cover + paused message slide + table + legend = 4 (no chart, no campaign/ad-set slides)
    expect(slideCount).toBe(4);
    expect(slideTexts[0]).toContain("Campaigns Paused");
    expect(slideTexts[1]).toContain("All Campaigns");
    expect(slideTexts[1]).toContain("Idle Co");

    fs.unlinkSync(outPath);
  }, 30000);
});

import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { renderPptx } from "../render";
import type { ImageAsset } from "../embed-image";
import { buildReportData } from "../../nre/report-data";
import type { NreRow } from "../../nre/columns";
import {
  contentTypeForLogoFormat,
  extensionForLogoFormat,
  isLogoValidationError,
  processLogoUpload,
} from "../../logo-processing";
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

/** Row/column count of the (single) table shape on a given slide, via python-pptx. */
function inspectTableDimensions(pptxPath: string, slideIndex: number): { rows: number; cols: number } {
  const script = `
import sys, json
from pptx import Presentation

def find_table(shapes):
    for shape in shapes:
        if shape.shape_type == 6:
            found = find_table(shape.shapes)
            if found is not None:
                return found
            continue
        if shape.has_table:
            return shape.table
    return None

p = Presentation(sys.argv[1])
slide = list(p.slides)[int(sys.argv[2])]
table = find_table(slide.shapes)
print(json.dumps({"rows": len(table.rows), "cols": len(table.columns)}))
`;
  const out = execFileSync("python3", ["-c", script, pptxPath, String(slideIndex)], { encoding: "utf-8" });
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

    expect(campaign1).toContain("Brand - Reach (Campaign)");
    expect(campaign1).toContain("₹1,400");
    expect(campaign1).not.toContain("{{");

    expect(campaign2).toContain("Shoes - Purchases (Campaign)");
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

    // This fixture has no Period CSV and only one non-Reach objective
    // (Purchase) — the Period row and the second result-type columns must
    // both be structurally removed, not just blanked, verified with an
    // independent OOXML reader (python-pptx), not our own fill code.
    const tableDims = inspectTableDimensions(outPath, 6); // slide index 6 = table
    expect(tableDims.rows).toBe(2); // header + MTD only, Period row hidden
    expect(tableDims.cols).toBe(8); // second result-type columns hidden

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

  it("keeps the full 3-row x 10-column table when Period data exists and there are two objectives", async () => {
    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
    const leadsRows = buildDailyRows({
      campaign_name: "Lead Gen",
      ad_set_name: "Ad Set 1",
      result_type: "Lead",
      spend: 100,
      reach: 2000,
      impressions: 4000,
      results: 10,
      link_clicks: 20,
      ctr: 1.2,
      cpc: 2,
      frequency: 1.5,
    });
    const salesRows = buildDailyRows({
      campaign_name: "Sales",
      ad_set_name: "Ad Set 1",
      result_type: "Purchase",
      spend: 150,
      reach: 3000,
      impressions: 6000,
      results: 8,
      link_clicks: 25,
      ctr: 1.4,
      cpc: 2.5,
      frequency: 1.8,
    });
    const periodRows = [
      {
        _raw: {},
        campaign_name: "Sales",
        result_type: "Purchase",
        spend: "500",
        reach: "2000",
        impressions: "4000",
        results: "10",
        ctr: "2",
        cpc: "3",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
    ];

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [...leadsRows, ...salesRows],
      periodRows: periodRows as unknown as NreRow[],
      now: NOW,
    });

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹" });
    const outPath = path.join(os.tmpdir(), `nre-render-full-table-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    // Table slide index: cover + 2 campaign slides (no multi-adset campaigns
    // here, so no ad-set slides) + chart + table + legend = table is index 4.
    const tableDims = inspectTableDimensions(outPath, 4);
    expect(tableDims.rows).toBe(3);
    expect(tableDims.cols).toBe(10);

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

describe("renderPptx — client/agency logo branding (real production template)", () => {
  // Uses templates/dark.pptx directly (not the reference/ fixture above) —
  // it's the one with the {{REPORT_TITLE}} tag and the actual footer-logo
  // placement math this suite is regression-testing.
  const DARK_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");

  // Real fixture files (not sharp-generated — see logo-processing.ts's file
  // header for why sharp is gone from this codebase entirely), run through
  // the actual production validation path so these tests also cover format
  // detection and the Content_Types.xml Default-entry handling for a
  // non-PNG (WebP) logo.
  const FIXTURES_DIR = path.resolve(__dirname, "../../__tests__/fixtures");
  function loadLogoAsset(fileName: string): ImageAsset {
    const buffer = fs.readFileSync(path.join(FIXTURES_DIR, fileName));
    const processed = processLogoUpload(buffer);
    if (isLogoValidationError(processed)) throw new Error(processed.error);
    return {
      bytes: processed.buffer,
      widthPx: processed.widthPx,
      heightPx: processed.heightPx,
      extension: extensionForLogoFormat(processed.format),
      contentType: contentTypeForLogoFormat(processed.format),
    };
  }

  function buildFixtureData() {
    return buildReportData({
      accountName: "Acme Inc",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: 50000,
      mtdDailyRows: [...prospecting, ...retargeting],
      now: NOW,
    });
  }

  it("renders with no branding exactly as before — no media, no Prepared By, default title", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹" });
    const zip = await JSZip.loadAsync(buffer);

    expect(Object.keys(zip.files).some((f) => f.startsWith("ppt/media/client-logo") || f.startsWith("ppt/media/agency-footer-logo"))).toBe(false);
    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain("WEEKLY PERFORMANCE REPORT");
    expect(coverXml).not.toContain("Prepared by");
    expect(coverXml).not.toContain("{{");
  });

  it("renders with a client logo only — media added to the cover, no agency footer anywhere", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const clientLogo = loadLogoAsset("logo.png");
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹", clientLogo });
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("ppt/media/client-logo.png")).not.toBeNull();
    expect(Object.keys(zip.files).some((f) => f.startsWith("ppt/media/agency-footer-logo"))).toBe(false);

    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain('name="Client Logo"');
    const campaignXml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(campaignXml).not.toContain('name="Client Logo"');
  });

  it("renders with an agency name + logo only — Prepared By line + footer logo on every slide, no client logo", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const agencyLogo = loadLogoAsset("logo.webp"); // non-PNG, on purpose — exercises the Content_Types.xml Default-entry path
    const buffer = await renderPptx({
      templateBuffer,
      data: buildFixtureData(),
      currencySymbol: "₹",
      agencyName: "Bright Path Marketing",
      agencyLogo,
      reportTitle: "Q3 Performance Review",
    });
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("ppt/media/agency-footer-logo.webp")).not.toBeNull();
    expect(Object.keys(zip.files).some((f) => f.startsWith("ppt/media/client-logo"))).toBe(false);

    const contentTypesXml = await zip.file("[Content_Types].xml")!.async("string");
    expect(contentTypesXml).toContain('Extension="webp"');
    expect(contentTypesXml).toContain('ContentType="image/webp"');

    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain("Prepared by Bright Path Marketing");
    expect(coverXml).toContain("Q3 PERFORMANCE REVIEW");
    expect(coverXml).toContain('name="Agency Logo"');

    // Footer logo must be baked into every distinct template part — cover,
    // campaign/ad-set template, table, and legend — not just the cover.
    const allSlideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    let agencyLogoCount = 0;
    for (const f of allSlideFiles) {
      const xml = await zip.file(f)!.async("string");
      if (xml.includes('name="Agency Logo"')) agencyLogoCount++;
    }
    // Cover + campaign + ad-set slides (share one template clone) + chart + table + legend
    expect(agencyLogoCount).toBe(allSlideFiles.length);
  });

  it("renders with both a client logo and agency branding together, without error", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const clientLogo = loadLogoAsset("logo.png");
    const agencyLogo = loadLogoAsset("logo.jpg");
    const buffer = await renderPptx({
      templateBuffer,
      data: buildFixtureData(),
      currencySymbol: "₹",
      agencyName: "Bright Path Marketing",
      agencyLogo,
      clientLogo,
    });
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("ppt/media/client-logo.png")).not.toBeNull();
    expect(zip.file("ppt/media/agency-footer-logo.jpg")).not.toBeNull();

    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain('name="Client Logo"');
    expect(coverXml).toContain('name="Agency Logo"');
    expect(coverXml).toContain("Prepared by Bright Path Marketing");
    expect(coverXml).not.toContain("{{");
  });
});

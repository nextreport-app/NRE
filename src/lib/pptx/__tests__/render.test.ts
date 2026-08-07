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
/** The actual production template (templates.ts's loadTemplateBuffer target) — used where the exact shipped file's structure matters, not just an equivalent reference copy. */
const PRODUCTION_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");
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

/** Every text-frame shape's text on a slide, plus the table's own cell texts and each row's solid-fill color (if any), via python-pptx. Used to verify Combined Total row labels, the same-month footnote, and the Fix 4 row background independently of our own XML-manipulation code. */
function inspectTableSlide(
  pptxPath: string,
  slideIndex: number,
): { texts: string[]; rowFillColors: (string | null)[] } {
  const script = `
import sys, json
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

p = Presentation(sys.argv[1])
slide = list(p.slides)[int(sys.argv[2])]

texts = []
table = None
for shape in slide.shapes:
    if shape.has_text_frame and shape.text_frame.text.strip():
        texts.append(shape.text_frame.text)
    if shape.has_table:
        table = shape.table
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    texts.append(cell.text)

row_fills = []
if table is not None:
    for row in table.rows:
        cell = row.cells[0]
        try:
            if cell.fill.type is not None and cell.fill.fore_color.type is not None:
                row_fills.append(str(cell.fill.fore_color.rgb))
            else:
                row_fills.append(None)
        except Exception:
            row_fills.append(None)

print(json.dumps({"texts": texts, "rowFillColors": row_fills}))
`;
  const out = execFileSync("python3", ["-c", script, pptxPath, String(slideIndex)], { encoding: "utf-8" });
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

    // Title names the actual month + a sub-line with the exact date range,
    // not the old all-caps "MTD CAMPAIGN PERFORMANCE" jargon — see chart-slide.ts.
    expect(chart).toContain("July Campaign Performance");
    expect(chart).toContain("July 13 - July 19, 2026");
    expect(chart).toContain("Brand - Reach");
    expect(chart).toContain("Shoes - Purchases");

    // reference/templates/ADS_TEMPLATE_V2.pptx (this describe block's own
    // TEMPLATE_PATH) is a legacy, pre-existing fixture kept for broad
    // rendering-pipeline sanity checks — it's not the shipped production
    // asset (see PRODUCTION_TEMPLATE_PATH's own comment above) and doesn't
    // track every production template edit, so it still has the table
    // slide's OLD heading text (Fix 3 only renamed templates/dark.pptx and
    // its two derived templates, all covered by PRODUCTION_TEMPLATE_PATH/
    // LIGHT_TEMPLATE_PATH tests elsewhere in this file).
    expect(table).toContain("CAMPAIGN OVERVIEW");
    expect(table).toContain("PURCHASES");
    expect(table).not.toContain("{{");

    // This fixture has no Previous Month Data, so the Period row must be structurally
    // removed, not just blanked — verified with an independent OOXML reader
    // (python-pptx), not our own fill code. It has 2 distinct objectives
    // (Purchases from the Shoes campaign, Reach from the Brand campaign —
    // Fix 1: Reach now gets its own column pair alongside other objectives
    // instead of being dropped), which fits the template's native 10-column
    // width exactly, with nothing hidden or grown.
    const tableDims = inspectTableDimensions(outPath, 6); // slide index 6 = table
    expect(tableDims.rows).toBe(2); // header + MTD only, Period row hidden
    expect(tableDims.cols).toBe(10); // 6 static + 2 objectives (Purchases, Reach)

    expect(legend).toContain("METRIC ABBREVIATION GUIDE");

    // AI copy text boxes (CAMPAIGN_SUMMARY/KEY_INSIGHTS) must render 14pt
    // non-bold Poppins, overriding the template's own bold 12pt Open Sans
    // placeholder styling — bumped from 13pt to 14pt to compensate for text
    // rendering smaller once Google Drive converts the .pptx to Slides.
    const zip = await JSZip.loadAsync(buffer);
    const campaignSlideXml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    const aiRunRegex =
      /<a:r><a:rPr[^>]*b="0"[^>]*sz="1400"[^>]*>(?:(?!<\/a:r>)[\s\S])*?<a:latin typeface="Poppins"\/>(?:(?!<\/a:r>)[\s\S])*?<a:t>\[AI unavailable/;
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

  it("Fixes 1, 2 & 4: Combined Total row labels and row background — against the actual production template", async () => {
    if (!fs.existsSync(PRODUCTION_TEMPLATE_PATH)) {
      throw new Error(`Production template not found at ${PRODUCTION_TEMPLATE_PATH}`);
    }
    const templateBuffer = fs.readFileSync(PRODUCTION_TEMPLATE_PATH);

    // Previous Month Data in a DIFFERENT calendar month than the MTD Daily
    // CSV (June vs July) — the normal case, where both rows show.
    const junePeriodRows = [
      {
        _raw: {},
        campaign_name: "Shoes - Purchases",
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
      mtdDailyRows: [...prospecting, ...retargeting, ...awareness],
      periodRows: junePeriodRows as unknown as NreRow[],
      now: NOW,
    });

    expect(data.periodRow.monthLabel).toBe("Previous Month — June 2026");
    expect(data.mtdRow.monthLabel).toContain(", 2026 MTD");
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(false);

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹" });
    const outPath = path.join(os.tmpdir(), `nre-render-combined-total-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    // Cover + 2 campaign slides + 2 ad-set slides + chart + table + legend = 8; table is index 6.
    const { texts, rowFillColors } = inspectTableSlide(outPath, 6);
    const allText = texts.join(" | ");

    expect(allText).toContain("Previous Month — June 2026");
    expect(allText).toContain(", 2026 MTD");
    expect(allText).not.toContain("{{");

    // Row 0 = header, row 1 = Previous Month, row 2 = MTD — independently
    // read back via python-pptx's own fill-color API, not our own XML
    // manipulation code. The Previous Month row's fill must differ from
    // both the header row's and the MTD row's, and must be the exact
    // color Fix 4 specifies.
    expect(rowFillColors).toHaveLength(3);
    expect(rowFillColors[1]).toBe("111F35");
    expect(rowFillColors[1]).not.toBe(rowFillColors[0]);
    expect(rowFillColors[1]).not.toBe(rowFillColors[2]);

    fs.unlinkSync(outPath);
  }, 30000);

  it("hides the MTD row entirely when Previous Month Data and the MTD Daily CSV land in the same calendar month — against the actual production template", async () => {
    if (!fs.existsSync(PRODUCTION_TEMPLATE_PATH)) {
      throw new Error(`Production template not found at ${PRODUCTION_TEMPLATE_PATH}`);
    }
    const templateBuffer = fs.readFileSync(PRODUCTION_TEMPLATE_PATH);

    // Previous Month Data in the SAME calendar month as the MTD Daily CSV
    // (both July 2026) — e.g. a report generated on the 1st, before the
    // new month's MTD Daily CSV has any real data of its own yet.
    const julyPeriodRows = [
      {
        _raw: {},
        campaign_name: "Shoes - Purchases",
        result_type: "Purchase",
        spend: "500",
        reach: "2000",
        impressions: "4000",
        results: "10",
        ctr: "2",
        cpc: "3",
        date_start: "01-07-2026",
        date_end: "19-07-2026",
      },
    ];

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [...prospecting, ...retargeting, ...awareness],
      periodRows: julyPeriodRows as unknown as NreRow[],
      now: NOW,
    });

    expect(data.periodRow.monthLabel).toBe("Previous Month — July 2026");
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(true);

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹" });
    const outPath = path.join(os.tmpdir(), `nre-render-same-month-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    // Cover + 2 campaign slides + 2 ad-set slides + chart + table + legend = 8; table is index 6.
    const tableDims = inspectTableDimensions(outPath, 6);
    expect(tableDims.rows).toBe(2); // header + Previous Month only — no MTD row, no footnote row
    expect(tableDims.cols).toBe(10);

    const { texts } = inspectTableSlide(outPath, 6);
    const allText = texts.join(" | ");
    expect(allText).toContain("Previous Month — July 2026");
    // No leftover MTD-row content (its own distinct spend figure) and no
    // Fix-3-style footnote (removed — hiding the row replaces it).
    expect(allText).not.toContain("₹2,450");
    expect(allText).not.toContain("shows complete");
    expect(allText).not.toContain("{{");

    fs.unlinkSync(outPath);
  }, 30000);

  it("Monthly report: every slide shows MONTHLY PERFORMANCE REPORT and the chart title names the actual month — against the actual production template", async () => {
    if (!fs.existsSync(PRODUCTION_TEMPLATE_PATH)) {
      throw new Error(`Production template not found at ${PRODUCTION_TEMPLATE_PATH}`);
    }
    const templateBuffer = fs.readFileSync(PRODUCTION_TEMPLATE_PATH);

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [...prospecting, ...retargeting, ...awareness],
      now: NOW,
      reportType: "MONTHLY",
    });

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹" });
    const outPath = path.join(os.tmpdir(), `nre-render-monthly-header-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    // Cover + 2 campaign slides + 2 ad-set slides + chart + table + legend = 8.
    const { slideTexts } = inspectWithPythonPptx(outPath);
    const [cover, campaign1, campaign2, adset1, adset2, chart] = slideTexts;

    expect(cover).toContain("MONTHLY PERFORMANCE REPORT");
    expect(cover).not.toContain("WEEKLY PERFORMANCE REPORT");

    for (const slide of [campaign1, campaign2, adset1, adset2]) {
      expect(slide).toContain("YOUR MONTHLY PERFORMANCE REPORT");
      expect(slide).not.toContain("WEEKLY PERFORMANCE REPORT");
    }

    // NOW is 2026-07-20, so the MTD start date falls in July.
    expect(chart).toContain("July Campaign Performance");
    expect(chart).not.toContain("MTD CAMPAIGN PERFORMANCE");

    fs.unlinkSync(outPath);
  }, 30000);

  it("grows the table past its native 10 columns for 3+ simultaneous objectives — Fix 1, no objective dropped, verified with an independent OOXML reader", async () => {
    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
    const clicksRows = buildDailyRows({
      campaign_name: "Traffic",
      ad_set_name: "Ad Set 1",
      result_type: "Link clicks",
      spend: 80,
      reach: 1500,
      impressions: 3500,
      results: 40,
      link_clicks: 40,
      ctr: 2.1,
      cpc: 2,
      frequency: 1.4,
    });
    const leadsRows = buildDailyRows({
      campaign_name: "Lead Gen",
      ad_set_name: "Ad Set 1",
      result_type: "Meta leads",
      spend: 100,
      reach: 2000,
      impressions: 4000,
      results: 10,
      link_clicks: 20,
      ctr: 1.2,
      cpc: 2,
      frequency: 1.5,
    });
    const reachRows = buildDailyRows({
      campaign_name: "Brand",
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

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [...clicksRows, ...leadsRows, ...reachRows],
      now: NOW,
    });
    expect(data.tableHeaderLabels.resultColumns).toHaveLength(3);

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹" });
    const outPath = path.join(os.tmpdir(), `nre-render-3-objective-table-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    // Cover + 3 campaign slides (no multi-adset campaigns) + chart + table + legend = table is index 5.
    const tableDims = inspectTableDimensions(outPath, 5);
    expect(tableDims.rows).toBe(2); // no Previous Month Data
    expect(tableDims.cols).toBe(12); // 6 static + 3 objective pairs

    const { slideTexts } = inspectWithPythonPptx(outPath);
    const tableText = slideTexts[5];
    expect(tableText).toContain("LINK CLICKS");
    expect(tableText).toContain("META FORM LEADS");
    expect(tableText).toContain("REACH");
    expect(tableText).not.toContain("{{");

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

describe("renderPptx — client logo + agency name branding (real production template)", () => {
  // Uses templates/dark.pptx directly (not the reference/ fixture above) —
  // it's the one with the {{REPORT_TITLE}} tag and the actual client-logo
  // placement math this suite is regression-testing.
  const DARK_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");

  // Real fixture files (not sharp-generated — see logo-processing.ts's file
  // header for why sharp is gone from this codebase entirely), run through
  // the actual production validation path so these tests also cover format
  // detection and the Content_Types.xml Default-entry handling for a
  // non-PNG logo.
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

  // The template itself ships with ~18-20 static media files (metric-card
  // icons etc.) baked in at design time, so "media exists in the zip" isn't
  // a useful signal on its own — these tests check specifically for the
  // dynamically-added client-logo part (and the since-removed agency-logo
  // part's absence), not the total media count.
  function addedMediaFiles(zip: JSZip): string[] {
    return Object.keys(zip.files).filter((f) => f.startsWith("ppt/media/client-logo") || f.startsWith("ppt/media/agency"));
  }

  it("renders with no branding exactly as before — no added media, no Prepared By, default title", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹" });
    const zip = await JSZip.loadAsync(buffer);

    expect(addedMediaFiles(zip)).toEqual([]);
    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain("WEEKLY PERFORMANCE REPORT");
    expect(coverXml).not.toContain("Prepared by");
    expect(coverXml).not.toContain("{{");
  });

  it("MTD chart slide: copies the template's own decorative background (grid + gradient) instead of a plain fill", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹" });
    const zip = await JSZip.loadAsync(buffer);

    // The template's grid/gradient background isn't on any individual slide
    // — it's a full-slide picture baked into slideMaster1.xml and inherited
    // by every template slide. That's the source of truth for what the
    // chart slide (built from scratch, with no master/layout inheritance of
    // its own) needs to replicate.
    const masterXml = await zip.file("ppt/slideMasters/slideMaster1.xml")!.async("string");
    const masterRelsXml = await zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels")!.async("string");
    const masterRelId = masterXml.match(/<p:pic>[\s\S]*?<a:blip r:embed="(rId\d+)"/)?.[1];
    expect(masterRelId).toBeDefined();
    const masterTarget = new RegExp(`Id="${masterRelId}"[^>]*Target="([^"]+)"`).exec(masterRelsXml)?.[1];
    expect(masterTarget).toBeDefined();
    const backgroundMediaFile = masterTarget!.split("/").pop();

    // Find the chart slide by content, since its position in the deck shifts with the fixture data.
    const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    let chartSlidePath: string | undefined;
    let chartXml = "";
    for (const f of slideFiles) {
      const xml = await zip.file(f)!.async("string");
      // Case-insensitive: the chart title is now title-case ("July Campaign
      // Performance") whenever a month name is available, not always the
      // old all-caps "MTD/WEEKLY CAMPAIGN PERFORMANCE" fallback text — the
      // chart slide always precedes the table slide in render.ts's fixed
      // slide order, so matching loosely here can't accidentally pick up
      // the table slide's own "CAMPAIGN PERFORMANCE OVERVIEW" heading first.
      if (xml.toLowerCase().includes("campaign performance")) {
        chartSlidePath = f;
        chartXml = xml;
        break;
      }
    }
    expect(chartSlidePath).toBeDefined();

    const chartRelsPath = chartSlidePath!.replace(/slide(\d+)\.xml$/, "_rels/slide$1.xml.rels");
    const chartRelsXml = await zip.file(chartRelsPath)!.async("string");
    expect(chartRelsXml).toContain(`Target="../media/${backgroundMediaFile}"`);

    // Full-slide-sized <p:pic>, matching the master's own coverage, drawn first (behind all chart content).
    expect(chartXml).toContain('<a:ext cx="12192001" cy="6858000"/>');
    const picIdx = chartXml.indexOf("<p:pic>");
    expect(picIdx).toBeGreaterThan(-1);
    expect(chartXml.indexOf("<p:sp>")).toBeGreaterThan(picIdx);
  });

  it("renders with a client logo only — media added to the cover, nowhere else", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const clientLogo = loadLogoAsset("logo.png");
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹", clientLogo });
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("ppt/media/client-logo.png")).not.toBeNull();
    expect(addedMediaFiles(zip)).toEqual(["ppt/media/client-logo.png"]);

    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain('name="Client Logo"');
    const campaignXml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(campaignXml).not.toContain('name="Client Logo"');
    expect(campaignXml).not.toContain('name="Agency Logo"');
  });

  it("renders 'Prepared by <agency name>' as plain text — no logo, no added media at all — when only agency name is set", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const buffer = await renderPptx({
      templateBuffer,
      data: buildFixtureData(),
      currencySymbol: "₹",
      agencyName: "Bright Path Marketing",
      reportTitle: "Q3 Performance Review",
    });
    const zip = await JSZip.loadAsync(buffer);

    // No agency logo feature exists anymore — never any added media, on any slide.
    expect(addedMediaFiles(zip)).toEqual([]);
    const allSlideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    for (const f of allSlideFiles) {
      const xml = await zip.file(f)!.async("string");
      expect(xml).not.toContain('name="Agency Logo"');
    }

    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain("Prepared by Bright Path Marketing");
    expect(coverXml).toContain("Q3 PERFORMANCE REVIEW");
    expect(coverXml).not.toContain("{{");
  });

  it("renders both a client logo and an agency name together, without error", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const clientLogo = loadLogoAsset("logo.png");
    const buffer = await renderPptx({
      templateBuffer,
      data: buildFixtureData(),
      currencySymbol: "₹",
      agencyName: "Bright Path Marketing",
      clientLogo,
    });
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("ppt/media/client-logo.png")).not.toBeNull();
    expect(addedMediaFiles(zip)).toEqual(["ppt/media/client-logo.png"]);

    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(coverXml).toContain('name="Client Logo"');
    expect(coverXml).toContain("Prepared by Bright Path Marketing");
    expect(coverXml).not.toContain("{{");
  });

  // Extracts a shape's bounding box {x, y, cx, cy} (all EMU) from the raw
  // slide XML, locating it by a literal text/name it contains. Used below
  // to assert real, numeric non-overlap — not just "the shape exists"
  // (which the tests above already cover), since a placement bug can pass
  // a presence check while still visually colliding with other content.
  function shapeBox(xml: string, locator: string): { x: number; y: number; cx: number; cy: number } {
    const idx = xml.indexOf(locator);
    expect(idx).toBeGreaterThan(-1);
    const isPic = xml.lastIndexOf("<p:pic>", idx) > xml.lastIndexOf("<p:sp>", idx);
    const start = isPic ? xml.lastIndexOf("<p:pic>", idx) : xml.lastIndexOf("<p:sp>", idx);
    const end = xml.indexOf(isPic ? "</p:pic>" : "</p:sp>", idx);
    const match = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(xml.slice(start, end));
    expect(match).not.toBeNull();
    const [, x, y, cx, cy] = match!;
    return { x: Number(x), y: Number(y), cx: Number(cx), cy: Number(cy) };
  }

  function bottom(box: { y: number; cy: number }): number {
    return box.y + box.cy;
  }

  const EMU_PER_INCH = 914400;
  const MIN_GAP_EMU = 0.15 * EMU_PER_INCH; // the product spec's explicit minimum

  describe("client logo — position/size (left, above Presented To)", () => {
    it("caps a wide (landscape) logo's display size at 180x90px", async () => {
      const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
      const clientLogo = loadLogoAsset("logo.png"); // 300x150, 2:1 — width-bound at the 180x90 (2:1) box
      const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹", clientLogo });
      const zip = await JSZip.loadAsync(buffer);
      const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

      const box = shapeBox(coverXml, 'name="Client Logo"');
      expect(box.cx).toBe(180 * 9525);
      expect(box.cy).toBe(90 * 9525);
    });

    it("caps a square/portrait logo at 90x90px, never the full 180px width", async () => {
      const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
      const clientLogo = loadLogoAsset("logo.jpg"); // 200x200, square
      const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹", clientLogo });
      const zip = await JSZip.loadAsync(buffer);
      const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

      const box = shapeBox(coverXml, 'name="Client Logo"');
      expect(box.cx).toBe(90 * 9525);
      expect(box.cy).toBe(90 * 9525);
    });

    it("positions the logo left-aligned with PRESENTED_TO/account name, with at least a 0.15in gap above it", async () => {
      const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
      const clientLogo = loadLogoAsset("logo.png");
      const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹", clientLogo });
      const zip = await JSZip.loadAsync(buffer);
      const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

      const logoBox = shapeBox(coverXml, 'name="Client Logo"');
      const presentedToBox = shapeBox(coverXml, "PRESENTED TO");

      expect(logoBox.x).toBe(presentedToBox.x); // same left edge — "directly above"
      const gap = presentedToBox.y - bottom(logoBox);
      expect(gap).toBeGreaterThanOrEqual(MIN_GAP_EMU);
    });

    // Regression: PRESENTED_TO shifts up (fill-tags.ts) whenever an agency
    // name is also set, to make room for the "Prepared by ..." line. The
    // client logo must track that shift — anchoring to a stale/static
    // PRESENTED_TO position here previously caused a real, visually
    // confirmed overlap between the logo and the PRESENTED_TO badge.
    it("still keeps the minimum gap above PRESENTED_TO when an agency name is ALSO set (shifts PRESENTED_TO up)", async () => {
      const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
      const clientLogo = loadLogoAsset("logo.png");
      const buffer = await renderPptx({
        templateBuffer,
        data: buildFixtureData(),
        currencySymbol: "₹",
        clientLogo,
        agencyName: "Bright Path Marketing",
      });
      const zip = await JSZip.loadAsync(buffer);
      const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

      const logoBox = shapeBox(coverXml, 'name="Client Logo"');
      const presentedToBox = shapeBox(coverXml, "PRESENTED TO");

      expect(bottom(logoBox)).toBeLessThanOrEqual(presentedToBox.y);
      expect(presentedToBox.y - bottom(logoBox)).toBeGreaterThanOrEqual(MIN_GAP_EMU);
    });
  });

  describe("client logo — rounded corners + subtle border", () => {
    it("clips the logo to a roundRect with an 8-10% corner radius", async () => {
      const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
      const clientLogo = loadLogoAsset("logo.png");
      const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹", clientLogo });
      const zip = await JSZip.loadAsync(buffer);
      const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

      const idx = coverXml.indexOf('name="Client Logo"');
      const shapeXml = coverXml.slice(idx, coverXml.indexOf("</p:pic>", idx));
      const adjMatch = /<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val (\d+)"\/>/.exec(shapeXml);
      expect(adjMatch).not.toBeNull();
      const adjFraction = Number(adjMatch![1]) / 100000;
      expect(adjFraction).toBeGreaterThanOrEqual(0.08);
      expect(adjFraction).toBeLessThanOrEqual(0.1);
    });

    it("adds a thin, mostly-opaque white border", async () => {
      const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
      const clientLogo = loadLogoAsset("logo.png");
      const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹", clientLogo });
      const zip = await JSZip.loadAsync(buffer);
      const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

      const idx = coverXml.indexOf('name="Client Logo"');
      const shapeXml = coverXml.slice(idx, coverXml.indexOf("</p:pic>", idx));
      expect(shapeXml).toContain('<a:ln w="12700">'); // 1pt
      expect(shapeXml).toContain('<a:srgbClr val="FFFFFF">');
      expect(shapeXml).toContain('<a:alpha val="80000"/>'); // 80% opaque = "20% transparent"
    });
  });
});

describe("cover slide — health badge / budget summary in the bottom-right", () => {
  const DARK_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");

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

  function shapeBox(xml: string, locator: string): { x: number; y: number; cx: number; cy: number } {
    const idx = xml.indexOf(locator);
    expect(idx).toBeGreaterThan(-1);
    const start = xml.lastIndexOf("<p:sp>", idx);
    const end = xml.indexOf("</p:sp>", idx);
    const match = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(xml.slice(start, end));
    expect(match).not.toBeNull();
    const [, x, y, cx, cy] = match!;
    return { x: Number(x), y: Number(y), cx: Number(cx), cy: Number(cy) };
  }

  const SLIDE_WIDTH_EMU = 12192000;
  const SLIDE_HEIGHT_EMU = 6858000;

  it("right-aligns both lines and keeps them in the right half of the slide, fully within bounds", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹" });
    const zip = await JSZip.loadAsync(buffer);
    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

    const idx = coverXml.indexOf("Campaigns On Track");
    const spStart = coverXml.lastIndexOf("<p:sp>", idx);
    expect(coverXml.slice(spStart, idx)).toContain('algn="r"');

    const badgeBox = shapeBox(coverXml, "Campaigns On Track");
    const budgetBox = shapeBox(coverXml, "Monthly Ad Budget");

    // Box center sits in the right half (the box itself is wide enough to
    // hold long content — see the fit test below — so its left edge alone
    // isn't a meaningful "which side" signal; algn="r" is what actually
    // pins the visible text to the right edge). Box never extends past the
    // slide edge.
    const badgeCenter = badgeBox.x + badgeBox.cx / 2;
    const budgetCenter = budgetBox.x + budgetBox.cx / 2;
    expect(badgeCenter).toBeGreaterThan(SLIDE_WIDTH_EMU / 2);
    expect(budgetCenter).toBeGreaterThan(SLIDE_WIDTH_EMU / 2);
    expect(badgeBox.x + badgeBox.cx).toBeLessThanOrEqual(SLIDE_WIDTH_EMU);
    expect(budgetBox.x + budgetBox.cx).toBeLessThanOrEqual(SLIDE_WIDTH_EMU);

    // Fully within the slide's vertical bounds too.
    expect(badgeBox.y + badgeBox.cy).toBeLessThanOrEqual(SLIDE_HEIGHT_EMU);
    expect(budgetBox.y + budgetBox.cy).toBeLessThanOrEqual(SLIDE_HEIGHT_EMU);

    // Budget line sits below the health badge line, not overlapping it.
    expect(budgetBox.y).toBeGreaterThanOrEqual(badgeBox.y + badgeBox.cy);
  });

  it("keeps client identity (PRESENTED TO, account name) on the left, unaffected by the move", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹" });
    const zip = await JSZip.loadAsync(buffer);
    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

    const presentedToBox = shapeBox(coverXml, "PRESENTED TO");
    const nameBox = shapeBox(coverXml, "Acme Inc");
    expect(presentedToBox.x).toBeLessThan(SLIDE_WIDTH_EMU / 2);
    expect(nameBox.x).toBeLessThan(SLIDE_WIDTH_EMU / 2);
  });

  // A shape's declared <a:ext cx/cy> doesn't by itself guarantee the text
  // inside it won't visually wrap — wrap="square" text boxes here have no
  // clipping, so wrapped text just renders past the declared height. This
  // was a real bug during development: at an earlier, narrower box width,
  // this exact worst-case pair wrapped and the budget line's second line
  // was clipped off the bottom of the slide in an actual LibreOffice
  // render (screenshotted and visually confirmed, both broken and fixed).
  //
  // text-fit.ts's estimateTextWidthPt() is deliberately NOT reused here —
  // it's calibrated for Poppins (the account/campaign name font), and
  // these two lines render in Arial at a different size; applying a
  // mismatched font's calibration would produce a meaningless number, not
  // a stronger check. Instead this pins the box's own width to the exact
  // value already verified empirically, so a future accidental narrowing
  // fails loudly here instead of silently reintroducing the clipping bug.
  it("keeps the empirically-verified box width that fits the ticket's worst-case content on one line", async () => {
    const templateBuffer = fs.readFileSync(DARK_TEMPLATE_PATH);
    const buffer = await renderPptx({ templateBuffer, data: buildFixtureData(), currencySymbol: "₹" });
    const zip = await JSZip.loadAsync(buffer);
    const coverXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

    const badgeBox = shapeBox(coverXml, "Campaigns On Track");
    const budgetBox = shapeBox(coverXml, "Monthly Ad Budget");
    const MIN_VERIFIED_CX_EMU = 6000000;
    expect(badgeBox.cx).toBeGreaterThanOrEqual(MIN_VERIFIED_CX_EMU);
    expect(budgetBox.cx).toBeGreaterThanOrEqual(MIN_VERIFIED_CX_EMU);
  });
});

describe("renderPptx — Light template (templates/meta-ads-light.pptx), against the actual production asset", () => {
  const LIGHT_TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/meta-ads-light.pptx");

  it("renders every slide with dark-navy text instead of the dark template's white, and no leftover white-on-white text", async () => {
    if (!fs.existsSync(LIGHT_TEMPLATE_PATH)) {
      throw new Error(`Light template not found at ${LIGHT_TEMPLATE_PATH}`);
    }
    const templateBuffer = fs.readFileSync(LIGHT_TEMPLATE_PATH);

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: 100000,
      mtdDailyRows: [...prospecting, ...retargeting, ...awareness],
      now: NOW,
    });

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹", isLightTemplate: true });
    const outPath = path.join(os.tmpdir(), `nre-render-light-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    // No raw XML anywhere in the generated deck should still say FFFFFF as
    // TEXT — every dark-template white text this pipeline touches (template
    // tag runs via the swapped theme, plus the from-scratch chart slide's
    // title/body text and the table's Previous Month row highlight) must
    // have flipped to a light-template-appropriate color instead of
    // silently staying white (which would render invisible against the
    // light template's own white/light backgrounds), with three legitimate
    // exceptions: the Combined Total table's own header row, whose
    // background is deliberately kept dark navy for contrast (spec: "Table
    // header background"), so its text is deliberately kept white too
    // (spec: "Table header text" — see patch_table_header_row in the
    // template generator script); the chart slide's donut "hole" fill, one
    // per campaign, which is deliberately white per spec's "Card/shape
    // backgrounds: #ffffff" (see BG_COLOR_LIGHT in chart-slide.ts); and the
    // Metric Abbreviation Guide legend slide's own cards, which — per Fix
    // 2's spec — are always a fixed dark navy card with white explanation
    // text regardless of template (see legend-slide.ts), one white run per
    // metric entry shown.
    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files).filter((p) => p.startsWith("ppt/slides/slide"));
    expect(slidePaths.length).toBeGreaterThan(0);
    const chartCampaignCount = data.chart?.campaigns.length ?? 0;
    for (const path of slidePaths) {
      const xml = await zip.file(path)!.async("string");
      const isTableSlide = xml.includes("CAMPAIGN PERFORMANCE OVERVIEW");
      // Case-insensitive for the same reason as the locator above — isTableSlide
      // is still checked first in the ternary below, so overlap with the table
      // slide's own heading here is harmless.
      const isChartSlide = xml.toLowerCase().includes("campaign performance");
      const isLegendSlide = xml.includes("METRIC ABBREVIATION GUIDE");
      const whiteCount = (xml.match(/val="FFFFFF"/gi) || []).length;
      // The legend slide's own white-run count should match its own amber
      // (term) run count 1:1 — one card, one term, one explanation each.
      const legendEntryCount = (xml.match(/val="f6ad55"/gi) || []).length;
      const expected = isTableSlide ? 20 : isChartSlide ? chartCampaignCount : isLegendSlide ? legendEntryCount : 0;
      expect(whiteCount).toBe(expected);
    }

    const { slideTexts } = inspectWithPythonPptx(outPath);
    const [cover, campaign1, , , , chart, table] = slideTexts;
    expect(cover).toContain("Test Agency");
    expect(campaign1).not.toContain("{{");
    // Case-insensitive: the title is title-case ("[Month] Campaign
    // Performance") whenever a month name is available, not always the
    // all-caps fallback.
    expect(chart.toLowerCase()).toContain("campaign performance");
    expect(table).toContain("CAMPAIGN PERFORMANCE OVERVIEW");

    fs.unlinkSync(outPath);
  }, 30000);

  it("uses the light-template Previous Month row highlight, not the dark template's near-black shade", async () => {
    if (!fs.existsSync(LIGHT_TEMPLATE_PATH)) {
      throw new Error(`Light template not found at ${LIGHT_TEMPLATE_PATH}`);
    }
    const templateBuffer = fs.readFileSync(LIGHT_TEMPLATE_PATH);

    const junePeriodRows = [
      {
        _raw: {},
        campaign_name: "Shoes - Purchases",
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
      mtdDailyRows: [...prospecting, ...retargeting, ...awareness],
      periodRows: junePeriodRows as unknown as NreRow[],
      now: NOW,
    });

    const buffer = await renderPptx({ templateBuffer, data, currencySymbol: "₹", isLightTemplate: true });
    const outPath = path.join(os.tmpdir(), `nre-render-light-row-${Date.now()}.pptx`);
    fs.writeFileSync(outPath, buffer);

    const { rowFillColors } = inspectTableSlide(outPath, 6);
    expect(rowFillColors[1]).toBe("F0D9B5");
    expect(rowFillColors[1]).not.toBe("111F35");

    fs.unlinkSync(outPath);
  }, 30000);
});

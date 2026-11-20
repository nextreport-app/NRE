import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
}));
import { parseCsvText } from "../parse-csv";
import {
  parseMetaContentSource,
  buildMetaContentPresentation,
} from "../meta-report-content/data";
import { contentOnlyPrimary } from "../meta-report-content/primary";
import {
  metaReportOptions,
  assertMetaReportSource,
  type MetaReportSelection,
} from "../meta-report-content/selection";
import { standaloneMetaRange } from "../meta-report-content/range";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { verifyStandardWizardReportAgainstCsv } from "../wizard-csv-verification";
import { renderPptx } from "@/lib/pptx/render";
import { buildShareReportData } from "../share-report";
import { ShareReportView } from "@/components/share-report-view";
import { renderToStaticMarkup } from "react-dom/server";
import { metaApiImportRange } from "../meta-api-import-range";
const headers =
  "Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Results,Result type,Clicks (all)";
const rows =
  "Example,Set,2026-11-10,10,100,,,5\nExample,Set,2026-11-11,20,200,1,Leads (form),10";
const dates = {
  mode: "custom" as const,
  customStart: "2026-11-10",
  customEnd: "2026-11-11",
};
const now = new Date("2026-11-19T12:00:00Z");
const client = {
  id: "client",
  userId: "owner",
  accountName: "Example",
  currency: "USD",
  timezone: "UTC",
  monthlyBudget: null,
  campaignObjectiveCache: null,
  showBudgetPacingOnCover: false,
} as never;
function fixture(kind: "BREAKDOWN" | "CREATIVE") {
  const parsed = parseCsvText(
    `${headers},${kind === "CREATIVE" ? "Ad ID,Ad name" : "Age"}\n${rows.replace("100,,,5\n", `100,,,5,${kind === "CREATIVE" ? "100,Same ad" : "25-34"}\n`)},${kind === "CREATIVE" ? "100,Same ad" : "25-34"}`,
  );
  const source = parseMetaContentSource(parsed, "USD");
  const selection: MetaReportSelection =
    kind === "CREATIVE" ? { kind } : { kind, dimension: "age" };
  assertMetaReportSource(selection, source);
  const { parsed: primary, content } = contentOnlyPrimary(source);
  content.selection = selection;
  content.options = metaReportOptions(selection);
  return { source, selection, primary, content };
}
describe("first-class Breakdown and Creative reports", () => {
  it("keeps zero-result spend with its explicitly observed event instead of understating cost", () => {
    const { content } = fixture("BREAKDOWN");
    const result = buildMetaContentPresentation(
      content,
      [{ startIso: dates.customStart, endIso: dates.customEnd }],
      null,
      "$",
    )!;
    expect(result.pages.filter(page => page.kind !== "summary")).toHaveLength(1);
    expect(result.pages.find(page => page.kind !== "summary")!.rows[0]).toMatchObject({
      spend: 30,
      results: 1,
      cpr: 30,
      ctr: 5,
    });
  });
  it("requires the chosen audience dimension and location level", () => {
    const { source } = fixture("BREAKDOWN");
    expect(() =>
      assertMetaReportSource(
        { kind: "BREAKDOWN", dimension: "location" },
        source,
      ),
    ).toThrow(/selected on Import/);
    const region = parseMetaContentSource(
      parseCsvText(
        `${headers},Region\nExample,Set,2026-11-10,10,100,1,Leads (form),5,Tennessee`,
      ),
      "USD",
    );
    expect(() =>
      assertMetaReportSource(
        { kind: "BREAKDOWN", dimension: "location", locationLevel: "country" },
        region,
      ),
    ).toThrow(/Region or Country/);
  });
  it("uses the exact selected period for API and CSV without weekly/MTD expansion or date shifting", () => {
    const { primary } = fixture("BREAKDOWN");
    expect(standaloneMetaRange(primary.rows, dates, "UTC", now)).toEqual({
      startIso: dates.customStart,
      endIso: dates.customEnd,
    });
    expect(() =>
      standaloneMetaRange(
        primary.rows,
        { ...dates, customEnd: "2026-11-12" },
        "UTC",
        now,
      ),
    ).toThrow(/does not cover/);
    expect(
      metaApiImportRange(
        {
          reportType: "WEEKLY",
          reportSelection: { kind: "BREAKDOWN", dimension: "age" },
          dateSelection: dates,
          includePreviousMonthComparison: true,
        },
        now,
        "UTC",
      ),
    ).toEqual({ sinceIso: dates.customStart, untilIso: dates.customEnd });
  });
  it.each(["BREAKDOWN", "CREATIVE"] as const)(
    "builds a standalone %s with correct title, source checks, browser and native PPTX",
    async (kind) => {
      const { primary, content, selection } = fixture(kind);
      const form = new FormData();
      form.set("reportType", '"WEEKLY"');
      form.set("dateSelection", JSON.stringify(dates));
      form.set("reportSelection", JSON.stringify(selection));
      const built = await buildStandardReportForWizard({
        client,
        platform: "META",
        mtdParsed: {
          ...primary,
          reportSelection: selection,
          metaReportContent: content,
        },
        formData: form,
        now,
      });
      if (!("data" in built)) throw Error(built.error);
      const data = built.data;
      expect(data.metaContent?.includeStandard).toBe(false);
      expect(data.metaContent?.reportKind).toBe(kind);
      expect(data.metaContent?.pages.find(page => page.kind !== "summary")!.rows[0].cpr).toBe(30);
      expect(
        verifyStandardWizardReportAgainstCsv({
          client,
          platform: "META",
          mtdRows: primary.rows,
          report: data,
          reportType: "WEEKLY",
          formData: form,
          metaReportContent: content,
          now,
        }).status,
      ).toBe("ok");
      const share = buildShareReportData(data, new Map());
      expect(share.metricGuide.some((entry) => entry.term === "REACH")).toBe(
        false,
      );
      const html = renderToStaticMarkup(<ShareReportView data={share} />);
      expect(html).toContain(
        kind === "CREATIVE"
          ? "CREATIVE PERFORMANCE REPORT"
          : "AGE BREAKDOWN REPORT",
      );
      expect(html).not.toContain("Includes weekly, MTD");
      const bytes = await renderPptx({
        templateBuffer: fs.readFileSync("templates/dark.pptx"),
        data,
        currencySymbol: "$",
      });
      const zip = await JSZip.loadAsync(bytes);
      const files = Object.keys(zip.files).filter((path) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(path),
      );
      expect(files).toHaveLength(4);
      const cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
      expect(cover).toContain(
        kind === "CREATIVE"
          ? "CREATIVE PERFORMANCE REPORT"
          : "AGE BREAKDOWN REPORT",
      );
      expect(cover).not.toContain("WEEKLY PERFORMANCE REPORT");
      if (process.env.CONTENT_WORKFLOW_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.CONTENT_WORKFLOW_ARTIFACT_DIR, {
          recursive: true,
        });
        fs.writeFileSync(
          `${process.env.CONTENT_WORKFLOW_ARTIFACT_DIR}/${kind}.pptx`,
          bytes,
        );
        fs.writeFileSync(
          `${process.env.CONTENT_WORKFLOW_ARTIFACT_DIR}/${kind}.json`,
          JSON.stringify({
            data,
            summary: {
              selection,
              options: content.options,
              campaigns: ["Example"],
              sources: content.sources.map((source) => ({
                coverage: source.coverage,
              })),
              ads:
                kind === "CREATIVE"
                  ? [{ id: "100", name: "Same ad", hasImage: false }]
                  : [],
            },
            primary,
            selection,
            share,
          }),
        );
      }
    },
    30000,
  );
});

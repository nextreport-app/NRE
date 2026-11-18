import { previousMonthRows } from "../previous-month-source";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
}));
vi.mock("@/lib/meta-api", async (original) => ({
  ...(await original<typeof import("@/lib/meta-api")>()),
  fetchMetaAdAccountInsights: vi.fn(),
  fetchMetaAdSetReportingConfigs: vi.fn(),
  fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]),
}));
import {
  fetchMetaAdAccountInsights,
  fetchMetaAdSetReportingConfigs,
  type MetaInsightRow,
} from "@/lib/meta-api";
import {
  directlyEvidencedResult,
  configuredResultCountSource,
} from "../meta-api-sync/direct-result-evidence";
import { fetchMetaReportCsv } from "../meta-api-sync/fetch-meta-report-csv";
import { parseCsvText } from "../parse-csv";
import { rowsToCsv } from "../rows-to-csv";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { verifyStandardWizardReportAgainstCsv } from "../wizard-csv-verification";
import { buildShareReportData } from "../share-report";
import { renderPptx } from "@/lib/pptx/render";
import { buildFallbackSummary, buildFallbackInsights } from "@/lib/ai/prompts";
import { metaApiSelectionCoverageError } from "../meta-api-selection-coverage";
import {
  META_API_RESULT_MAPPING_HEADER,
  META_API_RESULT_MAPPING_VERSION,
} from "../meta-api-result-version";
import { syntheticResultTypeFromMetaResultIndicator } from "../meta-result-indicator";
const application = "offsite_conversion.fb_pixel_submit_application";
const dates = Array.from({ length: 30 }, (_, i) =>
  new Date(Date.UTC(2026, 9, 19 + i)).toISOString().slice(0, 10),
);
function syntheticManual() {
  const headers = [
    "Campaign name",
    "Ad set name",
    "Day",
    "Amount spent (USD)",
    "Impressions",
    "Reach",
    "Results",
    "Result type",
    "Clicks (all)",
    "CTR (all)",
    "CPC (all)",
    "Link clicks",
    "Landing page views",
    "Website leads",
    "Results (initial)",
  ];
  return parseCsvText(
    rowsToCsv(
      headers,
      dates.map((day) => {
        const results =
          day === "2026-10-20"
            ? 8
            : day === "2026-11-02"
              ? 1
              : day === "2026-11-05"
                ? 2
                : day === "2026-11-12"
                  ? 1
                  : 0;
        const spend =
          day === "2026-10-19"
            ? 6.54
            : day === "2026-11-01"
              ? 15.32
              : day === "2026-11-17"
                ? 9.68
                : 10;
        const impressions =
          day === "2026-10-19"
            ? 1031
            : day === "2026-11-01"
              ? 1392
              : day === "2026-11-17"
                ? 430
                : 400;
        return [
          "Application campaign",
          "Set",
          day,
          String(spend),
          String(impressions),
          "200",
          results ? String(results) : "",
          results ? "Website applications submitted" : "",
          "10",
          String(1000 / impressions),
          String(spend / 10),
          "6",
          "3",
          results ? String(results) : "",
          "",
        ];
      }),
    ),
  );
}
// Private data can be exercised locally without committing client exports.
const manual = process.env.APPLICATION_PARITY_CSV
  ? parseCsvText(fs.readFileSync(process.env.APPLICATION_PARITY_CSV, "utf8"))
  : syntheticManual();
const client = {
  id: "fixture",
  userId: "owner",
  accountName: process.env.APPLICATION_ACCOUNT_NAME ?? "Application report",
  currency: "USD",
  timezone: "America/Chicago",
  monthlyBudget: null,
  campaignObjectiveCache: null,
  showBudgetPacingOnCover: false,
} as never;
const now = new Date("2026-11-18T12:00:00Z");
function form() {
  const form = new FormData();
  form.set("reportType", '"WEEKLY"');
  form.set(
    "dateSelection",
    JSON.stringify({
      mode: "custom",
      customStart: "2026-11-11",
      customEnd: "2026-11-17",
    }),
  );
  return form;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([
    {
      id: "11",
      optimization_goal: "OFFSITE_CONVERSIONS",
      promoted_object: {
        pixel_id: "9",
        custom_event_type: "SUBMIT_APPLICATION",
      },
    },
  ]);
});
describe("website application API/CSV parity", () => {
  it.each(["submit_application_website", application])(
    "reads the configured website event from conversions.%s",
    (type) => {
      const row = {
        configured_result_action: application,
        spend: "69.68",
        actions: [{ action_type: "lead", value: "99" }],
        conversions: [
          { action_type: type, value: "1" },
          { action_type: "submit_application_total", value: "20" },
        ],
      } satisfies MetaInsightRow;
      expect(directlyEvidencedResult(row)).toMatchObject({
        value: "1",
        cpr: "69.68",
        csvResultType: "Website applications submitted",
      });
      expect(configuredResultCountSource(row)).toBe(
        `conversions.${type}.value`,
      );
    },
  );
  it("preserves observed action zero and never adds alternate channels", () => {
    const row = {
      configured_result_action: application,
      spend: "10",
      actions: [{ action_type: application, value: "0" }],
      conversions: [{ action_type: "submit_application_website", value: "5" }],
    } satisfies MetaInsightRow;
    expect(directlyEvidencedResult(row)?.value).toBe("0");
    expect(configuredResultCountSource(row)).toBe("actions.value");
    expect(
      directlyEvidencedResult({
        ...row,
        actions: [{ action_type: application, value: "2" }],
      })?.value,
    ).toBe("2");
  });
  it("rejects conflicting or all-location-only application counts rather than silently reporting zero", () => {
    const row = {
      configured_result_action: application,
      spend: "10",
      actions: [],
    } satisfies MetaInsightRow;
    expect(() =>
      directlyEvidencedResult({
        ...row,
        conversions: [{ action_type: "submit_application_total", value: "9" }],
      }),
    ).toThrow(/without a website-specific count/);
    expect(() =>
      directlyEvidencedResult({
        ...row,
        conversions: [
          { action_type: "submit_application_website", value: "1" },
          { action_type: application, value: "2" },
        ],
      }),
    ).toThrow(/conflicting/);
    expect(() =>
      directlyEvidencedResult({
        ...row,
        conversions: [
          { action_type: "submit_application_website", value: "1" },
          { action_type: "submit_application_website", value: "2" },
        ],
      }),
    ).toThrow(/conflicting/);
    expect(
      directlyEvidencedResult({
        ...row,
        conversions: [
          { action_type: "submit_application_website", value: "0" },
          { action_type: "submit_application_total", value: "9" },
        ],
      })?.value,
    ).toBe("0");
  });
  it("invalidates old stored previous-month application data as well as the primary import", () => {
    const old = ["2026-10-01", "2026-10-31"].map((day) => ({
      ...manual.rows[0],
      _raw: {
        ...manual.rows[0]._raw,
        Day: day,
        "NRE API result action": application,
      },
    }));
    expect(previousMonthRows(old, "UTC", now)).toBeUndefined();
    const fresh = old.map((row) => ({
      ...row,
      _raw: {
        ...row._raw,
        [META_API_RESULT_MAPPING_HEADER]: META_API_RESULT_MAPPING_VERSION,
      },
    }));
    expect(previousMonthRows(fresh, "UTC", now)).toHaveLength(2);
  });
  it("requires a fresh sync for old application sessions and preserves indicator identity", () => {
    const rows = manual.rows.map((row) => ({
      ...row,
      _raw: { ...row._raw, "NRE API result action": application },
    }));
    expect(metaApiSelectionCoverageError(form(), rows, "UTC", now)).toMatch(
      /sync Meta again/,
    );
    const fresh = rows.map((row) => ({
      ...row,
      _raw: {
        ...row._raw,
        [META_API_RESULT_MAPPING_HEADER]: META_API_RESULT_MAPPING_VERSION,
      },
    }));
    expect(metaApiSelectionCoverageError(form(), fresh, "UTC", now)).toBeNull();
    expect(
      metaApiSelectionCoverageError(form(), manual.rows, "UTC", now),
    ).toBeNull();
    expect(
      syntheticResultTypeFromMetaResultIndicator(
        "conversions:submit_application_website",
      ),
    ).toBe("Website applications submitted");
  });
  it("preserves weekly 1 / MTD 4 / chart 12 and their costs in CSV, API, browser and PPTX", async () => {
    vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue(
      manual.rows.map((row) => ({
        campaign_id: "1",
        campaign_name: row.campaign_name,
        adset_id: "11",
        adset_name: row.ad_set_name,
        date_start: row._raw.Day,
        date_stop: row._raw.Day,
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        ctr: row.ctr,
        cpc: row.cpc,
        inline_link_clicks: row.link_clicks,
        clicks: row._raw["Clicks (all)"],
        frequency: row.frequency,
        actions: [
          { action_type: "link_click", value: row.link_clicks || "0" },
          {
            action_type: "landing_page_view",
            value: row.landing_page_views || "0",
          },
        ],
        conversions: [
          {
            action_type: "submit_application_website",
            value: String(Number(row.results) || 0),
          },
          { action_type: "submit_application_total", value: "99" },
        ],
      })),
    );
    const source = await fetchMetaReportCsv({
      accessToken: "fixture-token",
      adAccountId: "123",
      currency: "USD",
      timezone: "America/Chicago",
      sinceIso: "2026-10-19",
      untilIso: "2026-11-17",
      requireDirectResultEvidence: true,
    });
    const api = parseCsvText(source.csvText);
    expect(api.rows.reduce((n, row) => n + Number(row.results), 0)).toBe(12);
    expect(api.rows[0]._raw["NRE API result source"]).toBe(
      "conversions.submit_application_website.value",
    );
    const outputs = [];
    for (const parsed of [manual, api]) {
      const built = await buildStandardReportForWizard({
        client,
        platform: "META",
        mtdParsed: parsed,
        formData: form(),
        now,
      });
      if (!("data" in built)) throw Error(built.error);
      const data = built.data;
      const slide = data.campaignSlides[0];
      expect(slide.metrics).toMatchObject({
        spend: "$69.68",
        results: "1",
        cpr: "$69.68",
      });
      expect(data.mtdRow.resultColumns[0]).toMatchObject({
        value: "4",
        cprValue: "$43.75",
      });
      expect(data.chart!.campaigns[0].results).toBe(12);
      expect(data.chart!.snapshot.objectives[0].cprValue).toBe("$25.13");
      expect(
        verifyStandardWizardReportAgainstCsv({
          client,
          platform: "META",
          mtdRows: parsed.rows,
          report: data,
          reportType: "WEEKLY",
          formData: form(),
          now,
        }).status,
      ).toBe("ok");
      const ai = new Map([
        [
          `campaign:${slide.campaignName}`,
          {
            summary: buildFallbackSummary(slide.ai),
            insights: buildFallbackInsights(slide.ai),
          },
        ],
      ]);
      expect(ai.get(`campaign:${slide.campaignName}`)!.summary).not.toMatch(
        /recorded none|0 website/,
      );
      const share = buildShareReportData(data, ai);
      expect(
        share.campaigns[0].metrics.find((metric) => metric.key === "results")
          ?.value,
      ).toBe("1");
      const bytes = await renderPptx({
        templateBuffer: fs.readFileSync("templates/dark.pptx"),
        data,
        currencySymbol: "$",
        aiCopyBySlideKey: ai,
      });
      const zip = await JSZip.loadAsync(bytes);
      const campaign = await zip.file("ppt/slides/slide2.xml")!.async("string");
      expect(campaign).toContain("$69.68");
      expect(campaign).toContain("<a:t>1</a:t>");
      expect(campaign).not.toContain("recorded none");
      outputs.push({
        weekly: slide.metrics.results,
        mtd: data.mtdRow.resultColumns[0].value,
        chart: data.chart!.campaigns[0].results,
      });
      if (process.env.APPLICATION_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.APPLICATION_ARTIFACT_DIR, { recursive: true });
        const prefix = parsed === manual ? "csv" : "api";
        fs.writeFileSync(
          `${process.env.APPLICATION_ARTIFACT_DIR}/${prefix}.pptx`,
          bytes,
        );
        fs.writeFileSync(
          `${process.env.APPLICATION_ARTIFACT_DIR}/${prefix}-share.json`,
          JSON.stringify(share),
        );
      }
    }
    expect(outputs[0]).toEqual(outputs[1]);
  }, 30000);
});

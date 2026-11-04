import { adSetKey } from "../ad-sets";
import { adSetVisibilityKey } from "../share-report";
import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { parseCsvText } from "../parse-csv";
import { buildReportData, buildComparisonReportData } from "../report-data";
import { buildHistoricalReportData } from "../historical-report-data";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import {
  buildDayBreakdownShareReportData,
  buildHistoricalShareReportData,
  restoreHistoricalShareCharts,
} from "../share-report";
import { regeneratePptxFromShare } from "../regenerate-report";
import { countVisibleSlides } from "../share-visibility";
import {
  renderPptx,
  renderHistoricalPptx,
  renderComparisonPptx,
  renderDayBreakdownPptx,
} from "../../pptx/render";

const days = Array.from({ length: 92 }, (_, i) =>
  new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10),
);
const source = parseCsvText(
  `Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Impressions,Reach,Link clicks\n${days.map((day) => `Example_Traffic_LinkClicks,Main,${day},10,20,Link clicks,1000,500,20`).join("\n")}`,
);
const base = {
  accountName: "Workflow Review Sample",
  currencySymbol: "$",
  timezone: "Australia/Sydney",
  monthlyBudget: null,
  mtdDailyRows: source.rows,
  now: new Date("2026-10-01T12:00:00Z"),
};
const daily = buildDayBreakdownReportData({
  ...base,
  dateRange: { startIso: "2026-09-01", endIso: "2026-09-10" },
});
const historical = buildHistoricalReportData({ ...base, monthCount: 2 });
const comparison = buildComparisonReportData({
  ...base,
  periodA: { startIso: "2026-09-01", endIso: "2026-09-30" },
  periodB: { startIso: "2026-08-01", endIso: "2026-08-31" },
});
async function validateDeck(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });
  for (const file of Object.keys(zip.files).filter((name) =>
    name.endsWith(".rels"),
  )) {
    const entries =
      parser.parse(await zip.file(file)!.async("string"))?.Relationships
        ?.Relationship ?? [];
    for (const relationship of Array.isArray(entries) ? entries : [entries]) {
      if (relationship.TargetMode === "External") {
        expect(new URL(relationship.Target).protocol).toMatch(
          /^(https?:|mailto:)$/,
        );
        continue;
      }
      const sourceDir = posix.dirname(posix.dirname(file));
      const target = posix.normalize(
        posix.join(sourceDir, relationship.Target),
      );
      expect(zip.file(target), `${file} -> ${target}`).not.toBeNull();
    }
  }
  const slides = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  expect(slides.length).toBeGreaterThan(2);
  const texts = await Promise.all(
    slides.map(async (name) => {
      const xml = await zip.file(name)!.async("string");
      expect(xml).not.toMatch(/\{\{[^}]+\}\}/);
      const text = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
        .map((match) => match[1])
        .join(" | ");
      expect(text.trim()).not.toBe("");
      return text;
    }),
  );
  expect(texts.join("\n")).toContain("METRIC ABBREVIATION GUIDE");
  return texts;
}

describe.each(["dark.pptx", "meta-ads-light.pptx"])(
  "final workflow review: %s",
  (filename) => {
    const theme = {
      templateBuffer: readFileSync(resolve("templates", filename)),
      isLightTemplate: filename.includes("light"),
    };
    it.each(["weekly", "monthly", "comparison", "daily"] as const)(
      "has complete slides and resolved package links: %s",
      async (kind) => {
        const bytes =
          kind === "weekly"
            ? await renderPptx({
                ...theme,
                data: buildReportData(base),
                currencySymbol: "$",
              })
            : kind === "monthly"
              ? await renderHistoricalPptx({ ...theme, data: historical })
              : kind === "comparison"
                ? await renderComparisonPptx({ ...theme, data: comparison })
                : await renderDayBreakdownPptx({ ...theme, data: daily });
        const texts = await validateDeck(bytes);
        if (kind === "monthly")
          expect(
            texts.filter((text) => text.includes("SPEND BY OBJECTIVE")),
          ).toHaveLength(2);
        if (kind === "comparison")
          expect(texts.join("\n")).not.toContain("Last 30 Days");
        if (kind === "daily")
          expect(texts.join("\n")).toContain("SELECTED PERIOD TOTALS");
        if (process.env.REPORT_REVIEW_ARTIFACT_DIR) {
          mkdirSync(process.env.REPORT_REVIEW_ARTIFACT_DIR, {
            recursive: true,
          });
          writeFileSync(
            resolve(
              process.env.REPORT_REVIEW_ARTIFACT_DIR,
              `${kind}-${theme.isLightTemplate ? "light" : "dark"}.pptx`,
            ),
            bytes,
          );
        }
      },
      30000,
    );
    it("embeds the client logo into comparison covers with valid package relationships", async () => {
    const bytes = await renderComparisonPptx({ ...theme, data: comparison, clientLogo: { bytes: readFileSync(resolve("public/logo.png")), widthPx: 1048, heightPx: 1048, extension: "png", contentType: "image/png" } });
    await validateDeck(bytes);
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file("ppt/slides/slide1.xml")!.async("string")).toContain("Client Logo");
  }, 30000);
  it("retains separately selected monthly ad sets when campaign details are hidden", async () => {
    const data = buildHistoricalReportData({ ...base, monthCount: 2, selectedAdSets: [adSetKey("Example_Traffic_LinkClicks", "Main")] });
    const share = buildHistoricalShareReportData(data, new Map());
    expect(share.adSets).toHaveLength(2);
    share.visibility = { ...share.visibility!, campaigns: Object.fromEntries(share.campaigns.map(c => [c.campaignName, false])) };
    const archive = { historicalData: data, isLightTemplate: theme.isLightTemplate };
    const both = await validateDeck(await regeneratePptxFromShare({ ...share, _renderArchive: archive }, theme.templateBuffer));
    expect(both.filter(text => text.includes("Main") && text.includes("AD SPEND"))).toHaveLength(2);
    share.visibility.adSets[adSetVisibilityKey(share.adSets[0].campaignName, "Main")] = false;
    const one = await validateDeck(await regeneratePptxFromShare({ ...share, _renderArchive: archive }, theme.templateBuffer));
    expect(one.filter(text => text.includes("Main") && text.includes("AD SPEND"))).toHaveLength(1);
  }, 30000);
  it("retains daily dates and content when publishing without edits", async () => {
      const share = buildDayBreakdownShareReportData(daily);
      const before = await validateDeck(
        await renderDayBreakdownPptx({ ...theme, data: daily }),
      );
      const after = await validateDeck(
        await regeneratePptxFromShare(
          {
            ...share,
            _renderArchive: {
              dayBreakdownData: daily,
              isLightTemplate: theme.isLightTemplate,
            },
          },
          theme.templateBuffer,
        ),
      );
      expect(after).toEqual(before);
    }, 30000);
    it("publishes daily archives, honors cover edits and every section toggle", async () => {
      const share = buildDayBreakdownShareReportData(daily);
      share.accountName = "Reviewed client";
      const archive = {
        dayBreakdownData: daily,
        isLightTemplate: theme.isLightTemplate,
      };
      const original = await validateDeck(
        await regeneratePptxFromShare(
          { ...share, _renderArchive: archive },
          theme.templateBuffer,
        ),
      );
      expect(original[0]).toContain("Reviewed client");
      expect(original).toHaveLength(countVisibleSlides(share));
      const hidden = {
        ...share,
        visibility: { ...share.visibility!, cover: false, metricGuide: false },
      };
      const bytes = await regeneratePptxFromShare(
        { ...hidden, _renderArchive: archive },
        theme.templateBuffer,
      );
      const zip = await JSZip.loadAsync(bytes);
      expect(
        Object.keys(zip.files).filter((name) =>
          /^ppt\/slides\/slide\d+\.xml$/.test(name),
        ),
      ).toHaveLength(countVisibleSlides(hidden));
    }, 30000);
    it("restores monthly charts from older saved archives without overwriting a new hide choice", () => {
      const share = buildHistoricalShareReportData(historical, new Map());
      delete share.historicalCharts;
      share.visibility = { ...share.visibility!, overview: false };
      const restored = restoreHistoricalShareCharts({
        ...share,
        _renderArchive: { historicalData: historical },
      });
      expect(restored.historicalCharts).toHaveLength(2);
      expect(restored.visibility?.overview).toBe(true);
      const hidden = {
        ...restored,
        visibility: { ...restored.visibility!, overview: false },
      };
      expect(restoreHistoricalShareCharts(hidden).visibility?.overview).toBe(
        false,
      );
    });
    it("keeps monthly browser charts and PPT overview when campaign details are hidden", async () => {
      const share = buildHistoricalShareReportData(historical, new Map());
      expect(share.historicalCharts).toHaveLength(2);
      share.visibility = {
        ...share.visibility!,
        campaigns: Object.fromEntries(
          share.campaigns.map((campaign) => [campaign.campaignName, false]),
        ),
      };
      const archive = {
        historicalData: historical,
        isLightTemplate: theme.isLightTemplate,
      };
      const texts = await validateDeck(
        await regeneratePptxFromShare(
          { ...share, _renderArchive: archive },
          theme.templateBuffer,
        ),
      );
      expect(
        texts.filter((text) => text.includes("SPEND BY OBJECTIVE")),
      ).toHaveLength(2);
      share.visibility = {
        ...share.visibility,
        cover: false,
        overview: false,
        combinedTotal: false,
      };
      const zip = await JSZip.loadAsync(
        await regeneratePptxFromShare(
          { ...share, _renderArchive: archive },
          theme.templateBuffer,
        ),
      );
      const output = await Promise.all(
        Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .map((name) => zip.file(name)!.async("string")),
      );
      expect(output).toHaveLength(1);
      expect(output[0]).toContain("METRIC ABBREVIATION GUIDE");
    }, 30000);
  },
);

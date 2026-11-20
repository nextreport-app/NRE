import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
}));
import { parseCsvText } from "@/lib/nre/parse-csv";
import { buildStandardReportForWizard } from "@/lib/nre/report-engine/build-standard-from-wizard";
import { parseMetaContentSource } from "@/lib/nre/meta-report-content/data";
import { snapshotCreativeImage } from "@/lib/nre/meta-report-content/api";
import { renderPptx } from "../render";
import { buildShareReportData } from "@/lib/nre/share-report";
import { ShareReportView } from "@/components/share-report-view";
import type { Client } from "@/generated/prisma/client";
import type { MetaReportContent } from "@/lib/nre/meta-report-content/types";
const csv =
  "Campaign name,Ad set name,Campaign ID,Ad set ID,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all)\nExample,Set,1,11,2026-11-10,10,1,Leads (form),100,5\nExample,Set,1,11,2026-11-11,20,2,Leads (form),200,10";
const client = {
  id: "client",
  userId: "owner",
  accountName: "Example",
  currency: "USD",
  timezone: "UTC",
  monthlyBudget: null,
  previousMonthDataUrl: null,
  campaignObjectiveCache: null,
  showBudgetPacingOnCover: false,
} as Client;
async function fixture(includeStandard = true) {
  const parsed = parseCsvText(csv);
  const source = parseMetaContentSource(
    parseCsvText(
      csv
        .replace("Clicks (all)\n", "Clicks (all),Age\n")
        .replace("100,5\n", "100,5,25-34\n")
        .replace("200,10", "200,10,35-44"),
    ),
    "USD",
  );
  const ads = parseMetaContentSource(
    parseCsvText(
      csv
        .replace("Clicks (all)\n", "Clicks (all),Ad ID,Ad name\n")
        .replace("100,5\n", "100,5,100,Sample creative\n")
        .replace("200,10", "200,10,100,Sample creative"),
    ),
    "USD",
  );
  const media = await snapshotCreativeImage(
    await sharp({
      create: { width: 300, height: 200, channels: 3, background: "#168acd" },
    })
      .png()
      .toBuffer(),
  );
  const content: MetaReportContent = {
    version: 1,
    options: {
      audience: ["age"],
      creatives: true,
      includeStandard,
      ranking: "cpr",
      minSpend: 0,
      minResults: 1,
    },
    sources: [source, ads],
    media: { "100": media },
    notices: [],
  };
  const form = new FormData();
  form.set("reportType", JSON.stringify("WEEKLY"));
  form.set(
    "dateSelection",
    JSON.stringify({
      mode: "custom",
      customStart: "2026-11-10",
      customEnd: "2026-11-11",
    }),
  );
  const built = await buildStandardReportForWizard({
    client,
    platform: "META",
    mtdParsed: { ...parsed, metaReportContent: content },
    formData: form,
    now: new Date("2026-11-12T12:00:00Z"),
  });
  if (!("data" in built)) throw Error(built.error);
  return built.data;
}
describe("Meta content client-facing output", () => {
  it.each(["DARK", "LIGHT"])(
    "embeds media bytes and preserves the same source numbers in browser and %s PPTX",
    async (theme) => {
      const data = await fixture();
      const bytes = await renderPptx({
        templateBuffer: fs.readFileSync(
          theme === "DARK"
            ? "templates/dark.pptx"
            : "templates/meta-ads-light.pptx",
        ),
        data,
        currencySymbol: "$",
        isLightTemplate: theme === "LIGHT",
      });
      const zip = await JSZip.loadAsync(bytes);
      const slidePaths = Object.keys(zip.files).filter((path) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(path),
      );
      const xmls = await Promise.all(
        slidePaths.map((path) => zip.file(path)!.async("string")),
      );
      const text = xmls.join("\n");
      expect(text).toContain("Age performance");
      expect(text).toContain("Creative performance");
      expect(text).toContain("$30.00");
      expect(text).toContain("100");
      expect(text).not.toContain("{{");
      const media = Object.keys(zip.files).filter((path) =>
        /^ppt\/media\/meta-content-.*\.jpeg$/.test(path),
      );
      expect(media).toHaveLength(1);
      expect(
        (await zip.file(media[0])!.async("nodebuffer")).length,
      ).toBeGreaterThan(100);
      const html = renderToStaticMarkup(
        <ShareReportView data={buildShareReportData(data, new Map())} />,
      );
      expect(html).toContain("Age performance");
      expect(html).toContain("Campaign summary");
      expect(html).toContain("Key insights &amp; updates");
      for (const page of data.metaContent!.pages.filter(page => page.kind === "summary")) {
        expect(html).toContain(page.insight!);
        expect(text).toContain(page.insight!);
      }
      expect(html).toContain("$30.00");
      expect(html).toContain("data:image/jpeg;base64,");
      expect(html).toContain("Sample creative");
      if (process.env.META_CONTENT_ARTIFACT_DIR) {
        fs.mkdirSync(process.env.META_CONTENT_ARTIFACT_DIR, {
          recursive: true,
        });
        fs.writeFileSync(
          `${process.env.META_CONTENT_ARTIFACT_DIR}/${theme}.pptx`,
          bytes,
        );
        fs.writeFileSync(
          `${process.env.META_CONTENT_ARTIFACT_DIR}/share.json`,
          JSON.stringify(buildShareReportData(data, new Map())),
        );
      }
    },
    30000,
  );
  it("creates an audience/creative-only report without standard performance slides", async () => {
    const data = await fixture(false);
    const zip = await JSZip.loadAsync(
      await renderPptx({
        templateBuffer: fs.readFileSync("templates/dark.pptx"),
        data,
        currencySymbol: "$",
      }),
    );
    const paths = Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(path),
    );
    expect(paths).toHaveLength(2 + data.metaContent!.pages.length);
    const html = renderToStaticMarkup(
      <ShareReportView data={buildShareReportData(data, new Map())} />,
    );
    expect(html).toContain("Age performance");
    expect(html).not.toContain("Monthly Campaign Performance Overview");
  });
});

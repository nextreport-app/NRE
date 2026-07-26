/**
 * Top-level PPTX render orchestrator — builds the final ordered slide list
 * (cover, campaign summaries, ad-set slides, MTD chart, period/MTD table,
 * legend) and assembles it into a downloadable .pptx Buffer.
 *
 * Slide order matches generateWeeklyReport()'s actual output order exactly:
 * Cover → ALL campaign summary slides → ALL ad-set slides (not interleaved
 * per campaign — see report-data.ts) → MTD chart → Period/MTD table →
 * Legend. The paused case replaces everything after Cover with a single
 * message slide, and skips the chart (both match the source).
 */

import type { ReportData } from "../nre/report-data";
import { buildChartSlideXml } from "./chart-slide";
import { buildCampaignOrAdSetSlideXml, buildCoverSlideXml, buildPausedSlideXml, buildTableSlideXml, type AiCopy } from "./fill-tags";
import { embedImageInSlide, SLIDE_HEIGHT_EMU, type ImageAsset } from "./embed-image";
import { assemblePptx, loadTemplate, type LoadedTemplate, type SlideToInsert } from "./package";

const CHART_SLIDE_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/></Relationships>';

// Client logo: cover slide only, bottom-right corner, "sized approximately
// 120x60px maximum, maintaining aspect ratio" (product spec).
const CLIENT_LOGO_BOX = { corner: "bottom-right" as const, marginXEmu: 300000, marginYEmu: 300000, maxCxEmu: 120 * 9525, maxCyEmu: 60 * 9525 };

// Agency logo: every slide's footer, bottom-left corner, max 80x40px.
const AGENCY_LOGO_BOX = { corner: "bottom-left" as const, marginXEmu: 200000, marginYEmu: 200000, maxCxEmu: 80 * 9525, maxCyEmu: 40 * 9525 };

// Cover slide's bottom-left is already fully occupied edge-to-edge —
// PRESENTED_TO through BUDGET_SUMMARY are stacked with almost no slack (see
// the cover-slide spacing fix) — so flush-to-corner placement collides with
// that text regardless of which other cover branding features (Prepared By,
// client logo) are also active. Anchor the footer logo's BOTTOM edge just
// above PRESENTED_TO's top instead — only marginYEmu changes, marginXEmu
// stays identical to every other slide's footer logo. PRESENTED_TO_TOP_EMU
// must stay in sync with fill-tags.ts's PRESENTED_TO_Y (the shape's
// un-shifted, static y).
const PRESENTED_TO_TOP_EMU = 5061635;
const COVER_FOOTER_GAP_EMU = 180000;
const COVER_AGENCY_LOGO_BOX = {
  ...AGENCY_LOGO_BOX,
  marginYEmu: SLIDE_HEIGHT_EMU - (PRESENTED_TO_TOP_EMU - COVER_FOOTER_GAP_EMU),
};

export interface RenderPptxInput {
  templateBuffer: Buffer;
  data: ReportData;
  currencySymbol: string;
  /** AI-written copy per slide, keyed the same way as slideAiKey() below. Missing entries fall back to a placeholder string, matching callAI_'s own fallback. */
  aiCopyBySlideKey?: Map<string, AiCopy>;
  /** Optional custom cover-slide title — see fill-tags.ts's DEFAULT_REPORT_TITLE for the fallback. */
  reportTitle?: string | null;
  /** Agency name from account settings — drives the cover slide's "Prepared by ..." line when set. */
  agencyName?: string | null;
  /** Client's uploaded logo (already resized/normalized to PNG — see logo-processing.ts). Rendered bottom-right on the cover slide only. Absent: no change to the cover slide. */
  clientLogo?: ImageAsset | null;
  /** Agency's uploaded logo, same normalization. Rendered bottom-left in the footer of every slide. Absent: no change anywhere. */
  agencyLogo?: ImageAsset | null;
}

const TEMPLATE_PARTS = ["cover", "campaign", "table", "legend"] as const;

/**
 * Bakes the agency footer logo into each of the 4 distinct template slide
 * parts ONCE, before any per-report slide content is generated. Campaign
 * and ad-set slides all clone `template.campaign` (see the loop below in
 * renderPptx), so embedding it here means every generated clone inherits
 * the logo automatically — this is not 1 embed per generated slide, it's 1
 * embed per distinct template part.
 */
function embedAgencyFooterLogo(template: LoadedTemplate, agencyLogo: ImageAsset): void {
  for (const part of TEMPLATE_PARTS) {
    const box = part === "cover" ? COVER_AGENCY_LOGO_BOX : AGENCY_LOGO_BOX;
    const embedded = embedImageInSlide(template[part], agencyLogo, box, {
      mediaFileName: "agency-footer-logo.png",
      shapeName: "Agency Logo",
    });
    template[part] = embedded.slide;
    template.staticFiles.set(embedded.mediaPath, embedded.mediaBytes);
  }
}

export function slideAiKey(slide: { kind: "campaign" | "adset"; campaignName: string; adSetName?: string }): string {
  return slide.kind === "campaign" ? `campaign:${slide.campaignName}` : `adset:${slide.campaignName}/${slide.adSetName}`;
}

export async function renderPptx(input: RenderPptxInput): Promise<Buffer> {
  const { templateBuffer, data, currencySymbol, aiCopyBySlideKey, reportTitle, agencyName, clientLogo, agencyLogo } = input;
  const template = await loadTemplate(templateBuffer);

  if (clientLogo) {
    const embedded = embedImageInSlide(template.cover, clientLogo, CLIENT_LOGO_BOX, {
      mediaFileName: "client-logo.png",
      shapeName: "Client Logo",
    });
    template.cover = embedded.slide;
    template.staticFiles.set(embedded.mediaPath, embedded.mediaBytes);
  }
  if (agencyLogo) embedAgencyFooterLogo(template, agencyLogo);

  const slides: SlideToInsert[] = [];

  slides.push({
    xml: buildCoverSlideXml(template.cover, data.cover, { reportTitle, agencyName }),
    rels: template.cover.rels,
  });

  if (data.isPaused) {
    slides.push({
      xml: buildPausedSlideXml(template.campaign, data.cover.accountName, data.pausedMessage ?? "", data.cover.dateRange),
      rels: template.campaign.rels,
    });
  } else {
    for (const slide of data.campaignSlides) {
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({ xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai), rels: template.campaign.rels });
    }
    for (const slide of data.adSetSlides) {
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({ xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai), rels: template.campaign.rels });
    }
    if (data.chart) {
      let chartXml = buildChartSlideXml(data.chart, currencySymbol);
      let chartRels = CHART_SLIDE_RELS;
      // Not one of the 4 template parts embedAgencyFooterLogo() covers —
      // built from scratch per-report (see chart-slide.ts), so it needs its
      // own single embed call here instead.
      if (agencyLogo) {
        const embedded = embedImageInSlide({ xml: chartXml, rels: chartRels }, agencyLogo, AGENCY_LOGO_BOX, {
          mediaFileName: "agency-footer-logo.png",
          shapeName: "Agency Logo",
        });
        chartXml = embedded.slide.xml;
        chartRels = embedded.slide.rels;
        template.staticFiles.set(embedded.mediaPath, embedded.mediaBytes);
      }
      slides.push({ xml: chartXml, rels: chartRels });
    }
  }

  slides.push({
    xml: buildTableSlideXml(template.table, data.periodRow, data.mtdRow, data.tableHeaderLabels),
    rels: template.table.rels,
  });
  slides.push({ xml: template.legend.xml, rels: template.legend.rels });

  return assemblePptx(template, slides);
}

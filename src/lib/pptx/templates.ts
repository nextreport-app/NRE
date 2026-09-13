/**
 * Maps a client's chosen ReportTemplate to its .pptx template asset.
 *
 * DARK and LIGHT are the two fully tested base themes. OCEAN/INDIGO/MOSS/
 * BURGUNDY/STEEL/COPPER are color-background forks of dark.pptx — same slide
 * layout, tags, fonts, and fill-tags logic; only theme accent5/6 gradient and
 * card surface fills differ. Generate fresh assets with:
 *   node scripts/generate-meta-template-variants.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ReportTemplate } from "@/generated/prisma/enums";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

export const TEMPLATE_FILES: Record<ReportTemplate, string> = {
  DARK: "dark.pptx",
  LIGHT: "meta-ads-light.pptx",
  OCEAN: "meta-ads-ocean.pptx",
  INDIGO: "meta-ads-indigo.pptx",
  MOSS: "meta-ads-moss.pptx",
  BURGUNDY: "meta-ads-burgundy.pptx",
  STEEL: "meta-ads-steel.pptx",
  COPPER: "meta-ads-copper.pptx",
};

/** True only for meta-ads-light.pptx — drives chart/table/comparison/creative light palettes. */
export function isLightReportTemplate(template: ReportTemplate): boolean {
  return template === "LIGHT";
}

export async function loadTemplateBuffer(template: ReportTemplate): Promise<Buffer> {
  const fileName = TEMPLATE_FILES[template];
  return fs.readFile(path.join(TEMPLATES_DIR, fileName));
}

/**
 * Google Ads reports always use templates/google-ads-dark.pptx, regardless
 * of the client's own color-template choice — there's only one Google Ads
 * template asset today. TikTok uses tiktok-ads-dark.pptx (dark-style only).
 */
export async function loadTemplateBufferForPlatform(
  platform: "META" | "GOOGLE" | "GA4" | "TIKTOK",
  template: ReportTemplate,
): Promise<Buffer> {
  if (platform === "GOOGLE") return fs.readFile(path.join(TEMPLATES_DIR, "google-ads-dark.pptx"));
  if (platform === "TIKTOK") return fs.readFile(path.join(TEMPLATES_DIR, "tiktok-ads-dark.pptx"));
  return loadTemplateBuffer(template);
}

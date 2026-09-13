/**
 * Maps a client's chosen ReportTemplate to its .pptx template asset per platform.
 *
 * Meta: dark.pptx, meta-ads-light.pptx, and six color forks (see generate script).
 * GA4: ga4-dark.pptx, ga4-light.pptx, and matching ga4-* color forks.
 * Google Ads / TikTok: single dark platform-branded asset each (color choice TBD).
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ReportTemplate } from "@/generated/prisma/enums";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

export const META_TEMPLATE_FILES: Record<ReportTemplate, string> = {
  DARK: "dark.pptx",
  LIGHT: "meta-ads-light.pptx",
  OCEAN: "meta-ads-ocean.pptx",
  INDIGO: "meta-ads-indigo.pptx",
  MOSS: "meta-ads-moss.pptx",
  BURGUNDY: "meta-ads-burgundy.pptx",
  STEEL: "meta-ads-steel.pptx",
  COPPER: "meta-ads-copper.pptx",
};

export const GA4_TEMPLATE_FILES: Record<ReportTemplate, string> = {
  DARK: "ga4-dark.pptx",
  LIGHT: "ga4-light.pptx",
  OCEAN: "ga4-ocean.pptx",
  INDIGO: "ga4-indigo.pptx",
  MOSS: "ga4-moss.pptx",
  BURGUNDY: "ga4-burgundy.pptx",
  STEEL: "ga4-steel.pptx",
  COPPER: "ga4-copper.pptx",
};

/** @deprecated Use META_TEMPLATE_FILES — kept for existing tests/imports. */
export const TEMPLATE_FILES = META_TEMPLATE_FILES;

/** True only for light .pptx assets — drives chart/table/comparison/creative/website light palettes. */
export function isLightReportTemplate(template: ReportTemplate): boolean {
  return template === "LIGHT";
}

async function readTemplateFile(fileName: string): Promise<Buffer> {
  return fs.readFile(path.join(TEMPLATES_DIR, fileName));
}

export async function loadTemplateBuffer(template: ReportTemplate): Promise<Buffer> {
  return readTemplateFile(META_TEMPLATE_FILES[template]);
}

export async function loadGa4TemplateBuffer(template: ReportTemplate): Promise<Buffer> {
  return readTemplateFile(GA4_TEMPLATE_FILES[template]);
}

/**
 * Platform-aware template loader — Meta and GA4 honor the client's full color
 * library; Google Ads and TikTok use a single dark platform asset for now.
 */
export async function loadTemplateBufferForPlatform(
  platform: "META" | "GOOGLE" | "GA4" | "TIKTOK",
  template: ReportTemplate,
): Promise<Buffer> {
  if (platform === "GOOGLE") return readTemplateFile("google-ads-dark.pptx");
  if (platform === "TIKTOK") return readTemplateFile("tiktok-ads-dark.pptx");
  if (platform === "GA4") return loadGa4TemplateBuffer(template);
  return loadTemplateBuffer(template);
}

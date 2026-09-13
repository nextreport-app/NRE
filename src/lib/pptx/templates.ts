/**
 * Maps a client's chosen ReportTemplate to its .pptx template asset per platform.
 *
 * Meta / GA4: dark.pptx or meta-ads-light.pptx / ga4-dark.pptx or ga4-light.pptx.
 * Google Ads / TikTok: single dark platform-branded asset each.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ReportTemplate } from "@/generated/prisma/enums";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

export const META_TEMPLATE_FILES: Record<ReportTemplate, string> = {
  DARK: "dark.pptx",
  LIGHT: "meta-ads-light.pptx",
};

export const GA4_TEMPLATE_FILES: Record<ReportTemplate, string> = {
  DARK: "ga4-dark.pptx",
  LIGHT: "ga4-light.pptx",
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
 * Platform-aware template loader — Meta and GA4 honor Dark/Light;
 * Google Ads and TikTok use a single dark platform asset.
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

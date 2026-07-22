/**
 * Maps a client's chosen ReportTemplate to its .pptx template asset.
 *
 * TODO: only the DARK template file has been supplied so far. The other 5
 * (LIGHT/EMERALD/PURPLE/CRIMSON/GRAPHITE) from the spec's template library
 * fall back to DARK until those files are provided — this is a deliberate,
 * flagged gap, not a silent one.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ReportTemplate } from "@/generated/prisma/enums";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

const TEMPLATE_FILES: Record<ReportTemplate, string> = {
  DARK: "dark.pptx",
  LIGHT: "dark.pptx", // TODO: replace once LIGHT template asset is supplied
  EMERALD: "dark.pptx", // TODO: replace once EMERALD template asset is supplied
  PURPLE: "dark.pptx", // TODO: replace once PURPLE template asset is supplied
  CRIMSON: "dark.pptx", // TODO: replace once CRIMSON template asset is supplied
  GRAPHITE: "dark.pptx", // TODO: replace once GRAPHITE template asset is supplied
};

export async function loadTemplateBuffer(template: ReportTemplate): Promise<Buffer> {
  const fileName = TEMPLATE_FILES[template];
  return fs.readFile(path.join(TEMPLATES_DIR, fileName));
}

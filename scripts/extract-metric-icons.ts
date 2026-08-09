/**
 * One-time setup script — extracts the 7 metric-card icon images already
 * embedded in templates/dark.pptx (the real PPT icons, not emoji) into
 * public/metric-icons/*.png for the web UI's Metric Review step to use
 * directly via <img>, instead of duplicating/re-drawing them.
 *
 * Locates each icon the same way the PPTX-generation code itself does
 * (ooxml.ts's findCardIconRelId: the <p:pic> whose r:embed relationship id
 * immediately precedes a given {{TAG}}), so the mapping can't drift from
 * what actually renders in the generated report.
 *
 * Not part of the Next.js build — the output is static, committed, and only
 * needs re-running if templates/dark.pptx's card icons ever change. Run
 * with: npx tsx scripts/extract-metric-icons.ts
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { loadTemplate } from "../src/lib/pptx/package";
import { findCardIconRelId } from "../src/lib/pptx/ooxml";

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_PATH = path.join(ROOT, "templates", "dark.pptx");
const OUT_DIR = path.join(ROOT, "public", "metric-icons");

// Slot locator -> output file name, in the template's own physical card
// order (mirrors fill-tags.ts's CARD_SLOT_TAGS / CARD_SLOT_DEFAULT_ICON).
// Slot 8 ({{METRIC_8_VALUE}}) is deliberately omitted — it reuses the CPC
// slot's own icon natively, so there's no distinct 8th icon to extract.
const ICON_SLOTS: { tag: string; name: string }[] = [
  { tag: "{{METRIC_SPEND}}", name: "spend" },
  { tag: "{{METRIC_REACH}}", name: "reach" },
  { tag: "{{METRIC_IMPRESSIONS}}", name: "impressions" },
  { tag: "{{METRIC_RESULTS}}", name: "results" },
  { tag: "{{METRIC_CTR}}", name: "ctr" },
  { tag: "{{METRIC_CPR}}", name: "cost-per-result" },
  { tag: "{{METRIC_CPC}}", name: "cpc" },
];

async function run() {
  const buf = fs.readFileSync(TEMPLATE_PATH);
  const template = await loadTemplate(buf);
  const zip = await JSZip.loadAsync(buf);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { tag, name } of ICON_SLOTS) {
    const relId = findCardIconRelId(template.campaign.xml, tag);
    if (!relId) throw new Error(`Could not find an icon relationship id for ${tag}`);

    const targetMatch = new RegExp(`<Relationship Id="${relId}"[^>]*Target="([^"]+)"`).exec(template.campaign.rels);
    if (!targetMatch) throw new Error(`Rel id ${relId} (for ${tag}) has no Target in the campaign slide's rels`);

    // Target is relative to the slide's own directory (ppt/slides/), e.g.
    // "../media/image5.png" -> ppt/media/image5.png.
    const mediaPath = path.posix.normalize(path.posix.join("ppt/slides", targetMatch[1]));
    const file = zip.file(mediaPath);
    if (!file) throw new Error(`Template is missing media part ${mediaPath} (icon for ${tag})`);

    const bytes = await file.async("nodebuffer");
    const outPath = path.join(OUT_DIR, `${name}.png`);
    fs.writeFileSync(outPath, bytes);
    console.log(`Wrote ${outPath} (${bytes.length} bytes, from ${mediaPath})`);

    if (name === "results") {
      const defaultPath = path.join(OUT_DIR, "default.png");
      fs.writeFileSync(defaultPath, bytes);
      console.log(`Wrote ${defaultPath} (copy of results.png, fallback icon)`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

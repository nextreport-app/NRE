/**
 * PPTX package loader/assembler — the OOXML equivalent of the Apps Script's
 * DriveApp.getFileById(TEMPLATE_FILE_ID).makeCopy() + SlidesApp.appendSlide()
 * choreography. Rather than replicate that remove-then-reappend dance (which
 * only existed because the Slides API can only append at the end), this
 * builds the exact final slide order directly: the four template slides
 * (cover/campaign/table/legend) are located once at load time, then the
 * caller assembles a flat, already-ordered list of generated slide XML and
 * this module writes a fresh, valid .pptx around it.
 */

import JSZip from "jszip";

export interface TemplateSlide {
  xml: string;
  /** rels content for this slide, with any notesSlide relationship stripped. */
  rels: string;
}

export interface LoadedTemplate {
  cover: TemplateSlide;
  campaign: TemplateSlide;
  table: TemplateSlide;
  legend: TemplateSlide;
  contentTypesXml: string;
  presentationXml: string;
  presentationRelsXml: string;
  /** Every zip entry that isn't a slide/notesSlide/presentation part — carried through unchanged. */
  staticFiles: Map<string, Uint8Array>;
  /** The template's full-slide decorative background picture (grid pattern + gradient), as drawn once on slideMaster1.xml and inherited by every template slide. From-scratch slides (the chart slide) don't go through that inheritance chain, so they need this to draw the same picture themselves — see chart-slide.ts. */
  background: TemplateBackgroundImage;
}

export interface TemplateBackgroundImage {
  /** The master's own <a:blip r:embed="..."> element (with any children, e.g. alphaModFix) — embed id gets rewritten to whichever rId the copy is registered under. */
  blipXml: string;
  /** The master's <a:srcRect .../> crop, or "" if it doesn't crop the source image. */
  srcRectXml: string;
  offX: number;
  offY: number;
  extCx: number;
  extCy: number;
  /** Relationship Target as written in the master's own rels (e.g. "../media/image17.png") — identical relative form works unchanged from a slide's rels, since both live one directory below ppt/ alongside ppt/media/. */
  mediaTarget: string;
}

function extractMasterBackgroundImage(masterXml: string, masterRelsXml: string): TemplateBackgroundImage {
  const pic = masterXml.match(/<p:pic>[\s\S]*?<\/p:pic>/)?.[0];
  const blipXml = pic?.match(/<a:blip[\s\S]*?<\/a:blip>/)?.[0];
  const relId = blipXml?.match(/r:embed="(rId\d+)"/)?.[1];
  const xfrm = pic?.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/);
  const target = relId && new RegExp(`<Relationship Id="${relId}"[^>]*Target="([^"]+)"`).exec(masterRelsXml)?.[1];
  if (!pic || !blipXml || !relId || !xfrm || !target) {
    throw new Error("Could not extract the template's background image from slideMaster1.xml");
  }
  return {
    blipXml,
    srcRectXml: pic.match(/<a:srcRect[^>]*\/>/)?.[0] ?? "",
    offX: Number(xfrm[1]),
    offY: Number(xfrm[2]),
    extCx: Number(xfrm[3]),
    extCy: Number(xfrm[4]),
    mediaTarget: target,
  };
}

const REBUILT_PATH_PREFIXES = ["ppt/slides/", "ppt/notesSlides/"];
const REBUILT_EXACT_PATHS = new Set([
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  "[Content_Types].xml",
]);

function stripNotesSlideRelationship(relsXml: string): string {
  return relsXml.replace(/<Relationship[^>]*Type="[^"]*\/notesSlide"[^>]*\/>/g, "");
}

function getAllText(xml: string): string {
  return (xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).join(" ");
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Template is missing expected part: ${path}`);
  return file.async("string");
}

export async function loadTemplate(buffer: Buffer): Promise<LoadedTemplate> {
  const zip = await JSZip.loadAsync(buffer);

  const presentationXml = await readText(zip, "ppt/presentation.xml");
  const presentationRelsXml = await readText(zip, "ppt/_rels/presentation.xml.rels");
  const contentTypesXml = await readText(zip, "[Content_Types].xml");

  // Slide relationship IDs in document order, from <p:sldIdLst>.
  const sldIdMatches = [...presentationXml.matchAll(/<p:sldId[^>]*r:id="(rId\d+)"[^>]*\/>/g)];
  const relIdToTarget = new Map<string, string>();
  for (const m of presentationRelsXml.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    relIdToTarget.set(m[1], m[2]);
  }

  const slideEntries: { path: string; xml: string; rels: string }[] = [];
  for (const m of sldIdMatches) {
    const target = relIdToTarget.get(m[1]);
    if (!target) continue;
    const slidePath = "ppt/" + target.replace(/^\.?\//, "");
    const relsPath = slidePath.replace(/ppt\/slides\/([^/]+)$/, "ppt/slides/_rels/$1.rels");
    const xml = await readText(zip, slidePath);
    const rels = stripNotesSlideRelationship(await readText(zip, relsPath));
    slideEntries.push({ path: slidePath, xml, rels });
  }

  function find(matcher: (text: string) => boolean, label: string): TemplateSlide {
    const entry = slideEntries.find((e) => matcher(getAllText(e.xml)));
    if (!entry) throw new Error(`Could not locate the "${label}" slide in the template`);
    return { xml: entry.xml, rels: entry.rels };
  }

  const cover = find((t) => t.includes("{{ACCOUNT_NAME}}"), "cover");
  const campaign = find((t) => t.includes("{{METRIC_SPEND}}"), "campaign template");
  // Matches the current heading — "MONTHLY CAMPAIGN PERFORMANCE OVERVIEW"
  // (this round's rename) or its pre-rename "CAMPAIGN PERFORMANCE OVERVIEW"
  // (Fix 3) both contain "CAMPAIGN PERFORMANCE OVERVIEW" as a substring, so
  // this check still matches either — or the original pre-Fix-3 heading
  // ("CAMPAIGN OVERVIEW-Combined Total"), which only still exists in the
  // untouched legacy reference/templates/ADS_TEMPLATE_V2.pptx fixture (kept
  // intentionally pristine since the repo's first commit, unlike
  // templates/dark.pptx and its derived templates, which Fix 3 renamed and
  // this round renamed again).
  const table = find((t) => t.includes("CAMPAIGN PERFORMANCE OVERVIEW") || t.includes("CAMPAIGN OVERVIEW"), "period/MTD table");
  const legend = find((t) => t.includes("METRIC ABBREVIATION"), "legend");

  const background = extractMasterBackgroundImage(
    await readText(zip, "ppt/slideMasters/slideMaster1.xml"),
    await readText(zip, "ppt/slideMasters/_rels/slideMaster1.xml.rels"),
  );

  const staticFiles = new Map<string, Uint8Array>();
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const path = entry.name;
    if (REBUILT_EXACT_PATHS.has(path)) continue;
    if (REBUILT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
    staticFiles.set(path, await entry.async("uint8array"));
  }

  return { cover, campaign, table, legend, contentTypesXml, presentationXml, presentationRelsXml, staticFiles, background };
}

export interface SlideToInsert {
  xml: string;
  rels: string;
}

function stripSlideOverrides(contentTypesXml: string): string {
  return contentTypesXml
    .replace(/<Override[^>]*ContentType="[^"]*presentationml\.slide\+xml"[^>]*\/>/g, "")
    .replace(/<Override[^>]*ContentType="[^"]*presentationml\.notesSlide\+xml"[^>]*\/>/g, "");
}

function stripSlideRelationships(presentationRelsXml: string): string {
  return presentationRelsXml.replace(
    /<Relationship[^>]*Type="[^"]*\/slide"[^>]*\/>/g,
    "",
  );
}

export async function assemblePptx(template: LoadedTemplate, slides: SlideToInsert[]): Promise<Buffer> {
  const zip = new JSZip();

  for (const [path, data] of template.staticFiles) {
    zip.file(path, data);
  }

  const slideRelIds: string[] = [];
  slides.forEach((slide, i) => {
    const n = i + 1;
    const slidePath = `ppt/slides/slide${n}.xml`;
    const relsPath = `ppt/slides/_rels/slide${n}.xml.rels`;
    const relId = `rIdGenSlide${n}`;
    zip.file(slidePath, slide.xml);
    zip.file(relsPath, slide.rels);
    slideRelIds.push(relId);
  });

  const newContentTypeOverrides = slides
    .map(
      (_, i) =>
        `<Override ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml" PartName="/ppt/slides/slide${i + 1}.xml"/>`,
    )
    .join("");
  const contentTypesXml = stripSlideOverrides(template.contentTypesXml).replace(
    "</Types>",
    newContentTypeOverrides + "</Types>",
  );
  zip.file("[Content_Types].xml", contentTypesXml);

  const newRelationships = slides
    .map(
      (_, i) =>
        `<Relationship Id="${slideRelIds[i]}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
    )
    .join("");
  const presentationRelsXml = stripSlideRelationships(template.presentationRelsXml).replace(
    "</Relationships>",
    newRelationships + "</Relationships>",
  );
  zip.file("ppt/_rels/presentation.xml.rels", presentationRelsXml);

  const newSldIdLst =
    "<p:sldIdLst>" +
    slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="${slideRelIds[i]}"/>`).join("") +
    "</p:sldIdLst>";
  const presentationXml = template.presentationXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, newSldIdLst);
  zip.file("ppt/presentation.xml", presentationXml);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

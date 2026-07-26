/**
 * Low-level OOXML (DrawingML) text helpers used by the PPTX render engine.
 *
 * The template's {{TAG}} placeholders were checked (see reference/templates
 * inspection notes) and every one lives as a single, un-split <a:t> run — so
 * a straightforward "find the enclosing <a:r>, keep its <a:rPr>, swap the
 * text" replacement is safe and exact; there is no need for the general
 * "text split across multiple runs" case the Slides API has to handle.
 */

export function escapeXmlText(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface StyleOverride {
  bold?: boolean;
  sizePt?: number;
  /** Forces <a:latin>/<a:ea>/<a:cs> typeface — e.g. AI-written text boxes must render in Poppins regardless of the template placeholder's own font. */
  fontFamily?: string;
  /** Forces the run's text fill to this hex RGB (no "#"), replacing whatever <a:solidFill> it had (scheme or RGB). */
  color?: string;
}

function applyStyleOverride(rPrBlock: string, override: StyleOverride | undefined): string {
  if (!override) return rPrBlock;
  let block = rPrBlock;
  if (override.bold !== undefined) {
    const boldAttr = `b="${override.bold ? "1" : "0"}"`;
    block = /\bb="[01]"/.test(block) ? block.replace(/\bb="[01]"/, boldAttr) : block.replace("<a:rPr", `<a:rPr ${boldAttr}`);
  }
  if (override.sizePt !== undefined) {
    const szAttr = `sz="${Math.round(override.sizePt * 100)}"`;
    block = /\bsz="\d+"/.test(block) ? block.replace(/\bsz="\d+"/, szAttr) : block.replace("<a:rPr", `<a:rPr ${szAttr}`);
  }
  if (override.fontFamily !== undefined) {
    for (const tag of ["a:latin", "a:ea", "a:cs"]) {
      const re = new RegExp(`<${tag} typeface="[^"]*"`, "g");
      const replacement = `<${tag} typeface="${override.fontFamily}"`;
      block = re.test(block) ? block.replace(re, replacement) : block;
    }
  }
  if (override.color !== undefined) {
    const fillRe = /<a:solidFill>[\s\S]*?<\/a:solidFill>/;
    const replacement = `<a:solidFill><a:srgbClr val="${override.color}"/></a:solidFill>`;
    if (fillRe.test(block)) {
      block = block.replace(fillRe, replacement);
    } else if (/<a:rPr[^>]*\/>/.test(block)) {
      block = block.replace(/<a:rPr([^>]*)\/>/, `<a:rPr$1>${replacement}</a:rPr>`);
    } else {
      block = block.replace(/(<a:rPr[^>]*>)/, `$1${replacement}`);
    }
  }
  return block;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces a single {{TAG}} run in slide/table-cell XML with `value`.
 * `\n` in value becomes an <a:br/> soft line break, reusing the same run
 * properties for every line (matching how the source's DATE_RANGE +
 * frequency-line text renders as one visually-consistent block).
 *
 * Returns { xml, replaced } — `replaced` is false if the tag wasn't found,
 * so callers can detect a template/data mismatch instead of failing silently.
 */
export function replaceTagRun(
  xml: string,
  tag: string,
  value: string,
  styleOverride?: StyleOverride,
): { xml: string; replaced: boolean } {
  const escapedTag = escapeRegExp(tag);
  const runRegex = new RegExp(`<a:r>((?:(?!</a:r>)[\\s\\S])*?)<a:t>${escapedTag}</a:t></a:r>`);
  const match = runRegex.exec(xml);
  if (!match) return { xml, replaced: false };

  const rPrBlock = applyStyleOverride(match[1] ?? "", styleOverride);
  const lines = String(value).split("\n");
  const runs = lines.map((line) => `<a:r>${rPrBlock}<a:t>${escapeXmlText(line)}</a:t></a:r>`).join("<a:br/>");

  return { xml: xml.slice(0, match.index) + runs + xml.slice(match.index + match[0].length), replaced: true };
}

/**
 * Like replaceTagRun, but also inserts a second run directly after the
 * tag's own run, in the same paragraph — e.g. a small "(Inactive)" badge
 * next to a campaign/ad-set name that must render in a different
 * color/size than the name itself. `suffix` is skipped entirely (no run
 * added) when null/empty, so the active case renders exactly like a plain
 * replaceTagRun call.
 */
export function replaceTagRunWithSuffix(
  xml: string,
  tag: string,
  value: string,
  suffix: string | null | undefined,
  styleOverride?: StyleOverride,
  suffixStyleOverride?: StyleOverride,
): { xml: string; replaced: boolean } {
  const escapedTag = escapeRegExp(tag);
  const runRegex = new RegExp(`<a:r>((?:(?!</a:r>)[\\s\\S])*?)<a:t>${escapedTag}</a:t></a:r>`);
  const match = runRegex.exec(xml);
  if (!match) return { xml, replaced: false };

  const rPrBlock = applyStyleOverride(match[1] ?? "", styleOverride);
  const lines = String(value).split("\n");
  const mainRuns = lines.map((line) => `<a:r>${rPrBlock}<a:t>${escapeXmlText(line)}</a:t></a:r>`).join("<a:br/>");

  const suffixRun = suffix
    ? `<a:r>${applyStyleOverride(match[1] ?? "", suffixStyleOverride)}<a:t>${escapeXmlText(suffix)}</a:t></a:r>`
    : "";

  return {
    xml: xml.slice(0, match.index) + mainRuns + suffixRun + xml.slice(match.index + match[0].length),
    replaced: true,
  };
}

/**
 * Force the run properties of the FIRST run whose text matches `literalText`
 * exactly. Used for static (non-{{TAG}}) template text whose final rendered
 * style differs from the template's own default — e.g. the "YOUR WEEKLY
 * PERFORMANCE REPORT" heading, which the source forces bold via
 * restoreHeadingFonts_ even though the template itself stores it unbolded.
 */
export function forceRunStyle(xml: string, literalText: string, styleOverride: StyleOverride): string {
  const escaped = escapeRegExp(literalText);
  const runRegex = new RegExp(`<a:r>((?:(?!</a:r>)[\\s\\S])*?)<a:t>${escaped}</a:t></a:r>`);
  const match = runRegex.exec(xml);
  if (!match) return xml;
  const rPrBlock = applyStyleOverride(match[1] ?? "", styleOverride);
  const newRun = `<a:r>${rPrBlock}<a:t>${escapeXmlText(literalText)}</a:t></a:r>`;
  return xml.slice(0, match.index) + newRun + xml.slice(match.index + match[0].length);
}

export function ptToEmu(pt: number): number {
  return Math.round(pt * 12700);
}

/**
 * Rewrites the y offset of the `<p:sp>` shape whose text contains
 * `locatorText` (a literal substring — a static heading or a {{TAG}}
 * placeholder). No-op if the locator isn't found. Used to reposition
 * existing cover-slide shapes at render time when an optional extra line
 * (e.g. "Prepared by ...") needs to be inserted above them — shapes are
 * independently, absolutely positioned in PPTX, so nothing else moves on
 * its own.
 */
export function setShapeOffsetY(xml: string, locatorText: string, y: number): string {
  const idx = xml.indexOf(locatorText);
  if (idx === -1) return xml;
  const start = xml.lastIndexOf("<p:sp>", idx);
  const end = xml.indexOf("</p:sp>", idx) + "</p:sp>".length;
  const sp = xml.slice(start, end);
  const newSp = sp.replace(/(<a:off x="\d+" y=")\d+(")/, `$1${y}$2`);
  return xml.slice(0, start) + newSp + xml.slice(end);
}

/**
 * Clones the `<p:sp>` shape whose sole text run is `sourceTag` (a
 * {{TAG}} placeholder), retargets that run to `newTag`, repositions it to
 * a new y offset, and assigns it a fresh shape id so it doesn't collide
 * with the source shape's id. Returns just the new shape's XML — it is NOT
 * inserted into the document; pass it to `insertShapeBeforeSpTreeClose`.
 * Reuses the source shape's exact styling rather than duplicating run-
 * property XML by hand, for a conditionally-present line that should look
 * like a natural sibling of an existing one (e.g. cloning REPORT_DATE's
 * small muted-text styling for a "Prepared by ..." line).
 */
export function cloneShapeAsTag(xml: string, sourceTag: string, newTag: string, y: number): string {
  const idx = xml.indexOf(sourceTag);
  if (idx === -1) throw new Error(`cloneShapeAsTag: tag not found: ${sourceTag}`);
  const start = xml.lastIndexOf("<p:sp>", idx);
  const end = xml.indexOf("</p:sp>", idx) + "</p:sp>".length;
  let sp = xml.slice(start, end);

  const existingIds = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]));
  const newId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;
  sp = sp.replace(/(<p:cNvPr id=")\d+(")/, `$1${newId}$2`);
  sp = sp.replace(/(<a:off x="\d+" y=")\d+(")/, `$1${y}$2`);
  sp = sp.replace(sourceTag, newTag);

  return sp;
}

/** Inserts `shapeXml` (a full `<p:sp>...</p:sp>` or `<p:pic>...</p:pic>` block) as the last shape in the slide's shape tree. */
export function insertShapeBeforeSpTreeClose(xml: string, shapeXml: string): string {
  const marker = "</p:spTree>";
  const idx = xml.lastIndexOf(marker);
  if (idx === -1) throw new Error("insertShapeBeforeSpTreeClose: no </p:spTree> found");
  return xml.slice(0, idx) + shapeXml + xml.slice(idx);
}

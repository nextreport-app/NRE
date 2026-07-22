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

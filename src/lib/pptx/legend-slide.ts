/** One selected-metric guide; card labels and definitions are rendered together. */
import { rectangle, resetShapeIdCounter, textBox } from "./shapes";
import { slideSurfacePalette } from "./slide-surface-palette";

export interface LegendEntry { term: string; explanation: string }

export function metricDefinition(term: string, fallback = ""): string {
  const t = term.toUpperCase().replace(/\s*\(EST\.\)/g, "").trim();
  if (/1K|1,?000/.test(t) && /REACH/.test(t)) return "Spend divided by people reached, multiplied by 1,000. Reach-based rates may use estimated reach.";
  if (/CPM|COST PER.*IMPRESSION/.test(t)) return "Spend per 1,000 impressions. This differs from cost per 1,000 people reached.";
  if (t === "REACH" || t === "REACH (CAMPAIGNS)") return "People reached. Period values may be estimated; campaign audiences can overlap.";
  if (t === "IMPRESSIONS") return "The number of times ads were displayed, including repeat views.";
  if (/FREQUENCY/.test(t)) return "Impressions divided by reach: average views per person. Estimated when reach is estimated.";
  if (/CPC.*ALL/.test(t)) return "Spend divided by all ad clicks, including interactions beyond link clicks.";
  if (/COST PER LINK CLICK|CPLC/.test(t)) return "Spend divided by link clicks. This differs from CPC (all).";
  if (/CTR.*ALL/.test(t)) return "All ad clicks divided by impressions, expressed as a percentage.";
  if (/LINK CTR/.test(t)) return "Link clicks divided by impressions, expressed as a percentage.";
  if (t === "LINK CLICKS") return "Clicks on links in an ad that lead to the selected destination.";
  if (t === "AD SPEND") return "Total amount spent during the displayed report period.";
  if (t === "WEBSITE LEADS") return "Attributed lead events on the advertiser’s website.";
  if (t === "LANDING PAGE VIEWS") return "Attributed visits where the destination page loaded after an ad click.";
  if (/^COST PER /.test(t)) return `Spend divided by the corresponding ${t.replace(/^COST PER /, "").toLowerCase()} results. Unavailable when no results were recorded.`;
  return fallback && fallback.toUpperCase() !== t ? fallback : `Attributed ${term.toLowerCase()} recorded for the displayed period.`;
}

export function buildLegendSlideXml(templateXml: string, entries: LegendEntry[], isLightTemplate = false): string {
  const unique = new Map<string, LegendEntry>();
  for (const entry of entries) {
    const key = entry.term.toUpperCase().replace(/\s*\(EST\.\)/g, "").trim();
    if (!unique.has(key)) unique.set(key, {...entry, explanation: metricDefinition(entry.term, entry.explanation)});
  }
  const concepts = unique.size ? [...unique.values()] : ["AD SPEND", "REACH", "IMPRESSIONS", "CTR (ALL)", "CPC (ALL)", "CPM"].map(term => ({term, explanation:metricDefinition(term)}));
  const shown = concepts.slice(0, 12);
  const palette = slideSurfacePalette(isLightTemplate);
  resetShapeIdCounter(2000);
  const shapes = [textBox({x:35,y:25,w:890,h:42,text:"METRIC ABBREVIATION GUIDE",sizePt:28,bold:true,colorHex:palette.text})];
  shown.forEach((entry,index) => {
    const x=35+(index%3)*300, y=87+Math.floor(index/3)*100;
    shapes.push(rectangle({x,y,w:288,h:91,fillHex:palette.cardFill}));
    shapes.push(textBox({x:x+12,y:y+8,w:264,h:26,text:entry.term,sizePt:13,bold:true,colorHex:palette.text,align:"l"}));
    shapes.push(textBox({x:x+12,y:y+35,w:264,h:51,text:entry.explanation,sizePt:11.5,colorHex:palette.label,align:"l"}));
  });
  const footer = concepts.length > 12 ? `12 of ${concepts.length} selected terms shown. Full definitions: nextreport.in/help/metrics` : "Estimated reach is not an exact unique audience total. Full definitions: nextreport.in/help/metrics";
  shapes.push(textBox({x:35,y:503,w:890,h:20,text:footer,sizePt:11,colorHex:palette.label}));
  // Retain the real slide layout/master and relationships, but replace the
  // entire card tree atomically. No cross-card literal replacements or filler.
  const scaffold=templateXml.match(/<p:spTree>([\s\S]*?<\/p:grpSpPr>)/)?.[1] ?? "";
  return templateXml.replace(/<p:spTree>[\s\S]*?<\/p:spTree>/, `<p:spTree>${scaffold}${shapes.join("")}</p:spTree>`);
}

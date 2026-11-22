import { normalizeAgencyTemplate } from "./normalize";
import JSZip from "jszip";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { loadTemplateBuffer } from "../pptx/templates";
import { loadTemplate } from "../pptx/package";
import { assertWorkbookUploadBudget } from "../nre/workbook-upload-budget";
import { ServiceError } from "../service-error";
import { detectLogoFormat, readLogoDimensions } from "../logo-processing";
export const MAX_AGENCY_TEMPLATE_BYTES = 4 * 1024 * 1024;
const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: false,
  parseTagValue: false,
});
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
const text = (xml: string) =>
  [...xml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)]
    .map((m) => {
      const v = parser.parse(m[0])["a:t"];
      return typeof v === "object" ? (v["#text"] ?? "") : v;
    })
    .join("");
const geometry = (xml: string) =>
  [
    ...xml.matchAll(
      /<a:xfrm[^>]*>[\s\S]*?<\/a:xfrm>|<a:tr\b[^>]*>|<a:gridCol\b[^>]*\/>/g,
    ),
  ].map((m) =>
    stable(
      parser.parse(m[0].startsWith("<a:tr ") ? m[0].replace(/>$/, "/>") : m[0]),
    ),
  );
/** Compatible starter styling only. Never accepts an arbitrary finished client report as a template. */
export async function validateAgencyTemplate(
  buffer: Buffer,
  variant: "DARK" | "LIGHT",
) {
  if (buffer.length > MAX_AGENCY_TEMPLATE_BYTES)
    throw new ServiceError("Keep the PowerPoint file under 4 MB.", 413);
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50)
    throw new ServiceError("Upload a .pptx version of the compatible starter.");
  try {
    assertWorkbookUploadBudget(buffer);
  } catch {
    throw new ServiceError(
      "This PowerPoint file cannot be safely expanded. Use a smaller compatible starter.",
    );
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch {
    throw new ServiceError(
      "This PowerPoint file is damaged. Upload the compatible starter again.",
    );
  }
  const starter = await JSZip.loadAsync(await loadTemplateBuffer(variant));
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  if (
    Object.values(zip.files).some(
      (e) =>
        "unsafeOriginalName" in e &&
        String(e.unsafeOriginalName).includes(".."),
    )
  )
    throw new ServiceError("Use a template without unsafe file paths.");
  if (
    paths.some(
      (p) =>
        p.includes("..") ||
        p.startsWith("/") ||
        /vba|activeX|embeddings|comments|externalLinks|oleObject/i.test(p),
    )
  )
    throw new ServiceError(
      "Use a PowerPoint template without macros, embedded files or comments.",
    );
  const slides = paths
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort();
  const baselineSlides = Object.keys(starter.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort();
  if (JSON.stringify(slides) !== JSON.stringify(baselineSlides))
    throw new ServiceError(
      "Keep the starter's four slides. Restyle them without adding or removing slides.",
    );
  for (const part of paths) {
    if (part.endsWith(".xml") || part.endsWith(".rels")) {
      if (
        !starter.file(part) &&
        !/^docProps\/(?:core|app)\.xml$/.test(part) &&
        part !== "ppt/viewProps.xml" &&
        !/^ppt\/(?:theme|slideLayouts|slideMasters)\/(?:_rels\/)?[^/]+\.(?:xml|rels)$/.test(
          part,
        )
      )
        throw new ServiceError(
          "Keep only the starter slide structure and artwork; remove extra document data.",
        );
      const xml = await zip.file(part)!.async("string");
      if (
        /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External|Target\s*=\s*["'](?:[a-z]+:|\/\/|\\)/i.test(
          xml,
        ) ||
        XMLValidator.validate(xml) !== true
      )
        throw new ServiceError(
          "Remove external links or invalid XML and upload the compatible starter again.",
        );
      if (part.endsWith(".rels")) {
        const relationships =
          parser.parse(xml).Relationships?.Relationship ?? [];
        for (const rel of Array.isArray(relationships)
          ? relationships
          : [relationships]) {
          if (
            String(rel["@_TargetMode"] ?? "").toLowerCase() === "external" ||
            /^(?:[a-z]+:|\/\/|\\)/i.test(String(rel["@_Target"] ?? ""))
          )
            throw new ServiceError(
              "Remove external links and upload the compatible starter again.",
            );
        }
      }
    } else if (part.startsWith("ppt/media/")) {
      const bytes = Buffer.from(await zip.file(part)!.async("uint8array")),
        format = detectLogoFormat(bytes);
      const size = format ? readLogoDimensions(bytes, format) : null;
      if (
        !format ||
        !["png", "jpeg"].includes(format) ||
        !size ||
        size.width > 8192 ||
        size.height > 8192
      )
        throw new ServiceError(
          "Template artwork must use PNG or JPEG images up to 8192 pixels per side.",
        );
    } else if (part.startsWith("ppt/fonts/")) {
      /* Embedded fonts are removed below; generated text remains portable Arial. */
    } else if (starter.file(part)) {
      if (
        !(await zip.file(part)!.async("nodebuffer")).equals(
          await starter.file(part)!.async("nodebuffer"),
        )
      )
        throw new ServiceError("The starter contains unsupported binary data.");
    } else if (!/^docProps\/thumbnail\.(jpeg|png)$/.test(part))
      throw new ServiceError(
        "The starter contains an unsupported embedded file.",
      );
  }
  const presentation = await zip.file("ppt/presentation.xml")?.async("string"),
    original = await starter.file("ppt/presentation.xml")!.async("string");
  const size = (xml: string) => {
    const a = parser.parse(xml.match(/<p:sldSz\b[^>]*\/>/)?.[0] ?? "")[
      "p:sldSz"
    ];
    return JSON.stringify([a?.["@_cx"], a?.["@_cy"]]);
  };
  if (!presentation || size(presentation) !== size(original))
    throw new ServiceError("Keep the starter's 16:9 slide dimensions.");
  for (const path of [...slides, "ppt/slideMasters/slideMaster1.xml"]) {
    const xml = await zip.file(path)!.async("string"),
      original = await starter.file(path)!.async("string");
    const tags = (s: string) =>
      [...s.matchAll(/\{\{[A-Z0-9_]+\}\}/g)].map((m) => m[0]).sort();
    if (JSON.stringify(tags(xml)) !== JSON.stringify(tags(original)))
      throw new ServiceError(
        "Restore the starter data placeholders without splitting their formatting.",
      );
    if (text(xml) !== text(original))
      throw new ServiceError(
        "Keep the starter's report text and data placeholders unchanged. Customize artwork, fills and borders instead.",
      );
    if (JSON.stringify(geometry(xml)) !== JSON.stringify(geometry(original)))
      throw new ServiceError(
        "Keep the starter's data boxes and tables in their original positions and sizes.",
      );
  }
  const normalized = await normalizeAgencyTemplate(zip);
  try {
    await loadTemplate(normalized);
  } catch {
    throw new ServiceError(
      "The PowerPoint structure is incompatible. Start from the downloaded starter and keep its slide master and data boxes.",
    );
  }
  return {
    digest: createHash("sha256").update(normalized).digest("hex"),
    buffer: normalized,
  };
}

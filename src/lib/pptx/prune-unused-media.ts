import type JSZip from "jszip";
import { posix } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";

/** Only remove orphan image parts from the new archive; never mutate the template. */
export async function pruneUnusedPptxMedia(zip: JSZip): Promise<void> {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const referenced = new Set<string>();
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir || !name.endsWith(".rels")) continue;
    const xml = await file.async("string");
    // Fail closed: an unfamiliar/malformed package must not lose its images.
    if (XMLValidator.validate(xml) !== true) return;
    const root = parser.parse(xml).Relationships;
    if (root === undefined) return;
    const relationships = root.Relationship;
    for (const rel of relationships ? Array.isArray(relationships) ? relationships : [relationships] : []) {
      if (rel["@_TargetMode"] === "External") continue;
      const target = rel["@_Target"];
      if (typeof target !== "string") return;
      let decoded: string;
      try { decoded = decodeURIComponent(target.split("#")[0]); } catch { return; }
      const base = posix.dirname(posix.dirname(name));
      referenced.add(posix.normalize(decoded.startsWith("/") ? decoded.slice(1) : posix.join(base, decoded)));
    }
  }
  const types = zip.file("[Content_Types].xml");
  if (types) {
    const xml = await types.async("string");
    if (XMLValidator.validate(xml) !== true) return;
    const overrides = parser.parse(xml).Types?.Override;
    // Preserve explicitly typed parts too, avoiding dangling content-type overrides.
    for (const entry of overrides ? Array.isArray(overrides) ? overrides : [overrides] : []) {
      const name = entry["@_PartName"];
      if (typeof name === "string") {
        try { referenced.add(decodeURIComponent(name.replace(/^\//, ""))); } catch { return; }
      }
    }
  }
  if (!referenced.size) return;
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir && /^ppt\/media\/.+\.(?:png|jpe?g|gif|webp)$/i.test(name) && !referenced.has(name)) zip.remove(name);
  }
}

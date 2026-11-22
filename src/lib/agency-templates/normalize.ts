import JSZip from "jszip";
/** Report text uses portable Arial. Drop embedded-font payloads rather than carrying Office-specific subsets into every report. */
export async function normalizeAgencyTemplate(zip: JSZip): Promise<Buffer> {
  for (const path of Object.keys(zip.files))
    if (/^ppt\/(?:fonts|notesSlides|notesMasters)\//.test(path))
      zip.remove(path);
  const presentation = zip.file("ppt/presentation.xml");
  if (presentation)
    zip.file(
      "ppt/presentation.xml",
      (await presentation.async("string"))
        .replace(/<p:embeddedFontLst>[\s\S]*?<\/p:embeddedFontLst>/g, "")
        .replace(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/g, ""),
    );
  const rels = zip.file("ppt/_rels/presentation.xml.rels");
  if (rels)
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      (await rels.async("string")).replace(
        /<Relationship\b[^>]*\bType="[^"]*\/(?:font|notesMaster)"[^>]*\/>/g,
        "",
      ),
    );
  const types = zip.file("[Content_Types].xml");
  if (types)
    zip.file(
      "[Content_Types].xml",
      (await types.async("string"))
        .replace(/<Default\b[^>]*Extension="(?:fntdata|odttf)"[^>]*\/>/g, "")
        .replace(
          /<Override\b[^>]*PartName="\/ppt\/(?:fonts|notesSlides|notesMasters)\/[^"]*"[^>]*\/>/g,
          "",
        ),
    );
  for (const path of Object.keys(zip.files).filter((path) =>
    path.endsWith(".rels"),
  )) {
    const file = zip.file(path);
    if (file)
      zip.file(
        path,
        (await file.async("string")).replace(
          /<Relationship\b[^>]*\bType="[^"]*\/notesSlide"[^>]*\/>/g,
          "",
        ),
      );
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

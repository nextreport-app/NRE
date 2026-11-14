/** RFC 6266 / RFC 8187: HTTP headers need ASCII, filenames may contain Unicode. */
export function attachmentContentDisposition(fileName: string): string {
  const clean = fileName.replace(/\p{Cc}/gu, "").replace(/[/\\]/g, "_").trim() || "report.pptx";
  const fallback = clean.normalize("NFKD").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "_");
  const encoded = encodeURIComponent(clean).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** Extracts an uploaded file field from a multipart/form-data body as a Buffer. */
export async function fileFromFormData(formData: FormData, field: string): Promise<Buffer | null> {
  const value = formData.get(field);
  if (!value || typeof value === "string") return null;
  const arrayBuffer = await value.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export interface UploadedFileEntry {
  buffer: Buffer;
  /** The browser-supplied original filename — "file" if the browser didn't send one. */
  fileName: string;
  /** The browser-supplied MIME type — never trusted for format detection (see logo-processing.ts / parse-file.ts, which sniff magic bytes instead), only used as a display/Content-Type hint. */
  contentType: string;
}

/** Like fileFromFormData, but also keeps the original filename/content-type — for routes (e.g. Previous Month Data) that need to remember what the user actually uploaded, not just its bytes. */
export async function fileEntryFromFormData(formData: FormData, field: string): Promise<UploadedFileEntry | null> {
  const value = formData.get(field);
  if (!value || typeof value === "string") return null;
  const arrayBuffer = await value.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: value.name || "file",
    contentType: value.type || "application/octet-stream",
  };
}

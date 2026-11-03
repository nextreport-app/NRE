import { gunzipSync } from "node:zlib";
import { MAX_REPORT_SOURCE_BYTES, MAX_REPORT_WIRE_BYTES, REPORT_UPLOAD_ENCODING_FIELD } from "./nre/report-upload-limits";
import { ServiceError } from "./service-error";
const MAX_UPLOAD_BYTES = MAX_REPORT_WIRE_BYTES;
function assertSize(file: File) { if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError("Upload exceeds 4 MB. Export a smaller date range or split the file by client.", 413); }
/** Extracts an uploaded file field from a multipart/form-data body as a Buffer. */
export async function fileFromFormData(formData: FormData, field: string): Promise<Buffer | null> {
  const value = formData.get(field);
  if (!value || typeof value === "string") return null;
  assertSize(value);
  const arrayBuffer = await value.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const encoding = field === "mtdDailyCsv" ? formData.get(REPORT_UPLOAD_ENCODING_FIELD) : null;
  if (!encoding) return buffer;
  if (encoding !== "gzip") throw new ServiceError("Unsupported report upload encoding. Please upload the file again.", 400);
  try {
    return gunzipSync(buffer, { maxOutputLength: MAX_REPORT_SOURCE_BYTES });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") {
      throw new ServiceError("The expanded report file exceeds 32 MB. Export a shorter date range and try again.", 413);
    }
    throw new ServiceError("The compressed report upload is damaged. Please upload the original CSV again.", 400);
  }
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
  assertSize(value);
  const arrayBuffer = await value.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: value.name || "file",
    contentType: value.type || "application/octet-stream",
  };
}

/** All files for a form field (supports `multiple` on the file input). */
export async function fileEntriesFromFormData(formData: FormData, field: string): Promise<UploadedFileEntry[]> {
  const values = formData.getAll(field);
  const out: UploadedFileEntry[] = [];
  for (const value of values) {
    if (!value || typeof value === "string") continue;
    assertSize(value);
  const arrayBuffer = await value.arrayBuffer();
    out.push({
      buffer: Buffer.from(arrayBuffer),
      fileName: value.name || "file",
      contentType: value.type || "application/octet-stream",
    });
  }
  return out;
}

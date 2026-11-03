import {
  MAX_REPORT_SOURCE_BYTES,
  MAX_REPORT_WIRE_BYTES,
  REPORT_UPLOAD_ENCODING_FIELD,
} from "@/lib/nre/report-upload-limits";

const compressedFiles = new WeakMap<File, Promise<Blob>>();

/** Lossless transport: all CSV rows reach the parser, including inactive campaigns. */
export async function fetchWizardUpload(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const body = init.body;
  if (!(body instanceof FormData)) return fetch(input, init);
  const file = body.get("mtdDailyCsv");
  if (!file || typeof file === "string" || file.size <= MAX_REPORT_WIRE_BYTES)
    return fetch(input, init);
  try {
    if (file.size > MAX_REPORT_SOURCE_BYTES)
      throw new Error(
        "This report file exceeds 32 MB. Export a shorter date range and try again.",
      );
    if (typeof CompressionStream === "undefined")
      throw new Error(
        "This browser cannot prepare large report files. Update your browser or export a file smaller than 4 MB.",
      );
    let pending = compressedFiles.get(file);
    if (!pending) {
      pending = new Response(
        file.stream().pipeThrough(new CompressionStream("gzip")),
      ).blob();
      compressedFiles.set(file, pending);
      void pending.catch(() => compressedFiles.delete(file));
    }
    const compressed = await pending;
    if (compressed.size > MAX_REPORT_WIRE_BYTES)
      throw new Error(
        "This report file is still too large after compression. Export a shorter date range and try again.",
      );
    const prepared = new FormData();
    body.forEach((value, key) => prepared.append(key, value));
    prepared.set("mtdDailyCsv", compressed, file.name);
    prepared.set(REPORT_UPLOAD_ENCODING_FIELD, "gzip");
    return fetch(input, { ...init, body: prepared });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not prepare the report upload. Please try again.",
      },
      { status: 413 },
    );
  }
}

export function uploadFailureMessage(
  response: Response | null,
  json: { error?: string } | null,
  fallback: string,
): string {
  return (
    json?.error ||
    (response?.status === 413
      ? "This report upload exceeds the server request limit. Export a shorter date range and try again."
      : fallback)
  );
}

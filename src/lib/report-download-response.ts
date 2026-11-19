import { createHash } from "node:crypto";
import { attachmentContentDisposition } from "./download-filename";

export const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Shared transfer contract, after the caller has checked report ownership/share access. */
export function reportDownloadResponse(
  request: Request,
  buffer: Buffer,
  fileName: string,
): Response {
  const size = buffer.length;
  const etag = `"${createHash("sha256").update(buffer).digest("hex")}"`;
  const headers = new Headers({
    "Content-Type": PPTX_CONTENT_TYPE,
    "Content-Disposition": attachmentContentDisposition(fileName),
    "Content-Length": String(size),
    "Cache-Control": "private, no-store, no-transform",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ETag: etag,
  });
  // A changed file must restart, never splice new bytes into an old partial file.
  const ifRange = request.headers.get("if-range");
  const range =
    request.method === "GET" && (!ifRange || ifRange === etag)
      ? request.headers.get("range")?.trim()
      : null;
  const match = range?.match(/^bytes=(\d*)-(\d*)$/i);
  if (match && (match[1] || match[2])) {
    const start = match[1]
      ? Number(match[1])
      : Math.max(0, size - Number(match[2]));
    const end =
      match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= size ||
      end < start ||
      (!match[1] && Number(match[2]) === 0)
    ) {
      headers.set("Content-Range", `bytes */${size}`);
      headers.set("Content-Length", "0");
      return new Response(null, { status: 416, headers });
    }
    const bytes = buffer.subarray(start, end + 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(bytes.length));
    return new Response(new Uint8Array(bytes), { status: 206, headers });
  }
  // Unsupported/multiple ranges are ignored rather than returning an invalid partial body.
  return new Response(
    request.method === "HEAD" ? null : new Uint8Array(buffer),
    { headers },
  );
}

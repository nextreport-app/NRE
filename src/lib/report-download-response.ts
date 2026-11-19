import { get, BlobError } from "@vercel/blob";
import { attachmentContentDisposition } from "./download-filename";

export const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Bounded fallback for storage/proxies that ignore Range; never buffer the full file. */
function sliceStream(
  source: ReadableStream<Uint8Array>,
  start: number,
  end: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let position = 0;
  return new ReadableStream({
    async pull(controller) {
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) {
            controller.close();
            return;
          }
          const before = position;
          position += next.value.length;
          const from = Math.max(0, start - before),
            to = Math.min(next.value.length, end + 1 - before);
          if (to > from) controller.enqueue(next.value.subarray(from, to));
          if (position > end) {
            controller.close();
            void reader.cancel().catch(() => {});
            return;
          }
          if (to > from) return;
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/** Only call after checking report ownership or the active share token. */
export async function reportDownloadResponse(
  request: Request,
  filePath: string,
  fileName: string,
): Promise<Response> {
  const requestedRange = request.headers.get("range")?.trim();
  // Unsupported multiple/malformed ranges fall back to a full response.
  const range =
    request.method === "HEAD"
      ? "bytes=0-0"
      : requestedRange && /^bytes=(?:\d+-\d*|-\d+)$/i.test(requestedRange)
        ? requestedRange
        : null;
  const ifRange =
    request.method !== "HEAD" && range ? request.headers.get("if-range") : null;
  const open = (rangeHeader: string | null, validator: string | null = null) =>
    get(filePath, {
      access: "private",
      abortSignal: request.signal,
      headers: {
        "Accept-Encoding": "identity",
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        ...(validator ? { "If-Range": validator } : {}),
      },
    });
  const headers = new Headers({
    "Content-Type": PPTX_CONTENT_TYPE,
    "Content-Disposition": attachmentContentDisposition(fileName),
    "Cache-Control": "private, no-store, no-transform",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  let result;
  try {
    result = await open(range, ifRange);
  } catch (error) {
    // The SDK throws for an origin 416. A one-byte metadata read obtains the
    // total size without buffering a whole PPTX just to reject an invalid range.
    if (
      !range ||
      !(error instanceof BlobError) ||
      !/fetch blob: 416\b/.test(error.message)
    )
      throw error;
    const metadata = await open("bytes=0-0");
    if (!metadata || metadata.statusCode !== 200)
      throw Error("Report file not found in storage.");
    const total =
      metadata.headers.get("content-range")?.match(/\/(\d+)$/)?.[1] ??
      String(metadata.blob.size);
    void metadata.stream.cancel().catch(() => {});
    headers.set("Content-Range", `bytes */${total}`);
    headers.set("Content-Length", "0");
    return new Response(null, { status: 416, headers });
  }
  if (!result || result.statusCode !== 200)
    throw Error("Report file not found in storage.");
  const etag = result.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  const contentRange = result.headers.get("content-range");
  const partial = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  const length = result.headers.get("content-length");
  if (request.method === "HEAD") {
    headers.set(
      "Content-Length",
      partial?.[3] ?? length ?? String(result.blob.size),
    );
    void result.stream.cancel().catch(() => {});
    return new Response(null, { headers });
  }
  // Preserve bounded transfers even if a storage layer ignores a Range header.
  // A stale If-Range must still restart as 200, never splice different versions.
  if (range && !partial && (!ifRange || ifRange === etag)) {
    const size = Number(length ?? result.blob.size);
    const match = range.match(/^bytes=(\d*)-(\d*)$/i)!;
    const start = match[1]
      ? Number(match[1])
      : Math.max(0, size - Number(match[2]));
    const end =
      match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (Number.isSafeInteger(size) && size > 0) {
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start >= size ||
        end < start ||
        (!match[1] && Number(match[2]) === 0)
      ) {
        void result.stream.cancel().catch(() => {});
        headers.set("Content-Range", `bytes */${size}`);
        headers.set("Content-Length", "0");
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(sliceStream(result.stream, start, end), {
        status: 206,
        headers,
      });
    }
  }
  if (length) headers.set("Content-Length", length);
  if (partial) headers.set("Content-Range", contentRange!);
  // Vercel Blob's get() result uses statusCode 200 for all successful reads,
  // including origin 206 responses. Content-Range carries the real semantics.
  // Stream the requested bytes directly; never reread/hash the whole file for
  // every browser part. Cancellation propagates to the storage stream.
  return new Response(result.stream, { status: partial ? 206 : 200, headers });
}

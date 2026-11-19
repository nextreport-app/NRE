/** Browser-side report transfer: never offer a partial or error response as a PPTX. */
export const REPORT_PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export interface DownloadProgress {
  received: number;
  total: number | null;
  reconnecting?: boolean;
}

function responseFileName(header: string | null): string {
  const encoded = header?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  let name = header?.match(/filename\s*=\s*"([^"]+)"/i)?.[1] ?? "report.pptx";
  if (encoded) {
    try {
      name = decodeURIComponent(encoded.trim());
    } catch {
      /* use ASCII fallback */
    }
  }
  return name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim() || "report.pptx";
}

/** PPTX is ZIP: require its complete end-of-central-directory record, including any comment. */
function completePptx(bytes: Uint8Array): boolean {
  if (
    bytes.length < 22 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 3 ||
    bytes[3] !== 4
  )
    return false;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 5 &&
      bytes[i + 3] === 6
    ) {
      if (i + 22 + bytes[i + 20] + bytes[i + 21] * 256 === bytes.length)
        return true;
    }
  }
  return false;
}

// Keep individual responses well below multi-megabyte proxy/function transfers.
const PART_BYTES = 512 * 1024;
const MAX_BYTES = 64 * 1024 * 1024;
const ATTEMPTS = 3;

class InterruptedTransfer extends Error {}

function retryDelay(
  signal: AbortSignal | undefined,
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

type DownloadOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
  idleTimeoutMs?: number;
};

/** One bounded request; retries never append bytes from an unfinished response. */
async function readPart(
  href: string,
  offset: number,
  version: { etag: string; total: number } | null,
  options: DownloadOptions,
): Promise<{
  bytes: Uint8Array;
  etag: string | null;
  total: number;
  fileName: string;
}> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const resetTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.idleTimeoutMs ?? 15000);
  };
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  resetTimeout();
  try {
    const end = Math.min(
      offset + PART_BYTES - 1,
      (version?.total ?? MAX_BYTES) - 1,
    );
    const response = await fetch(href, {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Range: `bytes=${offset}-${end}`,
        ...(version ? { "If-Range": version.etag } : {}),
      },
    });
    if (!response.ok) {
      if (response.status === 401)
        throw Error(
          "Your session expired. Sign in again, then retry the download.",
        );
      if ([408, 429, 500, 502, 503, 504].includes(response.status))
        throw new InterruptedTransfer(
          "The download service was interrupted. Please retry.",
        );
      throw Error("The report could not be downloaded. Please retry.");
    }
    if (
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith(REPORT_PPTX_MIME) ||
      !response.body
    )
      throw Error(
        "The server did not return a PPTX. Refresh the report and retry.",
      );

    const partial = response.status === 206;
    const match = response.headers
      .get("content-range")
      ?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    const etag = response.headers.get("etag");
    let total: number | null = null;
    let expected: number | null = null;
    if (partial) {
      if (!match || !etag || !/^"[^"\r\n]+"$/.test(etag))
        throw Error(
          "The download response could not be verified. Please refresh and retry.",
        );
      const [start, last, size] = match.slice(1).map(Number);
      if (
        ![start, last, size].every(Number.isSafeInteger) ||
        size <= 0 ||
        start !== offset ||
        last !== Math.min(end, size - 1) ||
        last < start
      )
        throw Error(
          "The download response could not be verified. Please refresh and retry.",
        );
      if (version && (etag !== version.etag || size !== version.total))
        throw Error(
          "The report changed while downloading. Refresh the report and retry.",
        );
      total = size;
      expected = last - start + 1;
    } else {
      // Legacy/proxy fallback may ignore Range on the first request. Never splice
      // a full replacement response onto already verified parts.
      if (offset !== 0)
        throw Error(
          "The report changed while downloading. Refresh the report and retry.",
        );
      const encoding = response.headers.get("content-encoding");
      const length = Number(response.headers.get("content-length"));
      if (
        (!encoding || encoding === "identity") &&
        Number.isSafeInteger(length) &&
        length > 0
      )
        total = expected = length;
    }
    if (total !== null && total > MAX_BYTES)
      throw Error(
        "This report exceeds the download size limit. Try a shorter reporting period.",
      );
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    options.onProgress?.({ received: offset, total });
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      resetTimeout();
      received += result.value.length;
      if (received > (expected ?? MAX_BYTES))
        throw Error(
          "The download response could not be verified. Please refresh and retry.",
        );
      chunks.push(result.value);
      options.onProgress?.({ received: offset + received, total });
    }
    if (controller.signal.aborted)
      throw new DOMException("Aborted", "AbortError");
    if (expected !== null && received !== expected)
      throw new InterruptedTransfer(
        "The download was interrupted. Please retry.",
      );
    const bytes = new Uint8Array(received);
    let position = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, position);
      position += chunk.length;
    }
    return {
      bytes,
      total: total ?? received,
      etag: partial ? etag : null,
      fileName: responseFileName(response.headers.get("content-disposition")),
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timedOut)
      throw new InterruptedTransfer(
        "The download stopped responding. Please retry.",
      );
    if (error instanceof TypeError)
      throw new InterruptedTransfer(
        "The download connection was interrupted. Please retry.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    void reader?.cancel().catch(() => {});
    controller.abort();
  }
}

async function readPartWithRetry(
  href: string,
  offset: number,
  version: { etag: string; total: number } | null,
  options: DownloadOptions,
): Promise<Awaited<ReturnType<typeof readPart>>> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await readPart(href, offset, version, options);
    } catch (error) {
      if (
        options.signal?.aborted ||
        !(error instanceof InterruptedTransfer) ||
        attempt === ATTEMPTS - 1
      )
        throw error;
      options.onProgress?.({
        received: offset,
        total: version?.total ?? null,
        reconnecting: true,
      });
      await retryDelay(options.signal, 250 * (attempt + 1));
    }
  }
}

export async function fetchReportDownload(
  href: string,
  options: DownloadOptions = {},
): Promise<{ blob: Blob; fileName: string }> {
  const transfer = new AbortController();
  const abort = () => transfer.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) transfer.abort();
  const transferOptions = { ...options, signal: transfer.signal };
  try {
    const first = await readPartWithRetry(href, 0, null, transferOptions);
    const parts: Uint8Array[] = [first.bytes];
    // Establish file identity once, then fetch at most three independent parts
    // at a time. Promise.all preserves byte order even if responses finish in
    // a different order. Every part still verifies the same ETag and total.
    if (first.etag) {
      const version = { etag: first.etag, total: first.total };
      for (let offset = first.bytes.length; offset < first.total;) {
        const starts = Array.from(
          {
            length: Math.min(3, Math.ceil((first.total - offset) / PART_BYTES)),
          },
          (_, index) => offset + index * PART_BYTES,
        );
        const progress = new Map<
          number,
          { received: number; reconnecting: boolean }
        >();
        const completed = offset;
        const batch = await Promise.all(
          starts.map((start) =>
            readPartWithRetry(href, start, version, {
              ...transferOptions,
              onProgress: (state) => {
                progress.set(start, {
                  received: state.received - start,
                  reconnecting: !!state.reconnecting,
                });
                const values = [...progress.values()];
                options.onProgress?.({
                  received:
                    completed +
                    values.reduce((sum, part) => sum + part.received, 0),
                  total: first.total,
                  ...(values.some((part) => part.reconnecting)
                    ? { reconnecting: true }
                    : {}),
                });
              },
            }),
          ),
        );
        for (const part of batch) {
          parts.push(part.bytes);
          offset += part.bytes.length;
        }
      }
    }
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const bytes = new Uint8Array(size);
    let position = 0;
    for (const part of parts) {
      bytes.set(part, position);
      position += part.length;
    }
    if (!completePptx(bytes))
      throw Error("The download was incomplete. Please retry.");
    options.onProgress?.({ received: size, total: size });
    return {
      blob: new Blob([bytes], { type: REPORT_PPTX_MIME }),
      fileName: first.fileName,
    };
  } finally {
    options.signal?.removeEventListener("abort", abort);
    // Stop sibling requests immediately when one part fails or navigation ends.
    transfer.abort();
  }
}

/** Browser-side report transfer: never offer a partial or error response as a PPTX. */
export const REPORT_PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export interface DownloadProgress {
  received: number;
  total: number | null;
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

export async function fetchReportDownload(
  href: string,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: DownloadProgress) => void;
    idleTimeoutMs?: number;
  } = {},
): Promise<{ blob: Blob; fileName: string }> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const resetTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.idleTimeoutMs ?? 30000);
  };
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  resetTimeout();
  try {
    const response = await fetch(href, {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 401)
        throw Error(
          "Your session expired. Sign in again, then retry the download.",
        );
      throw Error("The report could not be downloaded. Please retry.");
    }
    if (
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith(REPORT_PPTX_MIME) ||
      !response.body
    ) {
      throw Error(
        "The server did not return a PPTX. Refresh the report and retry.",
      );
    }
    const encoding = response.headers.get("content-encoding");
    const length = Number(response.headers.get("content-length"));
    const total =
      (!encoding || encoding === "identity") &&
      Number.isSafeInteger(length) &&
      length > 0
        ? length
        : null;
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    options.onProgress?.({ received, total });
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      resetTimeout();
      received += result.value.length;
      // Keep a failed/malicious response from consuming unbounded browser memory.
      if (received > 64 * 1024 * 1024)
        throw Error(
          "This report exceeds the download size limit. Try a shorter reporting period.",
        );
      chunks.push(result.value);
      options.onProgress?.({ received, total });
    }
    if (controller.signal.aborted)
      throw new DOMException("Aborted", "AbortError");
    if (total !== null && received !== total)
      throw Error("The download was interrupted. Please retry.");
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (!completePptx(bytes))
      throw Error("The download was incomplete. Please retry.");
    return {
      blob: new Blob([bytes], { type: REPORT_PPTX_MIME }),
      fileName: responseFileName(response.headers.get("content-disposition")),
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timedOut) throw Error("The download stopped responding. Please retry.");
    if (error instanceof TypeError)
      throw Error("The download connection was interrupted. Please retry.");
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    void reader?.cancel().catch(() => {});
  }
}

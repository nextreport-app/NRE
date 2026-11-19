import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
  fetchReportDownload,
  REPORT_PPTX_MIME,
} from "../fetch-report-download";
let bytes: Uint8Array;
beforeAll(async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("ppt/presentation.xml", "<presentation/>");
  bytes = await zip.generateAsync({ type: "uint8array" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function response(data = bytes, headers: Record<string, string> = {}) {
  return new Response(data as BodyInit, {
    headers: {
      "content-type": REPORT_PPTX_MIME,
      "content-length": String(data.length),
      ...headers,
    },
  });
}
describe("complete report download", () => {
  it("receives every byte, reports progress and preserves a Unicode filename", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(bytes, {
          "content-disposition":
            "attachment; filename=\"report.pptx\"; filename*=UTF-8''Meta%20Ads%20%E2%80%93%20Weekly.pptx",
        }),
      ),
    );
    const progress = vi.fn();
    const result = await fetchReportDownload("/api/reports/1/download", {
      onProgress: progress,
    });
    expect(result.fileName).toBe("Meta Ads – Weekly.pptx");
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
    expect(progress).toHaveBeenLastCalledWith({
      received: bytes.length,
      total: bytes.length,
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/reports/1/download",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });
  it("rejects a halfway response instead of offering a corrupt PPTX", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        response(bytes.slice(0, bytes.length / 2), {
          "content-length": String(bytes.length),
        }),
      ),
    );
    await expect(fetchReportDownload("/download")).rejects.toThrow(
      /interrupted/,
    );
  });
  it("detects a missing ZIP footer even when the server supplied no length", async () => {
    const r = response(bytes.slice(0, bytes.length - 22));
    r.headers.delete("content-length");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(r));
    await expect(fetchReportDownload("/download")).rejects.toThrow(
      /incomplete/,
    );
  });
  it("allows a complete compressed transfer without confusing wire and decoded lengths", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(bytes, {
          "content-encoding": "gzip",
          "content-length": "10",
        }),
      ),
    );
    const progress = vi.fn();
    const result = await fetchReportDownload("/download", {
      onProgress: progress,
    });
    expect(result.blob.size).toBe(bytes.length);
    expect(progress).toHaveBeenLastCalledWith({
      received: bytes.length,
      total: bytes.length,
    });
  });
  it("shows an expired-session error rather than saving an error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"error":"Unauthorized"}', {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(fetchReportDownload("/download")).rejects.toThrow(
      /session expired/,
    );
  });
  it("does not save a sign-in HTML page returned with status 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Sign in</html>", {
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    await expect(fetchReportDownload("/download")).rejects.toThrow(
      /did not return a PPTX/,
    );
  });
  it("automatically recovers an idle half-transfer without another click", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce((_href, options) =>
          Promise.resolve(
            new Response(
              new ReadableStream({
                start(c) {
                  c.enqueue(bytes.slice(0, 10));
                  options.signal.addEventListener(
                    "abort",
                    () => c.error(new DOMException("Aborted", "AbortError")),
                    { once: true },
                  );
                },
              }),
              {
                headers: {
                  "content-type": REPORT_PPTX_MIME,
                  "content-length": String(bytes.length),
                },
              },
            ),
          ),
        )
        .mockResolvedValueOnce(response()),
    );
    const result = fetchReportDownload("/download", { idleTimeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(301);
    expect((await result).blob.size).toBe(bytes.length);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("honors navigation cancellation without offering a partial file", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          (_href, options) =>
            new Promise((_resolve, reject) =>
              options.signal.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              ),
            ),
        ),
    );
    const result = fetchReportDownload("/download", {
      signal: controller.signal,
    });
    const rejection = expect(result).rejects.toThrow(/Aborted/);
    controller.abort();
    await rejection;
  });
});

it("keeps a slow transfer alive while new bytes continue arriving", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((_href, options) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(bytes.slice(0, 10));
              const a = setTimeout(() => c.enqueue(bytes.slice(10, 20)), 30),
                b = setTimeout(() => {
                  c.enqueue(bytes.slice(20));
                  c.close();
                }, 60);
              options.signal.addEventListener(
                "abort",
                () => {
                  clearTimeout(a);
                  clearTimeout(b);
                  c.error(new DOMException("Aborted", "AbortError"));
                },
                { once: true },
              );
            },
          }),
          {
            headers: {
              "content-type": REPORT_PPTX_MIME,
              "content-length": String(bytes.length),
            },
          },
        ),
      ),
    ),
  );
  const promise = fetchReportDownload("/download", { idleTimeoutMs: 50 });
  await vi.advanceTimersByTimeAsync(61);
  expect((await promise).blob.size).toBe(bytes.length);
});

const PART = 512 * 1024;
let largeBytes: Uint8Array;
beforeAll(async () => {
  const zip = new JSZip();
  zip.file(
    "ppt/media/large-image.png",
    new Uint8Array(PART * 2 + 100).map((_, i) => i % 251),
  );
  largeBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "STORE",
  });
});
function partial(
  start: number,
  end: number,
  overrides: Record<string, string> = {},
  truncated = false,
) {
  const last = Math.min(end, largeBytes.length - 1);
  const data = largeBytes.slice(start, truncated ? start + 7 : last + 1);
  return new Response(data as BodyInit, {
    status: 206,
    headers: {
      "content-type": REPORT_PPTX_MIME,
      "content-range": `bytes ${start}-${last}/${largeBytes.length}`,
      "content-length": String(last - start + 1),
      etag: '"version-1"',
      "content-disposition": 'attachment; filename="weekly.pptx"',
      ...overrides,
    },
  });
}
function requestedRange(options: RequestInit) {
  const match = new Headers(options.headers)
    .get("range")!
    .match(/bytes=(\d+)-(\d+)/)!;
  return [Number(match[1]), Number(match[2])] as const;
}
describe("bounded resumable report transfer", () => {
  it("automatically retries an interrupted middle part, preserving complete parts and exact bytes", async () => {
    vi.useFakeTimers();
    const offsets: number[] = [];
    const validators: (string | null)[] = [];
    let failures = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_href, options) => {
        const [start, end] = requestedRange(options);
        expect(end - start + 1).toBeLessThanOrEqual(PART);
        offsets.push(start);
        validators.push(new Headers(options.headers).get("if-range"));
        return Promise.resolve(
          partial(start, end, {}, start === PART && failures++ < 2),
        );
      }),
    );
    const progress = vi.fn();
    const pending = fetchReportDownload("/download", { onProgress: progress });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(largeBytes);
    expect(offsets).toEqual([0, PART, PART, PART, PART * 2]);
    expect(validators).toEqual([
      null,
      '"version-1"',
      '"version-1"',
      '"version-1"',
      '"version-1"',
    ]);
    expect(result.fileName).toBe("weekly.pptx");
    expect(progress).toHaveBeenCalledWith({
      received: PART,
      total: largeBytes.length,
      reconnecting: true,
    });
  });
  it("gives a visible error after bounded retries instead of retrying forever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_href, options) => {
        const [start, end] = requestedRange(options);
        return Promise.resolve(partial(start, end, {}, true));
      }),
    );
    const rejected = expect(fetchReportDownload("/download")).rejects.toThrow(
      /interrupted/,
    );
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([
    "changed ETag",
    "changed size",
    "incorrect position",
    "missing validator",
    "weak validator",
  ])("rejects %s without mixing file versions or positions", async (label) => {
    const headers: Record<string, string> =
      label === "changed ETag"
        ? { etag: '\"version-2\"' }
        : label === "changed size"
          ? {
              "content-range": `bytes ${PART}-${PART * 2 - 1}/${largeBytes.length + 1}`,
            }
          : label === "incorrect position"
            ? { "content-range": `bytes 0-${PART - 1}/${largeBytes.length}` }
            : { etag: label === "missing validator" ? "" : 'W/\"version-1\"' };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_href, options) => {
        const [start, end] = requestedRange(options);
        return Promise.resolve(partial(start, end, start ? headers : {}));
      }),
    );
    await expect(fetchReportDownload("/download")).rejects.toThrow(
      /changed|verified/,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("never appends a full replacement when If-Range falls back to 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(partial(0, PART - 1))
        .mockResolvedValueOnce(response(largeBytes)),
    );
    await expect(fetchReportDownload("/download")).rejects.toThrow(/changed/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("stops immediately if authorization expires between parts", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(partial(0, PART - 1))
        .mockResolvedValueOnce(new Response(null, { status: 401 })),
    );
    await expect(fetchReportDownload("/download")).rejects.toThrow(
      /session expired/,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("recovers a transient service error before the first part", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(response()),
    );
    const pending = fetchReportDownload("/download");
    await vi.advanceTimersByTimeAsync(251);
    expect((await pending).blob.size).toBe(bytes.length);
  });
  it("cancels during reconnection without issuing another request", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network disconnected")),
    );
    const pending = fetchReportDownload("/download", {
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.reconnecting) controller.abort();
      },
    });
    await expect(pending).rejects.toThrow(/Aborted/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

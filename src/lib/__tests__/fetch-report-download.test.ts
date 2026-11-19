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
      vi.fn().mockResolvedValue(
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
      total: null,
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
  it("stops an idle half-transfer and permits a fresh retry", async () => {
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
    const rejection = expect(result).rejects.toThrow(/stopped responding/);
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
    expect((await fetchReportDownload("/download")).blob.size).toBe(
      bytes.length,
    );
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

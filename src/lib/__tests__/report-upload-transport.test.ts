import { afterEach, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { fileFromFormData } from "../http-file";
import {
  fetchWizardUpload,
  uploadFailureMessage,
} from "@/components/report-upload-wizard/upload-transport";
import {
  MAX_REPORT_SOURCE_BYTES,
  MAX_REPORT_WIRE_BYTES,
  REPORT_UPLOAD_ENCODING_FIELD,
} from "../nre/report-upload-limits";

afterEach(() => vi.unstubAllGlobals());
describe("bounded report upload transport", () => {
  it("round trips a large multi-campaign export without dropping rows or form fields", async () => {
    const csv =
      "Campaign name,Day,Amount spent\n" +
      Array.from(
        { length: 70000 },
        (_, i) =>
          `Campaign ${i % 1024},2026-11-02,${i % 1024 < 3 ? 10 : 0},${"x".repeat(50)}\n`,
      ).join("");
    const file = new File([csv], "report.csv");
    expect(file.size).toBeGreaterThan(MAX_REPORT_WIRE_BYTES);
    const form = new FormData();
    form.set("mtdDailyCsv", file);
    form.set("reportType", '"WEEKLY"');
    const fetchMock = vi.fn(async (_input, init: RequestInit) => {
      const received = init.body as FormData;
      expect(received.get(REPORT_UPLOAD_ENCODING_FIELD)).toBe("gzip");
      expect((received.get("mtdDailyCsv") as File).size).toBeLessThan(
        MAX_REPORT_WIRE_BYTES,
      );
      expect((received.get("mtdDailyCsv") as File).name).toBe("report.csv");
      expect(received.get("reportType")).toBe('"WEEKLY"');
      expect(
        (await fileFromFormData(received, "mtdDailyCsv"))?.toString(),
      ).toBe(csv);
      return Response.json({ valid: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(
      (
        await fetchWizardUpload("https://example.test", {
          method: "POST",
          body: form,
        })
      ).ok,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("retains the raw upload budget and rejects corrupt or unknown compressed input", async () => {
    const form = new FormData();
    form.set(
      "mtdDailyCsv",
      new File([new Uint8Array(MAX_REPORT_WIRE_BYTES + 1)], "large.csv"),
    );
    await expect(fileFromFormData(form, "mtdDailyCsv")).rejects.toThrow("4 MB");
    form.set("mtdDailyCsv", new File(["not gzip"], "report.csv"));
    form.set(REPORT_UPLOAD_ENCODING_FIELD, "gzip");
    await expect(fileFromFormData(form, "mtdDailyCsv")).rejects.toThrow(
      "damaged",
    );
    form.set(REPORT_UPLOAD_ENCODING_FIELD, "unknown");
    await expect(fileFromFormData(form, "mtdDailyCsv")).rejects.toThrow(
      "Unsupported",
    );
  });
  it("bounds decompression to prevent expansion beyond 32 MB", async () => {
    const form = new FormData();
    form.set(
      "mtdDailyCsv",
      new File(
        [gzipSync(Buffer.alloc(MAX_REPORT_SOURCE_BYTES + 1))],
        "report.csv",
      ),
    );
    form.set(REPORT_UPLOAD_ENCODING_FIELD, "gzip");
    await expect(fileFromFormData(form, "mtdDailyCsv")).rejects.toThrow(
      "32 MB",
    );
  });
  it("surfaces actionable server and hosting-limit errors", () => {
    expect(
      uploadFailureMessage(
        new Response(null, { status: 413 }),
        null,
        "generic",
      ),
    ).toContain("request limit");
    expect(
      uploadFailureMessage(null, { error: "Specific problem" }, "generic"),
    ).toBe("Specific problem");
  });
});

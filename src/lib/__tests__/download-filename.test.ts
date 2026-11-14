import { describe, expect, it } from "vitest";
import { attachmentContentDisposition } from "../download-filename";
describe("download filename headers", () => {
  it.each(["Daily Report – Nov 1–13, 2026.pptx", "Résumé ₹ 日本語.pptx", "Report (client's copy)!.pptx"])("encodes %s without losing the download name", fileName => {
    const value = attachmentContentDisposition(fileName);
    expect(() => new Headers({"Content-Disposition":value})).not.toThrow();
    expect(value).toMatch(/^[\x20-\x7e]+$/);
    expect(decodeURIComponent(value.split("filename*=UTF-8''")[1])).toBe(fileName);
  });
  it("removes header controls and path separators", () => {
    const value = attachmentContentDisposition('bad/"name\r\nInjected:yes.pptx');
    expect(value).not.toMatch(/[\r\n]/);
    expect(value).not.toContain('filename="bad/');
    expect(() => new Headers({"Content-Disposition":value})).not.toThrow();
  });
  it("has a usable fallback for an empty name", () => {
    expect(attachmentContentDisposition("\r\n")).toContain('filename="report.pptx"');
  });
});

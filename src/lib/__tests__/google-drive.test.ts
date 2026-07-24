import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_DRIVE_SCOPE,
  getFreshGoogleAccessToken,
  shareFilePublicly,
  uploadPptxAsGoogleSlides,
} from "../google-drive";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GOOGLE_DRIVE_SCOPE", () => {
  it("is the narrow drive.file scope, not full Drive access", () => {
    expect(GOOGLE_DRIVE_SCOPE).toBe("https://www.googleapis.com/auth/drive.file");
  });
});

describe("getFreshGoogleAccessToken", () => {
  it("exchanges a refresh_token for an access_token via the Google token endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "fresh-token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await getFreshGoogleAccessToken("refresh-abc");
    expect(token).toBe("fresh-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(init.body);
    expect(body.get("refresh_token")).toBe("refresh-abc");
    expect(body.get("grant_type")).toBe("refresh_token");
  });

  it("throws with the response status and body when the exchange fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "invalid_grant" }),
    );
    await expect(getFreshGoogleAccessToken("bad")).rejects.toThrow(/401/);
  });
});

describe("uploadPptxAsGoogleSlides", () => {
  it("uploads with mimeType set to the Slides type so Drive auto-converts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "file-123", webViewLink: "https://docs.google.com/presentation/d/file-123/edit" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const pptxBuffer = Buffer.from("PK\x03\x04fake-pptx-bytes");
    const result = await uploadPptxAsGoogleSlides("access-token", pptxBuffer, "My Report");

    expect(result).toEqual({ id: "file-123", webViewLink: "https://docs.google.com/presentation/d/file-123/edit" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("uploadType=multipart");
    expect(url).toContain("fields=id,webViewLink");
    expect(init.headers.Authorization).toBe("Bearer access-token");
    expect(init.headers["Content-Type"]).toMatch(/^multipart\/related; boundary=/);

    const bodyBuffer = Buffer.from(init.body as Uint8Array);
    const bodyText = bodyBuffer.toString("utf-8");
    expect(bodyText).toContain('"mimeType":"application/vnd.google-apps.presentation"');
    expect(bodyText).toContain('"name":"My Report"');
    expect(bodyText).toContain("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(bodyBuffer.includes(pptxBuffer)).toBe(true);
  });

  it("throws with the response status and body on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "insufficient scope" }),
    );
    await expect(uploadPptxAsGoogleSlides("token", Buffer.from("x"), "name")).rejects.toThrow(/403/);
  });
});

describe("shareFilePublicly", () => {
  it("sets the file to anyone-with-the-link can view", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await shareFilePublicly("access-token", "file-123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/drive/v3/files/file-123/permissions");
    expect(init.headers.Authorization).toBe("Bearer access-token");
    expect(JSON.parse(init.body)).toEqual({ role: "reader", type: "anyone" });
  });

  it("throws with the response status and body on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" }),
    );
    await expect(shareFilePublicly("token", "file-123")).rejects.toThrow(/500/);
  });
});

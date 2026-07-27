import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGoogleDriveConnectUrl,
  exchangeGoogleAuthCode,
  fetchGoogleAccountEmail,
  getDriveFolderName,
  GOOGLE_DRIVE_SCOPE,
  getFreshGoogleAccessToken,
  saveReportToDriveFolder,
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
  it("uploads with mimeType set to the Slides type so Drive auto-converts, and always allows Shared Drive destinations", async () => {
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
    expect(url).toContain("supportsAllDrives=true");
    expect(init.headers.Authorization).toBe("Bearer access-token");
    expect(init.headers["Content-Type"]).toMatch(/^multipart\/related; boundary=/);

    const bodyBuffer = Buffer.from(init.body as Uint8Array);
    const bodyText = bodyBuffer.toString("utf-8");
    expect(bodyText).toContain('"mimeType":"application/vnd.google-apps.presentation"');
    expect(bodyText).toContain('"name":"My Report"');
    expect(bodyText).not.toContain('"parents"'); // no parentId given — uploads to Drive root
    expect(bodyText).toContain("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(bodyBuffer.includes(pptxBuffer)).toBe(true);
  });

  it("places the file inside a folder when parentId is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "file-123", webViewLink: "https://docs.google.com/presentation/d/file-123/edit" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await uploadPptxAsGoogleSlides("access-token", Buffer.from("x"), "My Report", "folder-abc");

    const [, init] = fetchMock.mock.calls[0];
    const bodyText = Buffer.from(init.body as Uint8Array).toString("utf-8");
    expect(bodyText).toContain('"parents":["folder-abc"]');
  });

  it("throws with the response status and body on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "insufficient scope" }),
    );
    await expect(uploadPptxAsGoogleSlides("token", Buffer.from("x"), "name")).rejects.toThrow(/403/);
  });
});

describe("buildGoogleDriveConnectUrl", () => {
  it("requests offline access, forces the account picker, and carries the state through", () => {
    const url = new URL(buildGoogleDriveConnectUrl("https://app.example.com/api/google-drive/callback", "nonce-123"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/google-drive/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent select_account");
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("scope")).toContain(GOOGLE_DRIVE_SCOPE);
    expect(url.searchParams.get("scope")).toContain("email");
    // Only drive.file — no drive.readonly or broad "drive" scope requested.
    expect(url.searchParams.get("scope")).not.toContain("drive.readonly");
    expect(url.searchParams.get("scope")?.split(" ")).not.toContain("https://www.googleapis.com/auth/drive");
  });
});

describe("exchangeGoogleAuthCode", () => {
  it("exchanges an authorization code for tokens via the Google token endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "a", refresh_token: "r", expires_in: 3600, scope: "x", token_type: "Bearer" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await exchangeGoogleAuthCode("auth-code", "https://app.example.com/callback");
    expect(tokens.access_token).toBe("a");
    expect(tokens.refresh_token).toBe("r");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(init.body);
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("throws with the response status and body when the exchange fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "invalid_grant" }));
    await expect(exchangeGoogleAuthCode("bad", "https://x/callback")).rejects.toThrow(/400/);
  });
});

describe("fetchGoogleAccountEmail", () => {
  it("returns the connected account's email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ email: "user@example.com" }) }));
    expect(await fetchGoogleAccountEmail("token")).toBe("user@example.com");
  });

  it("returns null instead of throwing when the userinfo call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await fetchGoogleAccountEmail("bad-token")).toBeNull();
  });
});

describe("getDriveFolderName", () => {
  it("returns the folder's display name when the metadata lookup succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Client Reports" }) }));
    expect(await getDriveFolderName("token", "folder-1")).toBe("Client Reports");
  });

  it("returns null (never throws) when the folder id is inaccessible under drive.file scope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "not found" }));
    expect(await getDriveFolderName("token", "unknown-folder")).toBeNull();
  });

  it("returns null (never throws) on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await getDriveFolderName("token", "folder-1")).toBeNull();
  });
});

describe("saveReportToDriveFolder", () => {
  it("refreshes the token, uploads straight into the given folder, and resolves its display name", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") return { ok: true, json: async () => ({ access_token: "fresh-token" }) };
      if (url.includes("uploadType=multipart")) return { ok: true, json: async () => ({ id: "f", webViewLink: "https://docs.google.com/presentation/d/f/edit" }) };
      if (url.includes("/permissions")) return { ok: true, text: async () => "" };
      if (url.includes("/files/chosen-folder")) return { ok: true, json: async () => ({ name: "Client Reports" }) };
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveReportToDriveFolder({
      refreshToken: "r",
      folderId: "chosen-folder",
      fileName: "Report",
      pptxBuffer: Buffer.from("x"),
    });
    expect(result.webViewLink).toBe("https://docs.google.com/presentation/d/f/edit");
    expect(result.folderName).toBe("Client Reports");

    const uploadCall = fetchMock.mock.calls.find(([url]) => url.includes("uploadType=multipart"))!;
    const body = Buffer.from(uploadCall[1].body as Uint8Array).toString("utf-8");
    expect(body).toContain('"parents":["chosen-folder"]');

    // Every call after the token refresh uses the freshly-minted access token.
    expect(uploadCall[1]!.headers!.Authorization).toBe("Bearer fresh-token");
    const shareCall = fetchMock.mock.calls.find(([url]) => url.includes("/permissions"))!;
    expect(shareCall[1]!.headers!.Authorization).toBe("Bearer fresh-token");
  });

  it("still succeeds, with folderName null, when the display-name lookup fails", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") return { ok: true, json: async () => ({ access_token: "t" }) };
      if (url.includes("uploadType=multipart")) return { ok: true, json: async () => ({ id: "f", webViewLink: "https://docs.google.com/presentation/d/f/edit" }) };
      if (url.includes("/permissions")) return { ok: true, text: async () => "" };
      if (url.includes("/files/chosen-folder")) return { ok: false, status: 404, text: async () => "not found" };
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveReportToDriveFolder({
      refreshToken: "r",
      folderId: "chosen-folder",
      fileName: "Report",
      pptxBuffer: Buffer.from("x"),
    });
    expect(result.webViewLink).toBe("https://docs.google.com/presentation/d/f/edit");
    expect(result.folderName).toBeNull();
  });

  it("falls back to a constructed presentation URL when Drive doesn't return a webViewLink", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") return { ok: true, json: async () => ({ access_token: "t" }) };
        if (url.includes("uploadType=multipart")) return { ok: true, json: async () => ({ id: "file-id" }) }; // no webViewLink
        if (url.includes("/permissions")) return { ok: true, text: async () => "" };
        if (url.includes("/files/chosen-folder")) return { ok: false, status: 404, text: async () => "not found" };
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const result = await saveReportToDriveFolder({
      refreshToken: "r",
      folderId: "chosen-folder",
      fileName: "Report",
      pptxBuffer: Buffer.from("x"),
    });
    expect(result.webViewLink).toBe("https://docs.google.com/presentation/d/file-id/edit");
  });

  it("propagates a thrown error when the upload itself fails (e.g. an invalid/inaccessible folder id)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") return { ok: true, json: async () => ({ access_token: "t" }) };
        if (url.includes("uploadType=multipart")) return { ok: false, status: 404, text: async () => "not found" };
        if (url.includes("/files/chosen-folder")) return { ok: false, status: 404, text: async () => "not found" };
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    await expect(
      saveReportToDriveFolder({
        refreshToken: "r",
        folderId: "chosen-folder",
        fileName: "Report",
        pptxBuffer: Buffer.from("x"),
      }),
    ).rejects.toThrow(/404/);
  });
});

describe("shareFilePublicly", () => {
  it("sets the file to anyone-with-the-link can view, allowing Shared Drive items", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await shareFilePublicly("access-token", "file-123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/drive/v3/files/file-123/permissions?supportsAllDrives=true");
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

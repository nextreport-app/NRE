import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  WIZARD_UPLOAD_SESSION_TTL_MS,
  WIZARD_UPLOAD_SESSION_VERSION,
  assertWizardUploadSessionOwnership,
  hashUploadBuffer,
  isWizardUploadSessionExpired,
  saveWizardUploadSession,
  loadWizardUploadSession,
  deleteWizardUploadSession,
  type WizardUploadSessionPayload,
} from "../wizard-upload-session";

vi.mock("@/lib/storage", () => ({
  saveWizardUploadSessionBlob: vi.fn().mockResolvedValue(undefined),
  readWizardUploadSessionBlob: vi.fn(),
  deleteWizardUploadSessionBlob: vi.fn().mockResolvedValue(undefined),
}));

import {
  saveWizardUploadSessionBlob,
  readWizardUploadSessionBlob,
  deleteWizardUploadSessionBlob,
} from "@/lib/storage";

const userId = "user-1";
const clientId = "client-1";
const sessionId = "550e8400-e29b-41d4-a716-446655440000";

function samplePayload(overrides: Partial<WizardUploadSessionPayload> = {}): WizardUploadSessionPayload {
  const now = Date.now();
  return {
    version: WIZARD_UPLOAD_SESSION_VERSION,
    userId,
    clientId,
    platform: "META",
    colMap: { date: "Day", campaign: "Campaign name", spend: "Amount spent (INR)" },
    rows: [{ Day: "2026-08-01", "Campaign name": "A", "Amount spent (INR)": "10" }],
    headers: ["Day", "Campaign name", "Amount spent (INR)"],
    fileHash: "abc123",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + WIZARD_UPLOAD_SESSION_TTL_MS).toISOString(),
    ...overrides,
  };
}

describe("wizard-upload-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashUploadBuffer is deterministic", () => {
    const buf = Buffer.from("test,data\n1,2");
    expect(hashUploadBuffer(buf)).toBe(hashUploadBuffer(buf));
    expect(hashUploadBuffer(buf)).not.toBe(hashUploadBuffer(Buffer.from("other")));
  });

  it("isWizardUploadSessionExpired respects expiresAt", () => {
    const payload = samplePayload({ expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect(isWizardUploadSessionExpired(payload)).toBe(false);
    expect(isWizardUploadSessionExpired(payload, Date.now() + 120_000)).toBe(true);
  });

  it("assertWizardUploadSessionOwnership rejects wrong client", () => {
    const payload = samplePayload();
    expect(() => assertWizardUploadSessionOwnership(payload, userId, "other-client")).toThrow(
      "Upload session does not belong to this client.",
    );
  });

  it("saveWizardUploadSession writes blob and returns uuid", async () => {
    const payload = samplePayload();
    const id = await saveWizardUploadSession({
      userId,
      clientId,
      platform: payload.platform,
      colMap: payload.colMap,
      rows: payload.rows,
      headers: payload.headers,
      fileHash: payload.fileHash,
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(saveWizardUploadSessionBlob).toHaveBeenCalledOnce();
    const [, , savedSessionId, json] = vi.mocked(saveWizardUploadSessionBlob).mock.calls[0];
    expect(savedSessionId).toBe(id);
    const parsed = JSON.parse(json) as WizardUploadSessionPayload;
    expect(parsed.userId).toBe(userId);
    expect(parsed.clientId).toBe(clientId);
    expect(parsed.version).toBe(WIZARD_UPLOAD_SESSION_VERSION);
  });

  it("loadWizardUploadSession returns payload when valid", async () => {
    const payload = samplePayload();
    vi.mocked(readWizardUploadSessionBlob).mockResolvedValue(JSON.stringify(payload));
    const loaded = await loadWizardUploadSession(userId, clientId, sessionId);
    expect(loaded).toEqual(payload);
  });

  it("loadWizardUploadSession deletes and returns null when expired", async () => {
    const payload = samplePayload({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    vi.mocked(readWizardUploadSessionBlob).mockResolvedValue(JSON.stringify(payload));
    const loaded = await loadWizardUploadSession(userId, clientId, sessionId);
    expect(loaded).toBeNull();
    expect(deleteWizardUploadSessionBlob).toHaveBeenCalledWith(userId, clientId, sessionId);
  });

  it("loadWizardUploadSession returns null for missing blob", async () => {
    vi.mocked(readWizardUploadSessionBlob).mockResolvedValue(null);
    expect(await loadWizardUploadSession(userId, clientId, sessionId)).toBeNull();
  });

  it("deleteWizardUploadSession delegates to storage", async () => {
    await deleteWizardUploadSession(userId, clientId, sessionId);
    expect(deleteWizardUploadSessionBlob).toHaveBeenCalledWith(userId, clientId, sessionId);
  });
});

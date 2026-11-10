import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ actor: "owner", owner: "owner", load: vi.fn(), save: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: async () => m.actor ? { user: { id: m.actor } } : null }));
vi.mock("@/lib/prisma", () => ({ prisma: { client: { findUnique: async () => ({ id: "client", userId: m.owner }) } } }));
vi.mock("@/lib/nre/wizard-server-draft", () => ({ loadWizardServerDraft: m.load, saveWizardServerDraft: m.save, clearWizardServerDraft: m.clear }));
import { GET, PUT, DELETE } from "../clients/[id]/wizard-draft/route";
const params = { params: Promise.resolve({ id: "client" }) };
beforeEach(() => { vi.clearAllMocks(); m.actor = "owner"; m.owner = "owner"; });
describe("unfinished report setup retirement", () => {
  it("returns no resumable setup without reading stored drafts", async () => {
    const response = await GET(new Request("https://example.test/draft"), params);
    expect(await response.json()).toEqual({ ok: true, draft: null });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(m.load).not.toHaveBeenCalled();
  });
  it("rejects draft saves from old tabs without writing storage", async () => {
    const response = await PUT(new Request("https://example.test/draft", { method: "PUT", body: JSON.stringify({ draft: { version: 1, step: 3 } }) }), params);
    expect(response.status).toBe(410); expect(m.save).not.toHaveBeenCalled();
  });
  it("retains authenticated cleanup of legacy drafts", async () => {
    expect((await DELETE(new Request("https://example.test/draft", { method: "DELETE" }), params)).status).toBe(200);
    expect(m.clear).toHaveBeenCalledWith("owner", "client");
  });
  it.each([GET, PUT, DELETE])("keeps retired endpoints private", async method => {
    m.actor = "";
    expect((await method(new Request("https://example.test/draft"), params)).status).toBe(401);
    m.actor = "owner"; m.owner = "other";
    expect((await method(new Request("https://example.test/draft"), params)).status).toBe(404);
    expect(m.load).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled(); expect(m.clear).not.toHaveBeenCalled();
  });
});

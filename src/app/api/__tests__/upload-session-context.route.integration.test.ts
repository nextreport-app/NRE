import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsvText } from "@/lib/nre/parse-csv";
const state = vi.hoisted(() => ({ payload: null as unknown, userId: "owner", clientOwner: "owner", load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: async () => state.userId ? { user: { id: state.userId } } : null }));
vi.mock("@/lib/subscription-guard", () => ({ requireActiveSubscription: async () => null }));
vi.mock("@/lib/usage-rate-limit", () => ({ enforceWizardLimits: async () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: { client: { findUnique: async () => ({ userId: state.clientOwner, timezone: "UTC" }) } } }));
vi.mock("@/lib/nre/wizard-upload-session", () => ({ loadWizardUploadSession: (...args: unknown[]) => { state.load(...args); return state.payload; } }));
import { POST } from "../clients/[id]/reports/upload-session-context/route";
const sessionId = "b3ca019b-9647-44c1-a33f-7a4cbe3c512d";
const request = () => POST(new Request("https://example.test/context", { method: "POST", body: JSON.stringify({ uploadSessionId: sessionId }), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "client" }) });

beforeEach(() => {
  state.userId = "owner"; state.clientOwner = "owner"; state.load.mockClear();
  const parsed = parseCsvText("Campaign name,Ad set name,Day,Amount spent (USD),Results,Reach,Impressions\nTraffic,Set A,2026-11-01,100,10,100,200\nTraffic,Set B,2026-11-02,25,3,50,60\nReach,Set R,2026-11-02,220,1000,1000,1200\nInactive,Old set,2026-11-02,0,0,0,0");
  state.payload = { ...parsed, platform: "META" };
});
describe("saved upload context recovery", () => {
  it("reconstructs actual spend, all campaigns, and spending ad sets from the uploaded rows", async () => {
    const response = await request(); const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.campaignSpend).toEqual({ Traffic: 125, Reach: 220, Inactive: 0 });
    expect(result.campaigns).toEqual(["Reach", "Traffic", "Inactive"]);
    expect(result.lowSpendCampaigns).toEqual(["Inactive"]);
    expect(result.adSetGroups).toEqual([{ campaignName: "Traffic", adSetNames: ["Set A", "Set B"] }, { campaignName: "Reach", adSetNames: ["Set R"] }]);
    expect(result.metaCsvExportProfile.kind).toBe("ads_reporting");
    expect(result.headers).toContain("Amount spent (USD)");
    expect(result.dateBounds).toEqual({ minIso: "2026-11-01", maxIso: "2026-11-02" });
    expect(state.load).toHaveBeenCalledWith("owner", "client", sessionId);
  });
  it("returns an expired state instead of fabricated empty facts when the upload is unavailable", async () => {
    state.payload = null;
    const result = await (await request()).json();
    expect(result).toMatchObject({ ok: false, uploadSessionExpired: true });
    expect(result.campaignSpend).toBeUndefined();
  });
  it.each(["anonymous", "other owner"])("does not read saved CSVs for %s", async mode => {
    if (mode === "anonymous") state.userId = ""; else state.clientOwner = "someone-else";
    expect((await request()).status).toBe(mode === "anonymous" ? 401 : 404);
    expect(state.load).not.toHaveBeenCalled();
  });
});

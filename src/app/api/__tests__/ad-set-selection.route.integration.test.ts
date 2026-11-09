import { beforeEach, describe, expect, it, vi } from "vitest";
import { adSetKey } from "@/lib/nre/ad-sets";
import { buildAdSetSlidePreferences, resolveDefaultSelectedAdSets } from "@/lib/nre/ad-set-slide-preferences";
const m = vi.hoisted(() => ({ owner: "owner", actor: "owner", memory: null as string | null, update: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: async () => m.actor ? { user: { id: m.actor } } : null }));
vi.mock("@/lib/subscription-guard", () => ({ requireActiveSubscription: async () => null }));
vi.mock("@/lib/usage-rate-limit", () => ({ enforceWizardLimits: async () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: { client: { findUnique: async () => ({ id: "client", userId: m.owner, lastDeselectedAdSets: m.memory }), update: m.update } } }));
vi.mock("@/lib/nre/wizard-upload-session", () => ({ loadWizardUploadSession: m.load }));
import { POST } from "../clients/[id]/reports/selection/route";
const id = "b3ca019b-9647-44c1-a33f-7a4cbe3c512d";
const groups = [{ campaignName: "Traffic", adSetNames: ["A", "B"] }, { campaignName: "Leads", adSetNames: ["Single"] }];
const payload = { rows: groups.flatMap(group => group.adSetNames.map(ad_set_name => ({ campaign_name: group.campaignName, ad_set_name, spend: "10", _raw: {} }))) };
const request = (body: unknown) => POST(new Request("https://example.test/selection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: "client" }) });
beforeEach(() => { vi.clearAllMocks(); m.owner = "owner"; m.actor = "owner"; m.memory = null; m.load.mockResolvedValue(payload); });
describe("client ad-set slide preferences", () => {
  it("derives known ad sets from the authenticated upload and saves explicit opt-ins", async () => {
    const selected = [adSetKey("Traffic", "B"), adSetKey("Leads", "Single"), adSetKey("Other", "Forged")];
    expect((await request({ uploadSessionId: id, selectedAdSets: selected })).status).toBe(200);
    const saved = m.update.mock.calls[0][0].data.lastDeselectedAdSets;
    expect(resolveDefaultSelectedAdSets(groups, saved)).toEqual(selected.slice(0, 2));
    expect(m.load).toHaveBeenCalledWith("owner", "client", id);
  });
  it("persists all-unchecked choices rather than treating an empty array as missing", async () => {
    m.memory = JSON.stringify(buildAdSetSlidePreferences(groups, [adSetKey("Traffic", "A")]));
    expect((await request({ uploadSessionId: id, selectedAdSets: [] })).status).toBe(200);
    expect(resolveDefaultSelectedAdSets(groups, m.update.mock.calls[0][0].data.lastDeselectedAdSets)).toEqual([]);
  });
  it("preserves ad-set memory on older campaign-only requests", async () => {
    expect((await request({ campaigns: ["Traffic"], selectedCampaigns: ["Traffic"] })).status).toBe(200);
    expect(m.update.mock.calls[0][0].data.lastDeselectedAdSets).toBeUndefined(); expect(m.load).not.toHaveBeenCalled();
  });
  it("requires the upload context for new ad-set memory", async () => {
    expect((await request({ selectedAdSets: [] })).status).toBe(400); expect(m.update).not.toHaveBeenCalled();
  });
  it("does not save invented inventory when the upload expires", async () => {
    m.load.mockResolvedValue(null);
    expect((await request({ uploadSessionId: id, selectedAdSets: [] })).status).toBe(410); expect(m.update).not.toHaveBeenCalled();
  });
  it.each(["anonymous", "other owner"])("protects preferences from %s", async mode => {
    if (mode === "anonymous") m.actor = ""; else m.owner = "another";
    expect((await request({ uploadSessionId: id, selectedAdSets: [] })).status).toBe(mode === "anonymous" ? 401 : 404);
    expect(m.load).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import Papa from "papaparse";
const state = vi.hoisted(() => ({
  user: "owner",
  clientOwner: "owner",
  source: null as unknown,
  load: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  auth: async () => (state.user ? { user: { id: state.user } } : null),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: async () => ({ userId: state.clientOwner }) },
  },
}));
vi.mock("@/lib/nre/wizard-upload-session", () => ({
  loadWizardUploadSession: (...args: unknown[]) => {
    state.load(...args);
    return state.source;
  },
}));
import { GET } from "../clients/[id]/reports/source/route";
const id = "b3ca019b-9647-44c1-a33f-7a4cbe3c512d";
const request = (query = `uploadSessionId=${id}`) =>
  GET(new Request(`https://example.test/source?${query}`), {
    params: Promise.resolve({ id: "client" }),
  });
beforeEach(() => {
  state.user = "owner";
  state.clientOwner = "owner";
  state.load.mockClear();
  state.source = {
    userId: "owner",
    clientId: "client",
    platform: "META",
    createdAt: "2026-11-20T10:00:00Z",
    expiresAt: "2026-11-21T10:00:00Z",
    fileHash: "original-hash",
    headers: ["Campaign name", "Day", "Amount spent (USD)", "Results"],
    rows: [
      {
        _raw: {
          "Campaign name": 'Café, "Forms"\nA',
          Day: "2026-11-19",
          "Amount spent (USD)": "45.60",
          Results: "7",
        },
      },
    ],
    metaAdAccountId: "act_123",
    metaCampaignPeriodReach: {
      byRangeKey: { "2026-11-13:2026-11-19": { forms: 6226 } },
    },
    accessToken: "NEVER-EXPORT",
  };
});
describe("owner-only imported source export", () => {
  it("round-trips source values including names, quotes and newlines without recomputing metrics", async () => {
    const result = await request();
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toContain("text/csv");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const rows = Papa.parse<Record<string, string>>(await result.text(), {
      header: true,
      skipEmptyLines: true,
    }).data;
    expect(rows).toEqual([
      {
        "Campaign name": 'Café, "Forms"\nA',
        Day: "2026-11-19",
        "Amount spent (USD)": "45.60",
        Results: "7",
      },
    ]);
    expect(state.load).toHaveBeenCalledWith("owner", "client", id);
  });
  it("exports only whitelisted sync metadata and period reach, never tokens or raw payload fields", async () => {
    const result = await request(`uploadSessionId=${id}&format=details`);
    const body = await result.text();
    expect(body).not.toContain("NEVER-EXPORT");
    expect(body).not.toContain('"rows"');
    const data = JSON.parse(body);
    expect(data.rowCount).toBe(1);
    expect(data.metaAdAccountId).toBe("act_123");
    expect(
      data.campaignPeriodReachAtImport.byRangeKey["2026-11-13:2026-11-19"]
        .forms,
    ).toBe(6226);
  });
  it.each(["anonymous", "other owner"])(
    "does not read storage for %s",
    async (mode) => {
      if (mode === "anonymous") state.user = "";
      else state.clientOwner = "someone-else";
      expect((await request()).status).toBe(mode === "anonymous" ? 401 : 404);
      expect(state.load).not.toHaveBeenCalled();
    },
  );
  it("rejects a source payload belonging to a different client", async () => {
    (state.source as { clientId: string }).clientId = "other";
    const result = await request();
    expect(result.status).toBe(404);
    expect(await result.text()).not.toContain("45.60");
  });
  it.each(["uploadSessionId=invalid", `uploadSessionId=${id}&format=html`])(
    "validates %s before loading input",
    async (query) => {
      expect((await request(query)).status).toBe(400);
      expect(state.load).not.toHaveBeenCalled();
    },
  );
  it("returns an actionable expiry error rather than generating a fresh source from Meta", async () => {
    state.source = null;
    const result = await request();
    expect(result.status).toBe(410);
    expect((await result.json()).error).toContain("sync again");
  });
  it("streams every row across multiple batches without repeating the header", async () => {
    const source = state.source as { rows: unknown[] };
    source.rows = Array.from({ length: 251 }, (_, i) => ({
      _raw: {
        "Campaign name": `Campaign ${i}`,
        Day: "2026-11-19",
        "Amount spent (USD)": "1.00",
        Results: String(i),
      },
    }));
    const rows = Papa.parse<Record<string, string>>(
      await (await request()).text(),
      { header: true, skipEmptyLines: true },
    ).data;
    expect(rows).toHaveLength(251);
    expect(rows[250].Results).toBe("250");
  });
});

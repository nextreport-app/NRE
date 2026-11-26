import { afterEach, describe, expect, it, vi } from "vitest";
import { openMetaDashboard } from "../dashboard-entry";
const client = (id: string, days: number, customStart = "") => ({
  id,
  linked: true,
  comparison: { days, customStart, customEnd: customStart ? "2026-11-15" : "" },
});
afterEach(() => vi.unstubAllGlobals());
describe("Meta dashboard opening range", () => {
  it.each([
    client("selected", 7),
    client("selected", 15),
    client("selected", 30, "2026-11-01"),
    { ...client("selected", 7), linked: false },
  ])("opens saved settings on 30 days (%j)", async (saved) => {
    let clients = [saved, client("other", 7)];
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          action: "comparison",
          days: 30,
        });
        clients = [client("selected", 30), clients[1]];
        return Response.json({ ok: true });
      }
      return Response.json({ clients });
    });
    vi.stubGlobal("fetch", fetcher);
    const rows = await openMetaDashboard("selected");
    expect(rows.map((c) => c.comparison.days)).toEqual([30, 7]);
    expect(
      fetcher.mock.calls
        .filter(([, init]) => init?.method === "POST")
        .map(([url]) => url),
    ).toEqual(["/api/clients/selected/performance-monitor"]);
  });
  it.each(["", "missing", "ready"])(
    "does not write on the portfolio, missing client or ready 30-day settings (%s)",
    async (id) => {
      const fetcher = vi.fn(async () =>
        Response.json({ clients: [client("ready", 30)] }),
      );
      vi.stubGlobal("fetch", fetcher);
      await openMetaDashboard(id);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("surfaces a failed reset rather than labeling old data as 30 days", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ clients: [client("selected", 7)] }),
        )
        .mockResolvedValueOnce(
          Response.json({ error: "Unable to save" }, { status: 503 }),
        ),
    );
    await expect(openMetaDashboard("selected")).rejects.toThrow(
      "Unable to save",
    );
  });
});

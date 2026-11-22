import { afterEach, it, expect, vi } from "vitest";
import { fetchMetaCampaignValueInsights } from "../../meta-api";
afterEach(() => vi.unstubAllGlobals());
it("fetches campaign period values with matching attribution and bounded pagination", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              campaign_id: "1",
              date_start: "2026-11-13",
              date_stop: "2026-11-19",
              spend: "100",
            },
          ],
          paging: { next: "https://graph.facebook.com/v26.0/next" },
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
  vi.stubGlobal("fetch", fetch);
  const rows = await fetchMetaCampaignValueInsights({
    accessToken: "test",
    adAccountId: "123",
    sinceIso: "2026-11-13",
    untilIso: "2026-11-19",
  });
  expect(rows).toHaveLength(1);
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.pathname).toContain("act_123/insights");
  expect(url.searchParams.get("level")).toBe("campaign");
  expect(url.searchParams.get("time_increment")).toBe("all_days");
  expect(url.searchParams.get("use_unified_attribution_setting")).toBe("true");
  expect(url.searchParams.get("action_report_time")).toBe("impression");
  expect(url.searchParams.get("fields")).toContain("action_values");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("rejects mismatched period values", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              campaign_id: "1",
              date_start: "2026-11-12",
              date_stop: "2026-11-19",
              spend: "100",
            },
          ],
        }),
      ),
    ),
  );
  await expect(
    fetchMetaCampaignValueInsights({
      accessToken: "test",
      adAccountId: "123",
      sinceIso: "2026-11-13",
      untilIso: "2026-11-19",
    }),
  ).rejects.toThrow("requested dates");
});

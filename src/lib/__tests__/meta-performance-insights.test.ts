import { afterEach, expect, it, vi } from "vitest";
import { fetchMetaPerformancePeriodInsights } from "../meta-api";
const params = {
  accessToken: "fixture-token",
  adAccountId: "123",
  sinceIso: "2026-11-13",
  untilIso: "2026-11-19",
  level: "campaign" as const,
};
afterEach(() => vi.unstubAllGlobals());
it("reads full-period campaign metrics with unified attribution and safe pagination", async () => {
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (raw: string, init: RequestInit) => {
      const url = new URL(raw);
      urls.push(url);
      expect(init.method).toBe("GET");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer fixture-token",
      );
      expect(url.searchParams.has("access_token")).toBe(false);
      return new Response(
        JSON.stringify(
          url.searchParams.has("after")
            ? {
                data: [
                  {
                    campaign_id: "456",
                    date_start: params.sinceIso,
                    date_stop: params.untilIso,
                    reach: "900",
                  },
                ],
              }
            : { data: [], paging: { next: raw + "&after=next" } },
        ),
      );
    }),
  );
  const result = await fetchMetaPerformancePeriodInsights(params);
  expect(result[0].reach).toBe("900");
  expect(urls).toHaveLength(2);
  expect(urls[0].searchParams.get("time_increment")).toBe("all_days");
  expect(urls[0].searchParams.get("action_report_time")).toBe("impression");
  expect(urls[0].searchParams.get("use_unified_attribution_setting")).toBe(
    "true",
  );
  expect(urls[0].searchParams.get("fields")).toContain("inline_link_clicks");
});
it("fetches unique account totals without a campaign breakdown", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: [] })));
  vi.stubGlobal("fetch", fetch);
  await fetchMetaPerformancePeriodInsights({ ...params, level: "account" });
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.searchParams.get("level")).toBe("account");
  expect(url.searchParams.get("fields")).not.toContain("campaign_id");
});
it("rejects mismatched dates and untrusted pagination", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ date_start: "2026-11-12", date_stop: params.untilIso }],
          }),
        ),
      ),
  );
  await expect(fetchMetaPerformancePeriodInsights(params)).rejects.toThrow(
    "requested dates",
  );
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          paging: { next: "https://untrusted.test/page" },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(fetchMetaPerformancePeriodInsights(params)).rejects.toThrow(
    "Invalid Meta pagination",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

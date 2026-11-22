import { afterEach, it, expect, vi } from "vitest";
import { fetchGa4PropertyMetadata, runGa4Report } from "../../ga4-api";
afterEach(() => vi.unstubAllGlobals());
it("validates numeric properties before constructing an Admin API request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    fetchGa4PropertyMetadata("secret", "properties/123/other"),
  ).rejects.toThrow("Invalid");
  expect(fetch).not.toHaveBeenCalled();
});
it("reads the real property timezone and keeps the access token in the authorization header", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "properties/552954256",
          displayName: "NextReport",
          timeZone: "Asia/Kolkata",
          currencyCode: "INR",
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await fetchGa4PropertyMetadata("secret", "552954256")).toEqual({
    propertyId: "552954256",
    displayName: "NextReport",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });
  expect(fetch.mock.calls[0][0]).not.toContain("secret");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
});
it("rejects wrong property metadata and missing timezone", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            name: "properties/other",
            timeZone: "Asia/Kolkata",
            currencyCode: "INR",
          }),
        ),
      ),
  );
  await expect(fetchGa4PropertyMetadata("secret", "552954256")).rejects.toThrow(
    "incomplete",
  );
});
it("passes pagination offsets and modern key-event metrics to Data API", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ rows: [] })));
  vi.stubGlobal("fetch", fetch);
  const body = {
    dateRanges: [{ startDate: "2026-11-13", endDate: "2026-11-19" }],
    metrics: [{ name: "keyEvents" }, { name: "sessionKeyEventRate" }],
    offset: 100,
    limit: 100,
  };
  await runGa4Report("secret", "552954256", body);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});

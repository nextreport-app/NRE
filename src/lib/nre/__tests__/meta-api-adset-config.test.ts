import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMetaAdSetReportingConfigs } from "@/lib/meta-api";
afterEach(() => vi.unstubAllGlobals());
describe("read-only ad set conversion settings", () => {
 it("reads only imported IDs and keeps bearer credentials out of the request URL", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ "1": { id: "1", promoted_object: { pixel_id: "10", custom_event_type: "LEAD" } } })));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchMetaAdSetReportingConfigs("fixture-token", ["1", "1"])).toHaveLength(1);
  const [rawUrl, options] = fetch.mock.calls[0];
  const url = new URL(rawUrl);
  expect(url.hostname).toBe("graph.facebook.com"); expect(url.searchParams.get("ids")).toBe("1");
  expect(url.searchParams.get("fields")).toBe("id,optimization_goal,promoted_object");
  expect(url.searchParams.has("access_token")).toBe(false); expect(options.method).toBe("GET"); expect(options.cache).toBe("no-store");
 });
 it("does not accept an incomplete configuration response and guess conversion events", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}))));
  await expect(fetchMetaAdSetReportingConfigs("fixture-token", ["1"])).rejects.toThrow(/every imported ad set/);
 });
});

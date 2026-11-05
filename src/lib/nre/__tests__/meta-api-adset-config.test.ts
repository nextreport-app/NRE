import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMetaAdSetReportingConfigs } from "@/lib/meta-api";
import { ServiceError } from "@/lib/service-error";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const config = (id: string) => ({ id, optimization_goal: "OFFSITE_CONVERSIONS", promoted_object: { pixel_id: "10", custom_event_type: "LEAD" } });
const failed = (code: number, status = 400) => new Response(JSON.stringify({ error: { code, message: "access_token=do-not-show-this" } }), { status });
describe("read-only ad set conversion settings", () => {
 it("reads supported AdSet node URLs directly and keeps credentials out of URLs", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(config("1"))));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchMetaAdSetReportingConfigs("fixture-token", ["1", "1"])).toEqual([config("1")]);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [rawUrl, options] = fetch.mock.calls[0];
  const url = new URL(rawUrl);
  expect(url.hostname).toBe("graph.facebook.com"); expect(url.pathname).toMatch(/\/v\d+\.\d+\/1$/);
  expect(url.searchParams.has("ids")).toBe(false);
  expect(url.searchParams.get("fields")).toBe("id,optimization_goal,promoted_object");
  expect(url.searchParams.has("access_token")).toBe(false); expect(options.method).toBe("GET"); expect(options.cache).toBe("no-store");
 });
 it("reads every requested object with at most four concurrent requests", async () => {
  let active = 0, peak = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
   active++; peak = Math.max(peak, active);
   await Promise.resolve();
   const id = new URL(url).pathname.split("/").at(-1)!;
   active--; return new Response(JSON.stringify(config(id)));
  }));
  const ids = Array.from({ length: 9 }, (_, i) => String(i + 1));
  expect((await fetchMetaAdSetReportingConfigs("fixture-token", ids)).map(row => row.id)).toEqual(ids);
  expect(peak).toBeLessThanOrEqual(4);
 });
 it("rejects incomplete or mismatched object responses without guessing", async () => {
  for (const body of [{}, { id: "1" }, config("2")]) {
   vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
   await expect(fetchMetaAdSetReportingConfigs("fixture-token", ["1"])).rejects.toThrow(/incomplete/);
  }
 });
 it("retries temporary provider errors without asking for a new connection", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(failed(2, 503)).mockResolvedValueOnce(new Response(JSON.stringify(config("1"))));
  vi.stubGlobal("fetch", fetch);
  const result = fetchMetaAdSetReportingConfigs("fixture-token", ["1"]);
  await vi.runAllTimersAsync();
  expect(await result).toEqual([config("1")]); expect(fetch).toHaveBeenCalledTimes(2);
 });
 it.each([[190, 401, "Reconnect"], [10, 403, "reporting access"], [100, 422, "deleted or unavailable"]])("classifies Meta code %s without disclosing provider messages", async (code, status, message) => {
  const fetch = vi.fn().mockResolvedValue(failed(code)); vi.stubGlobal("fetch", fetch);
  const error = await fetchMetaAdSetReportingConfigs("fixture-token", ["1"]).catch(error => error);
  expect(error).toBeInstanceOf(ServiceError); expect(error.status).toBe(status);
  expect(error.message).toContain(String(code)); expect(error.message).toContain(message);
  expect(error.message).not.toContain("do-not-show-this"); expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("returns a useful rate-limit response after bounded retries", async () => {
  vi.useFakeTimers(); const fetch = vi.fn().mockImplementation(() => Promise.resolve(failed(4))); vi.stubGlobal("fetch", fetch);
  const result = fetchMetaAdSetReportingConfigs("fixture-token", ["1"]).catch(error => error);
  await vi.runAllTimersAsync();
  const error = await result;
  expect(error.status).toBe(429); expect(error.retryAfter).toBe(30); expect(error.message).toContain("reconnecting is not required"); expect(fetch).toHaveBeenCalledTimes(3);
 });
});

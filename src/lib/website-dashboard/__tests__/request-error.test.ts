import { afterEach, expect, it, vi } from "vitest";
import { ga4RequestError } from "../../ga4-request-error";
import { runGa4Report } from "../../ga4-api";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it.each([
  ["report", 403, { error: { details: [{ reason: "SERVICE_DISABLED" }] } }, "Data API is disabled", "API_DISABLED"],
  ["property", 403, { error: { details: [{ reason: "SERVICE_DISABLED" }] } }, "Admin API is disabled", "API_DISABLED"],
  ["authorization", 400, { error: "invalid_grant" }, "Reconnect", "RECONNECT"],
  ["authorization", 401, { error: "invalid_client" }, "configuration needs attention", "OAUTH_CONFIGURATION"],
  ["report", 403, {}, "Viewer access", "ACCESS_DENIED"],
  ["report", 400, {}, "dashboard query", "QUERY_REJECTED"],
  ["report", 429, {}, "limited requests", "QUOTA"],
  ["property", 404, {}, "property could not be accessed", "PROPERTY_UNAVAILABLE"],
  ["report", 503, {}, "temporarily unavailable", "PROVIDER_UNAVAILABLE"],
] as const)("classifies %s HTTP %s without disclosing the provider body", async (stage, status, body, message, code) => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = await ga4RequestError(new Response(JSON.stringify({ ...body, error_description: "private-token-or-provider-url" }), { status }), stage);
  expect(error.message).toContain(message);
  expect(error.message).toContain(code);
  expect(error.message).not.toContain("private-token");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private-token");
});
it("preserves a safe diagnostic through the real report wrapper", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { details: [{ reason: "SERVICE_DISABLED" }], message: "private internal URL" } }), { status: 403 })));
  await expect(runGa4Report("token", "123", { dateRanges: [{ startDate: "2026-11-01", endDate: "2026-11-07" }], metrics: [{ name: "sessions" }] })).rejects.toThrow("GA4_REPORT_API_DISABLED_403");
});
it("handles a non-JSON proxy failure without reflecting HTML", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = await ga4RequestError(new Response("<html>private</html>", { status: 502 }), "report");
  expect(error.message).toContain("PROVIDER_UNAVAILABLE");
  expect(error.message).not.toContain("<html>");
});

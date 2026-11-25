import { afterEach, expect, it, vi } from "vitest";
import {
  AI_TOTAL_BUDGET_MS,
  AI_UNAVAILABLE_TEXT,
  callAI,
  callAnthropic,
} from "../client";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function neverUntilAborted(_url: unknown, init?: RequestInit) {
  return new Promise((_resolve, reject) =>
    init?.signal?.addEventListener(
      "abort",
      () => reject(new DOMException("Timed out", "AbortError")),
      { once: true },
    ),
  );
}
it("stops stalled providers within one shared budget instead of waiting indefinitely", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(neverUntilAborted);
  vi.stubGlobal("fetch", fetch);
  const pending = callAI("choose an action", {
    anthropicApiKey: "a",
    groqApiKey: "b",
    geminiApiKey: "c",
  });
  await vi.advanceTimersByTimeAsync(8000);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(AI_TOTAL_BUDGET_MS - 8000);
  expect(await pending).toBe(AI_UNAVAILABLE_TEXT);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps provider fallback working when the primary stalls but a fallback responds", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockImplementationOnce(neverUntilAborted)
    .mockResolvedValueOnce({
      json: async () => ({
        choices: [{ message: { content: '{"action":"compare_periods"}' } }],
      }),
    });
  vi.stubGlobal("fetch", fetch);
  const pending = callAI("choose an action", {
    anthropicApiKey: "a",
    groqApiKey: "b",
  });
  await vi.advanceTimersByTimeAsync(8000);
  expect(await pending).toBe('{"action":"compare_periods"}');
  expect(vi.getTimerCount()).toBe(0);
});
it("applies the deadline while the provider response body is stalled too", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => ({
      json: () => neverUntilAborted(_url, init),
    })),
  );
  const pending = expect(callAnthropic("prompt", "key", 50)).rejects.toThrow(
    "Timed out",
  );
  await vi.advanceTimersByTimeAsync(50);
  await pending;
  expect(vi.getTimerCount()).toBe(0);
});

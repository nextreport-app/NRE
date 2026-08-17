import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_UNAVAILABLE_TEXT, aiKeysFromEnv, callAI, callAnthropic, callGemini } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callAnthropic", () => {
  it("returns the trimmed message text on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ content: [{ type: "text", text: "  Hello from Claude  " }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAnthropic("prompt", "key");
    expect(result).toBe("Hello from Claude");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "key", "anthropic-version": "2023-06-01" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.messages).toEqual([{ role: "user", content: "prompt" }]);
  });

  it("throws when the API returns an error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "bad key" } }) }),
    );
    await expect(callAnthropic("prompt", "bad")).rejects.toThrow("bad key");
  });
});

describe("callGemini", () => {
  it("returns the trimmed candidate text on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ candidates: [{ content: { parts: [{ text: " Hello from Gemini " }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGemini("prompt", "key");
    expect(result).toBe("Hello from Gemini");
    expect(fetchMock.mock.calls[0][0]).toContain("gemini-2.5-flash:generateContent?key=key");
  });
});

describe("callAI", () => {
  it("tries Anthropic first and returns its result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ content: [{ type: "text", text: "claude result" }] }) }),
    );
    const result = await callAI("prompt", { anthropicApiKey: "a", geminiApiKey: "gm" });
    expect(result).toBe("claude result");
  });

  it("falls back to Gemini when Anthropic fails", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        call++;
        if (call === 1) return { json: async () => ({ error: { message: "anthropic down" } }) };
        return { json: async () => ({ candidates: [{ content: { parts: [{ text: "gemini result" }] } }] }) };
      }),
    );
    const result = await callAI("prompt", { anthropicApiKey: "a", geminiApiKey: "gm" });
    expect(result).toBe("gemini result");
  });

  it("returns the placeholder when no keys are configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await callAI("prompt", {});
    expect(result).toBe(AI_UNAVAILABLE_TEXT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the placeholder when both providers fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "down" } }) }));
    const result = await callAI("prompt", { anthropicApiKey: "a", geminiApiKey: "gm" });
    expect(result).toBe(AI_UNAVAILABLE_TEXT);
  });
});

describe("aiKeysFromEnv", () => {
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  const originalGemini = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
  });

  it("reads both keys from the platform env vars, not per-client config", () => {
    process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
    process.env.GEMINI_API_KEY = "env-gemini-key";
    expect(aiKeysFromEnv()).toEqual({ anthropicApiKey: "env-anthropic-key", geminiApiKey: "env-gemini-key" });
  });

  it("returns null (not undefined/empty-string) for whichever key isn't set", () => {
    process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
    expect(aiKeysFromEnv()).toEqual({ anthropicApiKey: "env-anthropic-key", geminiApiKey: null });
  });

  it("returns both null when neither env var is configured", () => {
    expect(aiKeysFromEnv()).toEqual({ anthropicApiKey: null, geminiApiKey: null });
  });
});

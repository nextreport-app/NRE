import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_UNAVAILABLE_TEXT, aiKeysFromEnv, callAI, callGemini, callGroq } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callGroq", () => {
  it("returns the trimmed message content on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ choices: [{ message: { content: "  Hello from Groq  " } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGroq("prompt", "key");
    expect(result).toBe("Hello from Groq");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.max_tokens).toBe(800);
    expect(body.temperature).toBe(0.4);
  });

  it("throws when the API returns an error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "bad key" } }) }),
    );
    await expect(callGroq("prompt", "bad")).rejects.toThrow("bad key");
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
  it("tries Groq first and returns its result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ choices: [{ message: { content: "groq result" } }] }) }),
    );
    const result = await callAI("prompt", { groqApiKey: "g", geminiApiKey: "gm" });
    expect(result).toBe("groq result");
  });

  it("falls back to Gemini when Groq fails", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        call++;
        if (call === 1) return { json: async () => ({ error: { message: "groq down" } }) };
        return { json: async () => ({ candidates: [{ content: { parts: [{ text: "gemini result" }] } }] }) };
      }),
    );
    const result = await callAI("prompt", { groqApiKey: "g", geminiApiKey: "gm" });
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
    const result = await callAI("prompt", { groqApiKey: "g", geminiApiKey: "gm" });
    expect(result).toBe(AI_UNAVAILABLE_TEXT);
  });
});

describe("aiKeysFromEnv", () => {
  const originalGroq = process.env.GROQ_API_KEY;
  const originalGemini = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroq;
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
  });

  it("reads both keys from the platform env vars, not per-client config", () => {
    process.env.GROQ_API_KEY = "env-groq-key";
    process.env.GEMINI_API_KEY = "env-gemini-key";
    expect(aiKeysFromEnv()).toEqual({ groqApiKey: "env-groq-key", geminiApiKey: "env-gemini-key" });
  });

  it("returns null (not undefined/empty-string) for whichever key isn't set", () => {
    process.env.GROQ_API_KEY = "env-groq-key";
    expect(aiKeysFromEnv()).toEqual({ groqApiKey: "env-groq-key", geminiApiKey: null });
  });

  it("returns both null when neither env var is configured", () => {
    expect(aiKeysFromEnv()).toEqual({ groqApiKey: null, geminiApiKey: null });
  });
});

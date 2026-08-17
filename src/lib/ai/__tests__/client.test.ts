import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_UNAVAILABLE_TEXT, aiKeysFromEnv, callAI, callAnthropic, callGemini, callGroq } from "../client";

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

describe("callGroq", () => {
  it("returns the trimmed message text on success", async () => {
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
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.messages).toEqual([{ role: "user", content: "prompt" }]);
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
  it("tries Anthropic first and returns its result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ content: [{ type: "text", text: "claude result" }] }) }),
    );
    const result = await callAI("prompt", { anthropicApiKey: "a", groqApiKey: "g", geminiApiKey: "gm" });
    expect(result).toBe("claude result");
  });

  it("falls back to Groq when Anthropic fails", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        call++;
        if (call === 1) return { json: async () => ({ error: { message: "anthropic down" } }) };
        return { json: async () => ({ choices: [{ message: { content: "groq result" } }] }) };
      }),
    );
    const result = await callAI("prompt", { anthropicApiKey: "a", groqApiKey: "g", geminiApiKey: "gm" });
    expect(result).toBe("groq result");
  });

  it("falls back to Gemini when both Anthropic and Groq fail", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        call++;
        if (call <= 2) return { json: async () => ({ error: { message: "down" } }) };
        return { json: async () => ({ candidates: [{ content: { parts: [{ text: "gemini result" }] } }] }) };
      }),
    );
    const result = await callAI("prompt", { anthropicApiKey: "a", groqApiKey: "g", geminiApiKey: "gm" });
    expect(result).toBe("gemini result");
  });

  it("skips missing keys and falls through to the next configured provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ candidates: [{ content: { parts: [{ text: "gemini result" }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await callAI("prompt", { geminiApiKey: "gm" });
    expect(result).toBe("gemini result");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the placeholder when no keys are configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await callAI("prompt", {});
    expect(result).toBe(AI_UNAVAILABLE_TEXT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the placeholder when all three providers fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ error: { message: "down" } }) }));
    const result = await callAI("prompt", { anthropicApiKey: "a", groqApiKey: "g", geminiApiKey: "gm" });
    expect(result).toBe(AI_UNAVAILABLE_TEXT);
  });
});

describe("aiKeysFromEnv", () => {
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  const originalGroq = process.env.GROQ_API_KEY;
  const originalGemini = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
    if (originalGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroq;
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
  });

  it("reads all three keys from the platform env vars, not per-client config", () => {
    process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
    process.env.GROQ_API_KEY = "env-groq-key";
    process.env.GEMINI_API_KEY = "env-gemini-key";
    expect(aiKeysFromEnv()).toEqual({
      anthropicApiKey: "env-anthropic-key",
      groqApiKey: "env-groq-key",
      geminiApiKey: "env-gemini-key",
    });
  });

  it("returns null (not undefined/empty-string) for whichever key isn't set", () => {
    process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
    expect(aiKeysFromEnv()).toEqual({ anthropicApiKey: "env-anthropic-key", groqApiKey: null, geminiApiKey: null });
  });

  it("returns all null when none of the env vars are configured", () => {
    expect(aiKeysFromEnv()).toEqual({ anthropicApiKey: null, groqApiKey: null, geminiApiKey: null });
  });
});

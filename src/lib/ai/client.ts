/**
 * AI provider calls — port of callAI_/callGemini_ from meta_ads_report_v4.js.
 * Anthropic Claude is primary, Groq is the first fallback, Gemini is the
 * second fallback, and if all three fail (or no keys are configured) the
 * same placeholder string ships in the generated slide, exactly as the
 * source does.
 */

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
// Groq deprecated both this codebase's original model (llama-3.3-70b-versatile,
// retired June 2026) and the maverick model, retired March 2026); openai/gpt-oss-120b
// is Groq's current recommended flagship replacement on the same chat-completions API.
const GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_MODEL = "gemini-2.5-flash";
export const AI_UNAVAILABLE_TEXT = "[AI unavailable — check API keys]";

// Commentary chooses among fact-checked actions; stalled providers must not hold a report indefinitely.
export const AI_PROVIDER_TIMEOUT_MS = 8_000;
export const AI_TOTAL_BUDGET_MS = 12_000;
async function withProviderDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function callAnthropic(
  prompt: string,
  apiKey: string,
  timeoutMs = AI_PROVIDER_TIMEOUT_MS,
): Promise<string> {
  return withProviderDeadline(async (signal) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        // Generous headroom, not a tight budget — the old Groq call's own
        // history here (500 -> 800 tokens) documents a truncation bug that
        // turned out to be capSummary/capInsights re-truncating a complete
        // response, not this limit, but there's no reason to reintroduce that
        // risk by starting Anthropic off tight (a 2-sentence summary /
        // 3-sentence insights response comfortably fits well under this).
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return String(data.content?.[0]?.text ?? "").trim();
  }, timeoutMs);
}

export async function callGroq(
  prompt: string,
  apiKey: string,
  timeoutMs = AI_PROVIDER_TIMEOUT_MS,
): Promise<string> {
  return withProviderDeadline(async (signal) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 800,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return String(data.choices?.[0]?.message?.content ?? "").trim();
  }, timeoutMs);
}

export async function callGemini(
  prompt: string,
  apiKey: string,
  timeoutMs = AI_PROVIDER_TIMEOUT_MS,
): Promise<string> {
  return withProviderDeadline(async (signal) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return String(data.candidates[0].content.parts[0].text).trim();
  }, timeoutMs);
}

export interface AiKeys {
  anthropicApiKey?: string | null;
  groqApiKey?: string | null;
  geminiApiKey?: string | null;
}

/** Platform-level provider keys, configured once (e.g. in Vercel's project env vars) — not per client. */
export function aiKeysFromEnv(): AiKeys {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    groqApiKey: process.env.GROQ_API_KEY || null,
    geminiApiKey: process.env.GEMINI_API_KEY || null,
  };
}

export async function callAI(prompt: string, keys: AiKeys): Promise<string> {
  const deadline = Date.now() + AI_TOTAL_BUDGET_MS;
  const providers = [
    [keys.anthropicApiKey, callAnthropic],
    [keys.groqApiKey, callGroq],
    [keys.geminiApiKey, callGemini],
  ] as const;
  for (const [key, call] of providers) {
    if (!key) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      return await call(
        prompt,
        key,
        Math.min(AI_PROVIDER_TIMEOUT_MS, remaining),
      );
    } catch {
      /* Try another provider within the same total budget. */
    }
  }
  return AI_UNAVAILABLE_TEXT;
}

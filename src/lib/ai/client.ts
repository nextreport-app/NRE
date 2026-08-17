/**
 * AI provider calls — port of callAI_/callGemini_ from meta_ads_report_v4.js,
 * with Anthropic Claude swapped in as the primary provider (was Groq).
 * Anthropic is primary, Gemini is fallback, and if both fail (or no keys are
 * configured) the same placeholder string ships in the generated slide,
 * exactly as the source does.
 */

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const GEMINI_MODEL = "gemini-2.5-flash";
export const AI_UNAVAILABLE_TEXT = "[AI unavailable — check API keys]";

export async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
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
}

export async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return String(data.candidates[0].content.parts[0].text).trim();
}

export interface AiKeys {
  anthropicApiKey?: string | null;
  geminiApiKey?: string | null;
}

/** Platform-level provider keys, configured once (e.g. in Vercel's project env vars) — not per client. */
export function aiKeysFromEnv(): AiKeys {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    geminiApiKey: process.env.GEMINI_API_KEY || null,
  };
}

export async function callAI(prompt: string, keys: AiKeys): Promise<string> {
  if (keys.anthropicApiKey) {
    try {
      return await callAnthropic(prompt, keys.anthropicApiKey);
    } catch {
      // fall through to Gemini, matching callAI_'s try/catch chain
    }
  }
  if (keys.geminiApiKey) {
    try {
      return await callGemini(prompt, keys.geminiApiKey);
    } catch {
      // fall through to the placeholder
    }
  }
  return AI_UNAVAILABLE_TEXT;
}

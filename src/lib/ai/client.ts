/**
 * AI provider calls — port of callAI_/callGroq_/callGemini_ from
 * meta_ads_report_v4.js. Groq is primary, Gemini is fallback, and if both
 * fail (or no keys are configured) the same placeholder string ships in the
 * generated slide, exactly as the source does.
 */

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_MODEL = "gemini-2.5-flash";
export const AI_UNAVAILABLE_TEXT = "[AI unavailable — check API keys]";

export async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 500,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return String(data.choices[0].message.content).trim();
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
  groqApiKey?: string | null;
  geminiApiKey?: string | null;
}

export async function callAI(prompt: string, keys: AiKeys): Promise<string> {
  if (keys.groqApiKey) {
    try {
      return await callGroq(prompt, keys.groqApiKey);
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

/**
 * Groq provider — free fallback AI provider (Llama models).
 *
 * Groq exposes an OpenAI-compatible REST API. Plain fetch with the
 * `GROQ_API_KEY` env var; model defaults to `llama-3.3-70b-versatile`.
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

export interface GroqRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface GroqResponse {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Read the Groq API key from the environment (never hardcoded). */
export function getGroqApiKey(): string {
  return process.env.GROQ_API_KEY || "";
}

export function isGroqConfigured(): boolean {
  return !!getGroqApiKey();
}

/**
 * Call Groq (OpenAI-compatible chat completions). Throws on failure; the
 * provider selection layer decides whether to use this as a fallback.
 */
export async function generateWithGroq(
  request: GroqRequest
): Promise<GroqResponse> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error("Groq is not configured: GROQ_API_KEY is missing");
  }

  const model = request.model || GROQ_DEFAULT_MODEL;
  const messages: Array<{ role: string; content: string }> = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.prompt });

  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const text = (data.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    throw new Error("Groq API returned an empty response");
  }

  return {
    text,
    model,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
  };
}

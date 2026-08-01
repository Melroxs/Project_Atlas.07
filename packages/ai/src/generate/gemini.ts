/**
 * Google Gemini provider — primary free AI provider.
 *
 * Uses the Gemini 2.5 Flash model via the Generative Language REST API.
 * No SDK required; plain fetch with the `GOOGLE_API_KEY` env var.
 */

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export interface GeminiRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface GeminiResponse {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Read the Google API key from the environment (never hardcoded). */
export function getGoogleApiKey(): string {
  return process.env.GOOGLE_API_KEY || "";
}

export function isGeminiConfigured(): boolean {
  return !!getGoogleApiKey();
}

/**
 * Call Gemini 2.5 Flash. Throws on non-2xx or malformed responses; the
 * provider selection layer (`provider.ts`) catches failures and falls back.
 */
export async function generateWithGemini(
  request: GeminiRequest
): Promise<GeminiResponse> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new Error("Gemini is not configured: GOOGLE_API_KEY is missing");
  }

  const model = request.model || GEMINI_DEFAULT_MODEL;
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: request.prompt }] }],
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 4096,
    },
  };
  if (request.systemPrompt) {
    body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const parts = data.candidates?.[0]?.content?.parts;
  const text = (parts || []).map((p) => p.text || "").join("").trim();

  if (!text) {
    throw new Error("Gemini API returned an empty response");
  }

  return {
    text,
    model,
    promptTokens: data.usageMetadata?.promptTokenCount,
    completionTokens: data.usageMetadata?.candidatesTokenCount,
    totalTokens: data.usageMetadata?.totalTokenCount,
  };
}

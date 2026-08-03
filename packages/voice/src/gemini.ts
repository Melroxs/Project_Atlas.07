/**
 * Atlas brain — routes user text to the Atlas AI layer (Gemini primary via
 * the existing @project-atlas/ai provider, streamed over SSE) and falls back
 * to a deterministic local engine when no provider is configured.
 */

import type {
  AtlasBrain,
  BrainRequest,
  VoiceContext,
  VoiceMessage,
} from "./types";

export interface SseDelta {
  delta?: string;
  done?: { provider: string; confidence?: number };
  error?: string;
}

/**
 * Streams replies from POST /api/voice/ask (server-side, authenticated).
 * The server streams `data: {"delta":"…"}` frames then `data: {"done":…}`.
 */
export class HttpAtlasBrain implements AtlasBrain {
  private controller: AbortController | null = null;

  constructor(private apiBase: string) {}

  async ask(
    req: BrainRequest,
    onDelta: (delta: string) => void
  ): Promise<string> {
    const controller = new AbortController();
    this.controller = controller;

    const res = await fetch(`${this.apiBase}/api/voice/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: req.text,
        mode: req.context.mode,
        context: req.context,
        history: req.history.slice(-8),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `Voice service returned ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) detail = body.error;
      } catch {
        /* non-json */
      }
      throw new Error(detail);
    }

    if (!res.body) throw new Error("No response stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as SseDelta;
            if (parsed.delta) {
              full += parsed.delta;
              onDelta(parsed.delta);
            }
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.done) {
              return full;
            }
          } catch {
            /* skip malformed frame */
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.controller = null;
    }
    return full;
  }

  abort() {
    this.controller?.abort();
    this.controller = null;
  }
}

/**
 * Deterministic local brain — used when no AI provider is configured or the
 * network fails. Answers with the data the engine already has (tool results,
 * page context, conversation history) so the assistant never strands the user.
 */
export class LocalAtlasBrain implements AtlasBrain {
  private aborted = false;

  ask(
    req: BrainRequest,
    onDelta: (delta: string) => void
  ): Promise<string> {
    return new Promise((resolve) => {
      const text = buildLocalAnswer(req.text, req.context, req.history);
      // Stream the reply in chunks for a believable response.
      const reduced =
        typeof window !== "undefined" &&
        !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        onDelta(text);
        resolve(text);
        return;
      }
      let i = 0;
      const tick = window.setInterval(() => {
        if (this.aborted) {
          window.clearInterval(tick);
          resolve(text);
          return;
        }
        i += 24;
        const chunk = text.slice(0, i);
        const lastChunk = chunk.slice(-24);
        onDelta(lastChunk);
        if (i >= text.length) {
          window.clearInterval(tick);
          resolve(text);
        }
      }, 24);
    });
  }

  abort() {
    this.aborted = true;
  }
}

function lastAssistantText(history: VoiceMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === "assistant" && history[i].text) {
      return history[i].text;
    }
  }
  return null;
}

function buildLocalAnswer(
  text: string,
  context: VoiceContext,
  history: VoiceMessage[]
): string {
  const lower = text.toLowerCase();
  const prior = lastAssistantText(history);

  if (lower.includes("thank")) {
    return "You're welcome. Atlas is here whenever you need to open a claim, explain a decision, generate a supplement, or run the demo — just ask.";
  }
  if (lower.includes("hello") || lower.includes("hi ") || lower === "hi" || lower.includes("hey")) {
    return context.mode === "demo"
      ? "Hi! You're on the Demo page. Try “run the demo”, “open the evidence graph”, or “generate the final claim package”."
      : "Hello — I'm Atlas Voice. Ask me to open claims, search documents, explain a decision, or run the demo. What would you like to do?";
  }
  if (lower.includes("who are you") || lower.includes("what can you")) {
    return "I'm Atlas — the AI operating system for insurance restoration. I can open claims, search documents, explain decision-engine recommendations, generate supplements, run interviews, control the demo, and export the final claim package. Everything I do reuses the same engines the Atlas UI uses.";
  }
  if (lower.includes("confidence") && context.claimNumber) {
    return `For the current claim (${context.claimNumber}) the Decision Engine weighs evidence, coverage, compliance and risk into a single confidence score. Ask me to “explain this decision” for the exact sub-scores and reasoning.`;
  }
  if (prior && lower.includes("again") === false && lower.length < 60) {
    return `To follow up on what I just said — ${prior.slice(0, 200)}. Ask “explain this decision” or “generate supplement” to go deeper on the current ${context.mode} record.`;
  }
  if (context.claimNumber) {
    return `I'm looking at ${context.claimNumber}${context.claimId ? ` (claim ${context.claimId.slice(0, 8)}…)` : ""}. I can summarize it, explain its decision, generate its supplement, or open its documents. Which would you like?`;
  }
  return "I understood the question, but I need a bit more context. Try a command like “open Carter claim”, “show today's claims”, “generate supplement”, or “explain this decision”.";
}

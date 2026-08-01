/**
 * Summarization prompt templates — single source of truth.
 */

export interface SummaryPromptContext {
  content: string;
  focus?: string;
  maxWords?: number;
}

/** System prompt for summarization. */
export function buildSummarySystemPrompt(): string {
  return `You are a concise, accurate business summarizer for an insurance restoration company. Preserve key facts, numbers, dates, and action items. Do not invent information.`;
}

/** Build a summarization user prompt. */
export function buildSummaryPrompt(context: SummaryPromptContext): string {
  const lines: string[] = [];
  const maxWords = context.maxWords || 200;
  if (context.focus) {
    lines.push(`Summarize the following content in at most ${maxWords} words, focusing on: ${context.focus}.`);
  } else {
    lines.push(`Summarize the following content in at most ${maxWords} words, preserving key facts, numbers, and action items.`);
  }
  lines.push("");
  lines.push("--- CONTENT ---");
  lines.push(context.content);
  return lines.join("\n");
}

/**
 * Interview AI prompt templates — single source of truth.
 */

export interface InterviewPromptContext {
  question: string;
  contextText?: string;
}

/** System prompt for interview evaluation. */
export function buildInterviewSystemPrompt(): string {
  return `You are an expert insurance restoration interview evaluator. You answer interview questions concisely and provide brief, accurate assessments based on provided context.`;
}

/** Build an interview answer prompt (with optional document context). */
export function buildInterviewAnswerPrompt(context: InterviewPromptContext): string {
  const lines: string[] = [];
  if (context.contextText) {
    lines.push(`Using the following context, answer the question concisely and provide a brief assessment.\n\nContext:\n${context.contextText}`);
  } else {
    lines.push(`Answer the following interview question concisely and provide a brief assessment.`);
  }
  lines.push(`\nQuestion: ${context.question}`);
  return lines.join("\n");
}

// apps/api/src/lib/ai.ts
import { generateText, buildInterviewAnswerPrompt } from '@project-atlas/ai';

/**
 * Generate a response using the unified free-AI layer
 * (Gemini primary, Groq fallback — see @project-atlas/ai).
 * Throws if generation fails; never leaves an unhandled rejection.
 * @param prompt The user prompt or system instruction.
 * @param temperature Temperature for sampling (default 0.7).
 * @returns The generated text response.
 */
export async function generateAIResponse(prompt: string, temperature = 0.7): Promise<string> {
  const result = await generateText({
    prompt,
    temperature,
    maxTokens: 1024,
  });

  if (!result.success) {
    throw new Error(`AI generation failed: ${result.message}`);
  }

  return result.text;
}

/**
 * Convenience helper to generate interview answer based on question and optional context documents.
 * @param question The interview question.
 * @param contextText Optional concatenated text from uploaded documents.
 */
export async function generateInterviewAnswer(question: string, contextText?: string): Promise<string> {
  const prompt = buildInterviewAnswerPrompt({
    question,
    contextText,
  });
  return generateAIResponse(prompt);
}

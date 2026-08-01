"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIResponse = generateAIResponse;
exports.generateInterviewAnswer = generateInterviewAnswer;
// apps/api/src/lib/ai.ts
const ai_1 = require("@project-atlas/ai");
/**
 * Generate a response using the unified free-AI layer
 * (Gemini primary, Groq fallback — see @project-atlas/ai).
 * Throws if generation fails; never leaves an unhandled rejection.
 * @param prompt The user prompt or system instruction.
 * @param temperature Temperature for sampling (default 0.7).
 * @returns The generated text response.
 */
async function generateAIResponse(prompt, temperature = 0.7) {
    const result = await (0, ai_1.generateText)({
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
async function generateInterviewAnswer(question, contextText) {
    const prompt = (0, ai_1.buildInterviewAnswerPrompt)({
        question,
        contextText,
    });
    return generateAIResponse(prompt);
}

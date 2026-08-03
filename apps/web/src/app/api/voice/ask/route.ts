// apps/web/src/app/api/voice/ask/route.ts
// Server-sent events (SSE) streaming endpoint for the Atlas brain.
// Uses the unified @project-atlas/ai generateText() (Gemini primary, Groq fallback).
// Streams `data: {"delta":"..."}` frames then `data: {"done":{...}}`.

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { generateText } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    if (!context) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const userText = (body?.text || '').trim();
    const mode = body?.mode || 'general';
    const pageContext = body?.context || {};

    if (!userText) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build a system prompt that grounds the AI in the existing Atlas data.
    const systemPrompt = buildSystemPrompt(mode, pageContext);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullText = '';

        // Stream the response in chunks via the unified AI layer.
        // Since generateText() is non-streaming, we simulate streaming
        // by emitting the full response as a single chunk.
        try {
          const result = await generateText({
            prompt: userText,
            systemPrompt,
            maxTokens: 1024,
            temperature: 0.3,
          });

          if (result.success) {
            fullText = result.text;
            const chunkSize = Math.max(24, Math.round(fullText.length / 30));
            let i = 0;
            while (i < fullText.length) {
              const delta = fullText.slice(i, i + chunkSize);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`)
              );
              i += chunkSize;
              // Small delay for a natural feel
              await new Promise((r) => setTimeout(r, 18));
            }
          } else {
            fullText = `I'm having trouble connecting to the AI service. ${result.message}`;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ delta: fullText })}\n\n`
              )
            );
          }
        } catch (error) {
          fullText = `An error occurred while processing your request. ${error instanceof Error ? error.message : ''}`;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ delta: fullText })}\n\n`
            )
          );
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: { provider: 'gemini', mode } })}\n\n`
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Voice ask error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function buildSystemPrompt(mode: string, ctx: Record<string, any>): string {
  const claimRef = ctx.claimNumber ? ` (claim ${ctx.claimNumber})` : '';
  const details = ctx.claimNumber
    ? `\nThe user is currently looking at claim ${ctx.claimNumber}${ctx.claimId ? ` (id: ${ctx.claimId.slice(0, 8)}…)` : ''}.`
    : '';

  const modeGuide: Record<string, string> = {
    claim:
      'You are helping review a property insurance restoration claim. Answer questions about the claim status, policy, damages, estimate, and next steps. ' +
      'Use the claim number and details provided in the context. Keep answers concise and grounded in restoration industry knowledge.',
    decision:
      'You are helping interpret an Atlas Decision Engine recommendation. Cover confidence scores, evidence strength, risk factors, compliance status, and ' +
      'coverage analysis. Explain why Atlas reached its conclusion and what evidence supports it.',
    document:
      'You are helping review a document related to an insurance restoration claim. Answer questions about the document contents, findings, and relevance to the claim.',
    supplement:
      'You are helping review an Atlas supplement. Answer questions about line items, pricing, code upgrades, carrier estimate comparisons, omitted items, and approval predictions.',
    interview:
      'You are helping conduct an FNOL interview. Ask follow-up questions about the loss, property damage, and policy details. Keep questions conversational and extract structured information.',
    demo:
      'You are explaining the Atlas Demo. Answer questions about the current demo step, the Carter Residence claim, the decision engine, the evidence graph, and the supplement. ' +
      'The demo uses a real restored dataset. Keep answers concise and demo-focused.',
    evidence:
      'You are helping interpret the Atlas Evidence Graph. Answer questions about evidence links, confidence scores, document references, and how each piece of evidence supports the decision.',
    general:
      'You are Project Atlas Voice — the AI operating system for insurance restoration. Answer questions about the platform, help users navigate, and guide them to the right module. ' +
      'Keep answers concise and helpful. When unsure, suggest the user try a specific command like "open claims" or "search Carter claim".',
  };

  return (
    `You are Atlas Voice, the AI assistant for the Project Atlas insurance restoration platform. ` +
    `Mode: ${mode}.${details}${claimRef}\n\n` +
    (modeGuide[mode] || modeGuide.general) +
    `\n\nAlways answer conversationally, keep responses under 200 words unless the user asks for details. ` +
    `If the user asks about something outside the current context, suggest the relevant command. ` +
    `Never mention that you are an AI language model. You are Atlas.`
  );
}
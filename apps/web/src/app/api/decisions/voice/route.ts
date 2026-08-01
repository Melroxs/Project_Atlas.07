// apps/web/src/app/api/decisions/voice/route.ts
// Atlas Voice (Elemental Integration) — grounded Q&A (Phase 4).
//
// The VoiceService builds a grounded context exclusively from the
// Decision Repository (persisted decision + evidence + compliance)
// and generates an explainable response through the provider
// (default ElementalVoiceProvider). No hallucinated explanations.

import { NextRequest, NextResponse } from 'next/server';
import {
  VoiceService,
  DecisionRepository,
} from '@project-atlas/decision';
import { requireAuth } from '@/lib/server-auth';
import { setCompanyContext } from '@/lib/server-db';
import { z } from 'zod';

const voiceSchema = z.object({
  claimId: z.string().uuid(),
  question: z.string().min(2).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const { claimId, question } = voiceSchema.parse(body);

    const repository = new DecisionRepository();
    const voiceService = new VoiceService();
    const explanation = await voiceService.ask(
      claimId,
      context.companyId,
      question,
      repository
    );

    return NextResponse.json(explanation);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Decision voice error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate voice explanation',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

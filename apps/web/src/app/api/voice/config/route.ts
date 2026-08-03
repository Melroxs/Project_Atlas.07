// apps/web/src/app/api/voice/config/route.ts
// Returns the voice capability booleans (no secrets — always safe to expose).
// The client uses this to decide which providers to activate.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

export async function GET(_request: NextRequest) {
  try {
    await requireAuth();

    const livekit = Boolean(
      process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
    );
    const cartesia = Boolean(process.env.CARTESIA_API_KEY);
    const ai = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY);

    const tier = livekit ? 'livekit' : 'browser';

    return NextResponse.json({
      enabled: true,
      livekit,
      ai,
      tts: cartesia ? 'cartesia' : 'browser',
      stt: 'browser',
      tier,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Voice config error:', error);
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
}
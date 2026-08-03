// apps/web/src/app/api/voice/token/route.ts
// Mints a LiveKit room token for the authenticated user.
// Never exposes LIVEKIT_API_KEY or LIVEKIT_API_SECRET to the browser.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

export async function POST(_request: NextRequest) {
  try {
    const context = await requireAuth();

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: 'LiveKit is not configured' },
        { status: 503 }
      );
    }

    // Dynamic import — the SDK is only available when the env vars are set.
    let AccessToken: any;
    try {
      const mod = await import('livekit-server-sdk');
      AccessToken = mod.AccessToken;
    } catch {
      return NextResponse.json(
        { error: 'LiveKit server SDK not available' },
        { status: 503 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: `atlas-user-${context.userId.slice(0, 8)}`,
      ttl: '10m',
    });
    at.addGrant({
      roomJoin: true,
      room: 'atlas-voice',
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      url: livekitUrl,
      token,
      room: 'atlas-voice',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Voice token error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
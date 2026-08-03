// apps/web/src/app/api/voice/tts/route.ts
// Text-to-speech proxy — calls Cartesia Sonic API server-side so the
// key never reaches the browser. Returns audio/wav bytes.
// Falls back to a 1-second silence WAV when Cartesia is unavailable.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VOICE_ID = '694f9389-aac1-45b6-b726-9d9369183238'; // Sonic — warm female voice

// Minimal valid WAV header (16-bit mono 24kHz ~1s silence) — when Cartesia fails.
function silenceWav(): Buffer {
  const buf = Buffer.alloc(44 + 24000);
  const w = (o: number, v: number) => { buf.writeUInt16LE(v, o); };
  const s = (o: number, v: number) => { buf.writeUInt32LE(v, o); };
  buf.write('RIFF', 0);
  s(4, 36 + 24000);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  s(16, 16); w(20, 1); w(22, 1); s(24, 24000); s(28, 48000); w(32, 2); w(34, 16);
  buf.write('data', 36);
  s(40, 24000);
  return buf;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const text = (body?.text || '').trim();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const cartesiaKey = process.env.CARTESIA_API_KEY;
    if (!cartesiaKey) {
      // No Cartesia — return silence so the client Audio element doesn't error.
      return new NextResponse(new Uint8Array(silenceWav()), {
        headers: { 'Content-Type': 'audio/wav' },
      });
    }

    try {
      const res = await fetch(CARTESIA_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cartesiaKey,
          'Cartesia-Version': '2024-11-15',
        },
        body: JSON.stringify({
          model_id: 'sonic-2',
          voice: { mode: 'id', id: CARTESIA_VOICE_ID },
          transcript: text.slice(0, 2400),
          output_format: { container: 'wav', sample_rate: 24000, encoding: 'pcm_f32le' },
        }),
      });

      if (!res.ok) {
        console.warn(`Cartesia TTS error ${res.status}: falling back to silence`);
        return new NextResponse(new Uint8Array(silenceWav()), {
          headers: { 'Content-Type': 'audio/wav' },
        });
      }

      const audioBuffer = Buffer.from(await res.arrayBuffer());
      return new NextResponse(new Uint8Array(audioBuffer), {
        headers: { 'Content-Type': 'audio/wav' },
      });
    } catch (fetchError) {
      console.warn('Cartesia TTS fetch failed:', fetchError);
      return new NextResponse(new Uint8Array(silenceWav()), {
        headers: { 'Content-Type': 'audio/wav' },
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Voice TTS error:', error);
    return new NextResponse(new Uint8Array(silenceWav()), {
      headers: { 'Content-Type': 'audio/wav' },
    });
  }
}
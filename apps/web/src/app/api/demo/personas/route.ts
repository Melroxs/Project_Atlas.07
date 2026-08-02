import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getPersonas } from '@/lib/demo-data';

// GET /api/demo/personas - Demo persona cards from live seeded data
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    const personas = await getPersonas(context);
    return NextResponse.json({ personas });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo personas GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch demo personas' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { db } from '@/lib/server-db';
import { sql } from 'drizzle-orm';

// POST /api/intelligence/diagnostics/refresh-health - Refresh health state
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    let databaseConnected = false;
    try {
      await db.execute(sql`select 1`);
      databaseConnected = true;
    } catch (e) {
      databaseConnected = false;
    }

    return NextResponse.json({
      refreshed: true,
      timestamp: new Date().toISOString(),
      databaseConnected,
      status: databaseConnected ? 'healthy' : 'degraded',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Refresh health error:', error);
    return NextResponse.json({ error: 'Failed to refresh health' }, { status: 500 });
  }
}

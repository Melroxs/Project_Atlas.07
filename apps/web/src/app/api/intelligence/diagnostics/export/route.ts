import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { db } from '@/lib/server-db';
import { sql } from 'drizzle-orm';

// GET /api/intelligence/diagnostics/export - Export diagnostics as JSON
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    let databaseConnected = false;
    try {
      await db.execute(sql`select 1`);
      databaseConnected = true;
    } catch (e) {
      databaseConnected = false;
    }

    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION || '0.5.0',
        environment: process.env.VERCEL_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        databaseConnected,
        environmentVariables: {
          DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'not set',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'not set',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'not set',
          GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? 'set' : 'not set',
          GROQ_API_KEY: process.env.GROQ_API_KEY ? 'set' : 'not set',
        },
      },
      null,
      2
    );

    return new NextResponse(payload, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="atlas-diagnostics-${new Date().toISOString()}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Diagnostics export error:', error);
    return NextResponse.json({ error: 'Failed to export diagnostics' }, { status: 500 });
  }
}

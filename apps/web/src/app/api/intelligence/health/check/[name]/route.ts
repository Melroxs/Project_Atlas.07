import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { db } from '@/lib/server-db';
import { sql } from 'drizzle-orm';

// GET /api/intelligence/health/check/[name] - Run a single health check
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await requireAuth();
    const { name } = await params;

    let status: 'pass' | 'fail' | 'warn' = 'pass';
    let message = 'OK';
    let duration = 0;

    try {
      const start = Date.now();
      switch (name) {
        case 'database': {
          await db.execute(sql`select 1`);
          message = 'Database connection successful';
          break;
        }
        case 'storage': {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          status = url && key ? 'pass' : 'warn';
          message = url && key ? 'Storage configured' : 'Storage keys missing';
          break;
        }
        case 'ai': {
          const hasKey = !!(process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
          status = hasKey ? 'pass' : 'warn';
          message = hasKey ? 'AI provider configured' : 'No AI provider key — running in offline mode';
          break;
        }
        case 'authentication': {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          status = url && key ? 'pass' : 'fail';
          message = url && key ? 'Authentication configured' : 'Supabase auth keys missing';
          break;
        }
        case 'api': {
          message = 'API responding';
          break;
        }
        case 'demo': {
          message = 'Demo mode configured';
          break;
        }
        default:
          status = 'warn';
          message = `Unknown check: ${name}`;
      }
      duration = Date.now() - start;
    } catch (e: any) {
      status = 'fail';
      message = e?.message || 'Check failed';
    }

    return NextResponse.json({
      name,
      status,
      message,
      duration,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Health check error:', error);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}

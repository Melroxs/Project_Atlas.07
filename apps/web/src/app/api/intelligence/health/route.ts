import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { db } from '@/lib/server-db';
import { sql } from 'drizzle-orm';
import { getStorageService } from '@/lib/server-storage';

// GET /api/intelligence/health - Get intelligence service health with live checks
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();

    const checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message: string;
      duration?: number;
      metadata?: Record<string, any>;
    }> = [];

    // Database check
    let dbOk = false;
    let dbDuration = 0;
    try {
      const start = Date.now();
      await db.execute(sql`select 1`);
      dbDuration = Date.now() - start;
      dbOk = true;
    } catch (e) {
      console.error('Health DB check failed:', e);
    }
    checks.push({
      name: 'database',
      status: dbOk ? 'pass' : 'fail',
      message: dbOk ? 'Database connection is healthy' : 'Database connection failed',
      duration: dbDuration,
      metadata: dbOk ? { latency: dbDuration } : undefined,
    });

    // Storage check
    let storageOk = false;
    try {
      const storage = getStorageService();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      storageOk = !!(storage && url && key);
    } catch (e) {
      storageOk = false;
    }
    checks.push({
      name: 'storage',
      status: storageOk ? 'pass' : 'warn',
      message: storageOk ? 'Storage service is configured' : 'Storage is not fully configured',
    });

    // AI provider check
    const aiConnected = !!(process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
    checks.push({
      name: 'ai',
      status: aiConnected ? 'pass' : 'warn',
      message: aiConnected ? 'AI provider is configured' : 'No AI provider key configured — AI runs in offline/fallback mode',
      metadata: { provider: aiConnected ? (process.env.GOOGLE_API_KEY ? 'gemini' : process.env.GROQ_API_KEY ? 'groq' : 'openai') : 'none' },
    });

    // Authentication check
    checks.push({
      name: 'authentication',
      status: 'pass',
      message: `Authenticated as ${context.userName || context.userId}`,
    });

    // API check
    checks.push({
      name: 'api',
      status: 'pass',
      message: 'API is responding',
    });

    // Demo mode check
    const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true';
    checks.push({
      name: 'demo',
      status: demoEnabled ? 'pass' : 'warn',
      message: demoEnabled ? 'Demo mode is enabled' : 'Demo mode is not enabled',
    });

    const failed = checks.filter((c) => c.status === 'fail');
    const warned = checks.filter((c) => c.status === 'warn');
    const status = failed.length > 0 ? 'unhealthy' : warned.length > 0 ? 'degraded' : 'healthy';

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Intelligence health GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch intelligence health' }, { status: 500 });
  }
}

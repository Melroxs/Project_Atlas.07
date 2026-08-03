// apps/web/src/app/api/voice/analytics/route.ts
// Server-side voice analytics intake. The client sends lightweight, non-PII
// events (sessions, commands, latency, failures, interruptions). Records are
// appended to the company's activity log so operators can review voice usage.

import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { activityLogs } from '@project-atlas/database';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const analyticsSchema = z.object({
  type: z.string().min(1).max(40),
  command: z.string().max(60).optional(),
  latencyMs: z.number().min(0).max(120000).optional(),
  ok: z.boolean().optional(),
  detail: z.string().max(300).optional(),
});

// POST /api/voice/analytics — record a voice analytics event
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    let body: { events?: unknown } & Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      /* empty body */
    }

    // Accept either a single event or a batch of events.
    const rawEvents = Array.isArray(body?.events) ? body.events : [body];
    let recorded = 0;
    for (const raw of rawEvents) {
      const parsed = analyticsSchema.safeParse(raw ?? {});
      if (!parsed.success) continue;

      const { type, command, latencyMs, ok: success, detail } = parsed.data;
      const label = ['voice', type, command].filter(Boolean).join('.');

      // Record into the company activity log (auditable, tenant-scoped).
      await db.insert(activityLogs).values({
        companyId: context.companyId,
        userId: context.userId,
        action: label,
        entityType: 'voice',
        description: detail ?? (success === false ? 'voice event failed' : 'voice event recorded'),
        newValues: {
          latencyMs: latencyMs ?? null,
          ok: success ?? true,
        },
      });
      recorded += 1;
    }

    return NextResponse.json({ ok: true, recorded });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Voice analytics error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to record analytics' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { supplements, claims } from '@project-atlas/database';
import { eq, count, sql, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';

interface LearningPattern {
  id: string;
  patternType: string;
  pattern: string;
  frequency: number;
  confidence: number;
  lastObserved: string;
  impact: { financial?: number; approvalRate?: number; timeDelay?: number };
}

// GET /api/intelligence/learning/patterns/[type] - Learning patterns by type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { type } = await params;

    const patterns: LearningPattern[] = [];

    // Denial reasons: supplements denied or needing revision
    if (type === 'denial_reasons') {
      const denied = await db
        .select()
        .from(supplements)
        .where(and(
          eq(supplements.companyId, context.companyId),
          sql`${supplements.status} IN ('denied', 'needs_revision')`
        ))
        .limit(50);

      const byReason = new Map<string, number>();
      for (const s of denied) {
        const reason = (s as any).denialReason || (s.status === 'denied' ? 'Carrier denial without stated reason' : 'Carrier requested revisions');
        byReason.set(reason, (byReason.get(reason) || 0) + 1);
      }

      for (const [reason, freq] of byReason) {
        patterns.push({
          id: `pattern-denial-${reason.slice(0, 8)}`,
          patternType: 'denial_reasons',
          pattern: reason,
          frequency: freq,
          confidence: Math.min(0.95, 0.5 + freq * 0.1),
          lastObserved: new Date().toISOString(),
          impact: { approvalRate: 0.35 },
        });
      }
    }

    // Supplement revisions: revisions per supplement
    if (type === 'supplement_revisions') {
      const supplementsWithRevisions = await db
        .select()
        .from(supplements)
        .where(eq(supplements.companyId, context.companyId))
        .limit(100);

      for (const s of supplementsWithRevisions) {
        const revs = ((s as any).revisionHistory as any[]) || [];
        if (revs.length > 0) {
          patterns.push({
            id: `pattern-rev-${s.id}`,
            patternType: 'supplement_revisions',
            pattern: `Supplement ${(s as any).supplementNumber} required ${revs.length} revision(s)`,
            frequency: revs.length,
            confidence: 0.8,
            lastObserved: new Date().toISOString(),
            impact: { timeDelay: revs.length * 5 },
          });
        }
      }
    }

    // Documentation requests: claims missing documents/evidence
    if (type === 'documentation_requests') {
      const claimsMissing = await db
        .select()
        .from(claims)
        .where(and(
          eq(claims.companyId, context.companyId),
          sql`${claims.status} IN ('supplement_required', 'needs_revision', 'supplement_submitted')`
        ))
        .limit(50);

      for (const c of claimsMissing) {
        patterns.push({
          id: `pattern-doc-${c.id}`,
          patternType: 'documentation_requests',
          pattern: `Claim ${c.claimNumber} awaiting documentation to progress`,
          frequency: 1,
          confidence: 0.7,
          lastObserved: new Date().toISOString(),
          impact: { timeDelay: 3 },
        });
      }
    }

    // Carrier preferences: carriers with supplements
    if (type === 'carrier_preferences') {
      const byCarrier = await db
        .select({
          carrier: supplements.carrier,
          value: count(),
        })
        .from(supplements)
        .where(eq(supplements.companyId, context.companyId))
        .groupBy(supplements.carrier)
        .limit(20);

      for (const row of byCarrier) {
        if (!row.carrier) continue;
        patterns.push({
          id: `pattern-carrier-${row.carrier.slice(0, 8)}`,
          patternType: 'carrier_preferences',
          pattern: `${row.carrier} — ${row.value} supplement(s) processed`,
          frequency: row.value,
          confidence: 0.75,
          lastObserved: new Date().toISOString(),
          impact: { financial: row.value * 500 },
        });
      }
    }

    return NextResponse.json(patterns);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Learning patterns GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch learning patterns' }, { status: 500 });
  }
}

function and(...conditions: any[]) {
  return (conditions.length > 1 ? conditions.reduce((a, b) => a && b) : conditions[0]) as any;
}

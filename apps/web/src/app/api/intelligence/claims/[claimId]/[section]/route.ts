import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { analyzeClaimWeb, loadClaimBundleWeb } from '@/lib/claim-intelligence-server';
import { db, setCompanyContext } from '@/lib/server-db';
import { claimIntelligenceSnapshots, communicationExtractions } from '@project-atlas/database';
import { eq, and, desc } from 'drizzle-orm';
import { extractAll } from '@project-atlas/claim-intelligence';

const SECTIONS = [
  'summary',
  'recovery-readiness',
  'health',
  'next-best-actions',
  'knowledge-graph',
  'history',
  'communications',
] as const;

// GET /api/intelligence/claims/[claimId]/[section]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string; section: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { claimId, section } = await params;

    if (!(SECTIONS as readonly string[]).includes(section)) {
      return NextResponse.json({ error: 'Unknown intelligence section' }, { status: 400 });
    }

    const model = await analyzeClaimWeb(context.companyId, claimId);
    if (!model) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    switch (section) {
      case 'summary':
        return NextResponse.json(model);
      case 'recovery-readiness':
        return NextResponse.json(model.recoveryReadiness);
      case 'health':
        return NextResponse.json({
          health: model.health,
          openRisks: model.openRisks,
          missingInformation: model.missingInformation,
        });
      case 'next-best-actions':
        return NextResponse.json({ actions: model.nextBestActions });
      case 'knowledge-graph':
        return NextResponse.json(model.knowledgeGraph);
      case 'history': {
        const snapshots = await db
          .select()
          .from(claimIntelligenceSnapshots)
          .where(
            and(
              eq((claimIntelligenceSnapshots as any).claimId, claimId),
              eq((claimIntelligenceSnapshots as any).companyId, context.companyId)
            )
          )
          .orderBy(desc((claimIntelligenceSnapshots as any).analyzedAt))
          .limit(50)
          .catch(() => [] as any[]);
        return NextResponse.json({
          count: snapshots.length,
          snapshots: snapshots.map((s: any) => ({
            id: s.id,
            analyzedAt: s.analyzedAt,
            healthScore: s.healthScore,
            recoveryReadiness: s.recoveryReadiness,
            complianceStatus: s.complianceStatus,
            actions: (s.model?.nextBestActions || []).map((a: any) => ({
              title: a.title,
              priority: a.priority,
              confidence: a.confidence,
            })),
          })),
        });
      }
      case 'communications': {
        const bundle = await loadClaimBundleWeb(context.companyId, claimId);
        const live = bundle ? extractAll(bundle) : [];
        const stored = await db
          .select()
          .from(communicationExtractions)
          .where(
            and(
              eq((communicationExtractions as any).claimId, claimId),
              eq((communicationExtractions as any).companyId, context.companyId)
            )
          )
          .orderBy(desc((communicationExtractions as any).createdAt))
          .limit(200)
          .catch(() => [] as any[]);
        return NextResponse.json({
          communications: (bundle?.communications || []).map((c) => ({
            source: c.source,
            content: c.content,
            createdAt: c.createdAt,
          })),
          extracted: live.map((e) => ({
            entityType: e.entityType,
            value: e.value,
            confidence: e.confidence,
            context: e.context,
          })),
          storedCount: stored.length,
        });
      }
      default:
        return NextResponse.json({ error: 'Unknown intelligence section' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Claim intelligence GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch claim intelligence' }, { status: 500 });
  }
}

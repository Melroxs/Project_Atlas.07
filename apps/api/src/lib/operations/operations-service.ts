// apps/api/src/lib/operations/operations-service.ts
import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  db,
  claims,
  properties,
  documents,
  supplements,
  interviews,
  notes,
  activityLogs,
  evidenceLinks,
  digitalTwins,
} from '@project-atlas/database';
import {
  ClaimBundle,
  OperationsModel,
  CompanyOperationsOverview,
  analyzeOperations,
  analyzePortfolio,
  claimEventBus,
  DomainEvent,
} from '@project-atlas/claim-intelligence';
import { classifyDocument, loadClaimBundle } from '../intelligence/claim-intelligence-service';

// ---------------------------------------------------------------------------
// Bulk company loading — assemble ALL claim bundles for a company in ~8 queries
// (portfolio analytics must never be N+1 over claims).
// ---------------------------------------------------------------------------
export async function loadCompanyBundles(companyId: string): Promise<ClaimBundle[]> {
  const claimRows: any[] = await db
    .select()
    .from(claims)
    .where(eq((claims as any).companyId, companyId));
  if (claimRows.length === 0) return [];

  const claimIds = claimRows.map((c) => c.id);

  const [docRows, supRows, intRows, noteRows, actRows] = (await Promise.all([
    db.select().from(documents).where(inArray((documents as any).claimId, claimIds)),
    db
      .select()
      .from(supplements)
      .where(inArray((supplements as any).claimId, claimIds))
      .orderBy(desc((supplements as any).createdAt)),
    db.select().from(interviews).where(inArray((interviews as any).claimId, claimIds)),
    db.select().from(notes).where(inArray((notes as any).entityId, claimIds)),
    db.select().from(activityLogs).where(inArray((activityLogs as any).claimId, claimIds)),
  ])) as [any[], any[], any[], any[], any[]];

  // Evidence links for every document across the company.
  const allDocIds = docRows.map((d: any) => d.id);
  const linkRows: any[] =
    allDocIds.length > 0
      ? await db
          .select()
          .from(evidenceLinks)
          .where(inArray((evidenceLinks as any).documentId, allDocIds))
          .catch(() => [] as any[])
      : [];

  const propIds = claimRows.map((c: any) => c.propertyId).filter(Boolean);
  const propRows: any[] =
    propIds.length > 0
      ? await db.select().from(properties).where(inArray((properties as any).id, propIds))
      : [];
  const propMap = new Map(propRows.map((p: any) => [p.id, p]));

  // Group rows by claim.
  const docsByClaim = new Map<string, any[]>();
  for (const d of docRows) {
    const list = docsByClaim.get(d.claimId) || [];
    list.push(d);
    docsByClaim.set(d.claimId, list);
  }
  const supsByClaim = new Map<string, any[]>();
  for (const s of supRows) {
    const list = supsByClaim.get(s.claimId) || [];
    list.push(s);
    supsByClaim.set(s.claimId, list);
  }
  const intsByClaim = new Map<string, any[]>();
  for (const i of intRows) {
    const list = intsByClaim.get(i.claimId) || [];
    list.push(i);
    intsByClaim.set(i.claimId, list);
  }
  const notesByClaim = new Map<string, any[]>();
  for (const n of noteRows) {
    const list = notesByClaim.get(n.entityId) || [];
    list.push(n);
    notesByClaim.set(n.entityId, list);
  }
  const actByClaim = new Map<string, any[]>();
  for (const a of actRows) {
    const list = actByClaim.get(a.claimId) || [];
    list.push(a);
    actByClaim.set(a.claimId, list);
  }
  const linksByDoc = new Map<string, any[]>();
  for (const l of linkRows) {
    const list = linksByDoc.get(l.documentId) || [];
    list.push(l);
    linksByDoc.set(l.documentId, list);
  }

  // Conflicting estimates per claim (supplement requested > approved).
  const conflictingByClaim = new Map<string, Set<string>>();
  for (const c of claimRows) {
    const set = new Set<string>();
    const sups = supsByClaim.get(c.id) || [];
    for (const s of sups) {
      if (Number(s.requestedAmount ?? 0) > Number(s.approvedAmount ?? 0)) {
        for (const d of docsByClaim.get(c.id) || []) {
          if (/estimate|xactimate/i.test(d.fileName || d.url || '')) set.add(d.id);
        }
      }
    }
    conflictingByClaim.set(c.id, set);
  }

  return claimRows.map((claim: any): ClaimBundle => {
    const claimDocs = (docsByClaim.get(claim.id) || []).map((d: any) => {
      const classified = classifyDocument(d);
      return {
        ...classified,
        conflictDetected: conflictingByClaim.get(claim.id)?.has(d.id) || undefined,
      };
    });
    const claimSups = supsByClaim.get(claim.id) || [];
    const claimNotes = notesByClaim.get(claim.id) || [];
    const claimActivity = actByClaim.get(claim.id) || [];
    const property = claim.propertyId ? propMap.get(claim.propertyId) || null : null;

    const communications = [
      ...claimNotes.map((n: any) => ({
        id: n.id,
        source: 'note' as const,
        content: n.content || '',
        createdAt: new Date(n.createdAt).toISOString(),
      })),
      ...claimActivity
        .filter((a: any) => a.description)
        .map((a: any) => ({
          id: a.id,
          source: 'activity' as const,
          content: a.description,
          createdAt: new Date(a.createdAt).toISOString(),
        })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const docIds = claimDocs.map((d) => d.id);
    const claimLinks = docIds.flatMap((id) => linksByDoc.get(id) || []);

    return {
      claimId: claim.id,
      companyId,
      claimNumber: claim.claimNumber,
      status: claim.status,
      entryPoint: claim.entryPoint || 'new_claim',
      dateOfLoss: claim.dateOfLoss ? new Date(claim.dateOfLoss).toISOString() : null,
      dateReported: claim.dateReported ? new Date(claim.dateReported).toISOString() : null,
      insuranceCompany: claim.insuranceCompany || null,
      policyNumber: claim.policyNumber || null,
      deductible: claim.deductible != null ? Number(claim.deductible) : null,
      estimatedValue: claim.estimatedValue != null ? Number(claim.estimatedValue) : null,
      approvedValue: claim.approvedValue != null ? Number(claim.approvedValue) : null,
      description: claim.description || null,
      customerName: claim.customerName || null,
      customerEmail: claim.customerEmail || null,
      customerPhone: claim.customerPhone || null,
      propertyId: claim.propertyId || null,
      createdAt: new Date(claim.createdAt).toISOString(),
      updatedAt: new Date(claim.updatedAt).toISOString(),
      property: property
        ? {
            address: property.address || null,
            city: property.city || null,
            state: property.state || null,
            zip: property.zip || null,
          }
        : null,
      documents: claimDocs,
      supplements: claimSups.map((s: any) => ({
        id: s.id,
        supplementNumber: s.supplementNumber,
        status: s.status,
        requestedAmount: s.requestedAmount != null ? Number(s.requestedAmount) : null,
        approvedAmount: s.approvedAmount != null ? Number(s.approvedAmount) : null,
        lineItems: s.lineItems || [],
        submissionDate: s.submissionDate ? new Date(s.submissionDate).toISOString() : null,
        responseDate: s.responseDate ? new Date(s.responseDate).toISOString() : null,
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
      })),
      interviews: (intsByClaim.get(claim.id) || []).map((i: any) => ({
        id: i.id,
        status: i.status,
        progress: i.progress != null ? Number(i.progress) : null,
        completedAt: i.completedAt ? new Date(i.completedAt).toISOString() : null,
        createdAt: new Date(i.createdAt).toISOString(),
      })),
      communications,
      evidenceLinks: claimLinks.map((l: any) => ({
        id: l.id,
        recommendationId: l.recommendationId,
        documentId: l.documentId || null,
        strengthScore: l.strengthScore != null ? Number(l.strengthScore) : null,
        relevance: l.relevance || null,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Compute (read-only) — GET endpoints stay dynamic and never write.
// ---------------------------------------------------------------------------
export async function computeOperations(
  companyId: string,
  claimId: string
): Promise<{ model: OperationsModel | null; reason?: string }> {
  const bundle = await loadClaimBundle(companyId, claimId);
  if (!bundle) return { model: null, reason: 'Claim not found' };
  return { model: analyzeOperations(bundle) };
}

export async function computeCompanyOperations(
  companyId: string
): Promise<{ overview: CompanyOperationsOverview | null; reason?: string }> {
  const bundles = await loadCompanyBundles(companyId);
  if (bundles.length === 0) {
    return { overview: null, reason: 'No claims found for this company' };
  }
  return { overview: analyzePortfolio({ bundles }) };
}

// ---------------------------------------------------------------------------
// Persistence — digital twin (persistent representation), on demand + events.
// ---------------------------------------------------------------------------
export async function persistDigitalTwin(
  companyId: string,
  claimId: string,
  model: OperationsModel
): Promise<void> {
  // The twin is kept as the latest single snapshot per claim: delete any
  // previous twin, then insert the fresh one. GET /twin computes live, so this
  // table is a convenience copy of the current state (delete-then-insert is
  // best-effort — a failed insert leaves no stale twin behind).
  await db
    .delete(digitalTwins)
    .where(and(eq((digitalTwins as any).claimId, claimId), eq((digitalTwins as any).companyId, companyId)))
    .catch((e: any) => console.error('[operations] twin cleanup failed:', e.message));

  await db
    .insert(digitalTwins)
    .values({
      companyId,
      claimId,
      twin: { twin: model.digitalTwin, generatedAt: model.generatedAt } as any,
      generatedAt: new Date(),
    })
    .catch((e: any) => console.error('[operations] twin persist failed:', e.message));
}

export async function analyzeOperationsAndPersist(
  companyId: string,
  claimId: string
): Promise<{ model: OperationsModel | null; reason?: string }> {
  const result = await computeOperations(companyId, claimId);
  if (!result.model) return result;
  await persistDigitalTwin(companyId, claimId, result.model);
  return result;
}

// ---------------------------------------------------------------------------
// Event wiring — refresh the digital twin whenever claim data changes.
// ---------------------------------------------------------------------------
export function wireOperationsEvents() {
  claimEventBus.subscribe('*', async (event: DomainEvent) => {
    if (!event.claimId) return;
    try {
      await analyzeOperationsAndPersist(event.companyId, event.claimId);
    } catch (e: any) {
      console.error('[operations] event twin refresh failed:', e.message);
    }
  });
}

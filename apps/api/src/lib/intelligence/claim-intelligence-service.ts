// apps/api/src/lib/intelligence/claim-intelligence-service.ts
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
  aiConversations,
  evidenceLinks,
  claimIntelligenceSnapshots,
  communicationExtractions,
  carrierIntelligence,
  domainEvents,
} from '@project-atlas/database';
import {
  ClaimBundle,
  ClaimBundleDocument,
  ClaimIntelligenceModel,
  analyzeClaim,
  extractAll,
  claimEventBus,
  DomainEvent,
  DomainEventType,
} from '@project-atlas/claim-intelligence';

// ---------------------------------------------------------------------------
// Bundle loading — shape DB rows into the engine's plain ClaimBundle.
// ---------------------------------------------------------------------------

export function classifyDocument(doc: any): ClaimBundleDocument {
  const name = (doc.fileName || doc.url || '').toLowerCase();
  const mime = (doc.mimeType || '').toLowerCase();
  const isPhoto = mime.startsWith('image/') || /\.(jpg|jpeg|png|heic|webp|gif)$/.test(name);
  const isPolicy = /policy|declarations|coverage/.test(name);
  const isEstimate = /estimate|xactimate|supplement|line.?items|carrier.?est|contractor.?est/.test(name);
  const isCarrierDocument = /carrier|adjuster|xactimate|approved|paid/i.test(name);
  const isContractorDocument = /contractor|our|own|estimate/i.test(name);
  const isSigned = /signed|executed|wet.?signature|approved\b/i.test(name);

  return {
    id: doc.id,
    fileName: doc.fileName || 'untitled',
    url: doc.url,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    isPhoto,
    isPolicy,
    isEstimate,
    isCarrierDocument,
    isContractorDocument,
    isSigned,
  };
}

export async function loadClaimBundle(companyId: string, claimId: string): Promise<ClaimBundle | null> {
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq((claims as any).id, claimId), eq((claims as any).companyId, companyId)))
    .limit(1);
  if (!claim) return null;

  const claimDocs = await db
    .select()
    .from(documents)
    .where(and(eq((documents as any).claimId, claimId), eq((documents as any).companyId, companyId)));

  const claimSups = await db
    .select()
    .from(supplements)
    .where(and(eq((supplements as any).claimId, claimId), eq((supplements as any).companyId, companyId)))
    .orderBy(desc((supplements as any).createdAt));

  const claimInterviews = await db
    .select()
    .from(interviews)
    .where(and(eq((interviews as any).claimId, claimId), eq((interviews as any).companyId, companyId)));

  const claimNotes = await db
    .select()
    .from(notes)
    .where(and(eq((notes as any).entityId, claimId), eq((notes as any).companyId, companyId)));

  const claimActivity = await db
    .select()
    .from(activityLogs)
    .where(and(eq((activityLogs as any).claimId, claimId), eq((activityLogs as any).companyId, companyId)));

  // ai_conversations has no claim_id column; only include conversations that
  // reference this claim via metadata, so company-wide Ask Atlas history never
  // pollutes a single claim's communications intelligence.
  const allConvos = await db
    .select()
    .from(aiConversations)
    .where(eq((aiConversations as any).companyId, companyId));
  const claimConvos = allConvos.filter((c: any) => {
    const md = c.metadata;
    return md && (md.claimId === claimId || md.claim_id === claimId);
  });

  // Evidence links scoped by documents on this claim (evidence_links has no claim_id)
  const docIds = claimDocs.map((d: any) => d.id);
  let claimLinks: any[] = [];
  if (docIds.length > 0) {
    claimLinks = await db
      .select()
      .from(evidenceLinks)
      .where(inArray((evidenceLinks as any).documentId, docIds))
      .catch(() => [] as any[]);
  }

  let property = null;
  if ((claim as any).propertyId) {
    [property] = await db
      .select()
      .from(properties)
      .where(eq((properties as any).id, (claim as any).propertyId))
      .limit(1);
  }

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
    ...claimConvos
      .map((c: any) => [
        { id: `${c.id}-p`, source: 'ai_conversation' as const, content: c.prompt || '', createdAt: new Date(c.createdAt).toISOString() },
        { id: `${c.id}-r`, source: 'ai_conversation' as const, content: c.response || '', createdAt: new Date(c.createdAt).toISOString() },
      ])
      .flat(),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Conflicting estimates: when a supplement shows a positive requested-vs-approved
  // gap, mark the estimate documents as conflicting so the health monitor fires.
  // (Named claimDocuments — NOT `documents` — to avoid shadowing the imported
  // drizzle `documents` table, which breaks TS resolution in this scope.)
  const conflictingEstimates = new Set<string>();
  for (const s of claimSups) {
    const requested = Number(s.requestedAmount ?? 0);
    const approved = Number(s.approvedAmount ?? 0);
    if (requested > approved) {
      for (const d of claimDocs) {
        if (/estimate|xactimate/i.test(d.fileName || d.url || '')) conflictingEstimates.add(d.id);
      }
    }
  }
  const claimDocuments = claimDocs.map((d: any) => {
    const classified = classifyDocument(d);
    return { ...classified, conflictDetected: conflictingEstimates.has(d.id) || undefined };
  });

  return {
    claimId,
    companyId,
    claimNumber: (claim as any).claimNumber,
    status: (claim as any).status,
    entryPoint: (claim as any).entryPoint || 'new_claim',
    dateOfLoss: (claim as any).dateOfLoss ? new Date((claim as any).dateOfLoss).toISOString() : null,
    dateReported: (claim as any).dateReported ? new Date((claim as any).dateReported).toISOString() : null,
    insuranceCompany: (claim as any).insuranceCompany || null,
    policyNumber: (claim as any).policyNumber || null,
    deductible: (claim as any).deductible != null ? Number((claim as any).deductible) : null,
    estimatedValue: (claim as any).estimatedValue != null ? Number((claim as any).estimatedValue) : null,
    approvedValue: (claim as any).approvedValue != null ? Number((claim as any).approvedValue) : null,
    description: (claim as any).description || null,
    customerName: (claim as any).customerName || null,
    customerEmail: (claim as any).customerEmail || null,
    customerPhone: (claim as any).customerPhone || null,
    propertyId: (claim as any).propertyId || null,
    createdAt: new Date((claim as any).createdAt).toISOString(),
    updatedAt: new Date((claim as any).updatedAt).toISOString(),
    property: property
      ? {
          address: (property as any).address || null,
          city: (property as any).city || null,
          state: (property as any).state || null,
          zip: (property as any).zip || null,
        }
      : null,
    documents: claimDocuments,
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
    interviews: claimInterviews.map((i: any) => ({
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
}

// ---------------------------------------------------------------------------
// Analysis + persistence
// ---------------------------------------------------------------------------

/**
 * Compute the intelligence model WITHOUT writing to the database.
 * Used by the read-only GET endpoints ("all endpoints should be read-only
 * and generated dynamically").
 */
export async function computeClaimIntelligence(
  companyId: string,
  claimId: string
): Promise<{ model: ClaimIntelligenceModel | null; reason?: string }> {
  const bundle = await loadClaimBundle(companyId, claimId);
  if (!bundle) return { model: null, reason: 'Claim not found' };
  return { model: analyzeClaim(bundle) };
}

/**
 * Analyze AND persist (snapshot + extractions + carrier intelligence).
 * Used by the POST /analyze trigger and the event-driven subscriber.
 */
export async function analyzeClaimIntelligence(
  companyId: string,
  claimId: string
): Promise<{ model: ClaimIntelligenceModel | null; reason?: string }> {
  const bundle = await loadClaimBundle(companyId, claimId);
  if (!bundle) return { model: null, reason: 'Claim not found' };

  const model = analyzeClaim(bundle);

  // Persist snapshot (history for the Recommendation History endpoint)
  await db
    .insert(claimIntelligenceSnapshots)
    .values({
      companyId,
      claimId,
      healthScore: model.health as any,
      recoveryReadiness: model.recoveryReadiness as any,
      evidenceCompleteness: model.evidenceCompleteness as any,
      documentationCompleteness: model.documentationCompleteness as any,
      policyAnalysisStatus: model.policyAnalysisStatus,
      complianceStatus: model.complianceStatus,
      aiConfidence: model.aiConfidence as any,
      model: model as any,
      analyzedAt: new Date(),
    })
    .catch((e: any) => console.error('[claim-intelligence] snapshot persist failed:', e.message));

  // Communications Intelligence: persist structured extractions
  const extractions = extractAll(bundle);
  if (extractions.length > 0) {
    await db
      .insert(communicationExtractions)
      .values(
        extractions.map((e) => ({
          companyId,
          claimId,
          source: e.source,
          sourceId: e.sourceCommunicationId,
          entityType: e.entityType,
          value: e.value,
          confidence: e.confidence.toString(),
          context: e.context,
        }))
      )
      .catch((err: any) => console.error('[claim-intelligence] extractions persist failed:', err.message));
  }

  // Carrier Intelligence Foundation: aggregate per-carrier stats
  await persistCarrierIntelligence(companyId, bundle, extractions);

  return { model };
}

async function persistCarrierIntelligence(
  companyId: string,
  bundle: ClaimBundle,
  extractions: any[]
) {
  const carrier = bundle.insuranceCompany;
  if (!carrier) return;

  const carrierDocs = bundle.documents.filter((d) => d.isCarrierDocument || d.isPolicy);
  const reviewTimes = bundle.supplements
    .filter((s) => s.submissionDate && s.responseDate)
    .map((s) => ({
      supplement: s.supplementNumber,
      days: Math.round(
        (new Date(s.responseDate!).getTime() - new Date(s.submissionDate!).getTime()) / 86400000
      ),
    }));

  const existing = await db
    .select()
    .from(carrierIntelligence)
    .where(and(eq((carrierIntelligence as any).companyId, companyId), eq((carrierIntelligence as any).carrier, carrier)))
    .limit(1)
    .catch(() => [] as any[]);

  const preferredDocs = [...new Set(carrierDocs.map((d) => (d.isPolicy ? 'Policy' : 'Estimate')))];

  // Structured intelligence (foundation only — never automates carrier decisions):
  const frequentlyRequestedEvidence = extractions
    .filter((e) => e.entityType === 'requested_document')
    .map((e) => e.value)
    .slice(0, 25);
  const commonOmissions = bundle.supplements
    .filter((s) => s.status === 'needs_revision' || s.status === 'denied')
    .map((s) => `Missing/denied on ${s.supplementNumber}`)
    .slice(0, 25);
  const communicationHistory = bundle.communications.map((c) => ({
    source: c.source,
    snippet: c.content.slice(0, 120),
    createdAt: c.createdAt,
  })).slice(-20);

  if (existing.length > 0) {
    await db
      .update(carrierIntelligence)
      .set({
        preferredDocumentation: preferredDocs,
        frequentlyRequestedEvidence,
        commonOmissions,
        reviewTimelines: { samples: reviewTimes },
        communicationHistory,
        updatedAt: new Date(),
      } as any)
      .where(eq((carrierIntelligence as any).id, existing[0].id))
      .catch((e: any) => console.error('[claim-intelligence] carrier update failed:', e.message));
  } else {
    await db
      .insert(carrierIntelligence)
      .values({
        companyId,
        carrier,
        preferredDocumentation: preferredDocs,
        frequentlyRequestedEvidence,
        commonOmissions,
        reviewTimelines: { samples: reviewTimes },
        communicationHistory,
      } as any)
      .catch((e: any) => console.error('[claim-intelligence] carrier insert failed:', e.message));
  }
}

// ---------------------------------------------------------------------------
// Event-driven re-analysis: whenever claim data changes, re-evaluate.
// ---------------------------------------------------------------------------

export function wireClaimIntelligenceEvents() {
  claimEventBus.subscribe('*', async (event: DomainEvent) => {
    if (!event.claimId || event.eventType === 'intelligence.reanalyzed') return;
    try {
      await analyzeClaimIntelligence(event.companyId, event.claimId);
    } catch (e: any) {
      console.error('[claim-intelligence] event re-analysis failed:', e.message);
    }
  });
}

export async function emitClaimEvent(
  companyId: string,
  claimId: string | undefined,
  eventType: DomainEventType,
  entityType: string,
  entityId?: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  if (!claimId) return;
  try {
    const event = {
      id: crypto.randomUUID(),
      companyId,
      claimId,
      eventType,
      entityType,
      entityId,
      payload,
      createdAt: new Date().toISOString(),
    };
    // Persist to domain_events (auditable/replayable event history per PLAT-006).
    // Best-effort — a failed insert must never break the emitting route.
    await db
      .insert(domainEvents)
      .values({
        // Keep the persisted row id identical to the in-memory event id so bus
        // history and the DB are traceable to the same logical event.
        id: event.id,
        companyId,
        claimId,
        eventType,
        entityType,
        entityId: entityId || null,
        payload: payload as any,
      })
      .catch((e: any) => console.error('[claim-intelligence] domain_event persist failed:', e.message));
    await claimEventBus.publish(event);
  } catch (e: any) {
    console.error('[claim-intelligence] emit failed:', e.message);
  }
}

export { claimEventBus };

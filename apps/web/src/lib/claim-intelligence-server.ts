// apps/web/src/lib/claim-intelligence-server.ts
// Server-side Claim Intelligence for the Next.js dashboard.
// Loads the claim bundle through server-db and runs the SHARED engine
// (@project-atlas/claim-intelligence) — the exact same analysis the Fastify
// API performs. No business logic is duplicated.
import { db, setCompanyContext } from '@/lib/server-db';
import {
  claims,
  properties,
  documents,
  supplements,
  interviews,
  notes,
  activityLogs,
  aiConversations,
  evidenceLinks,
} from '@project-atlas/database';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { ClaimBundle, analyzeClaim } from '@project-atlas/claim-intelligence';

function classifyDocument(doc: any) {
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

export async function loadClaimBundleWeb(
  companyId: string,
  claimId: string
): Promise<ClaimBundle | null> {
  await setCompanyContext(companyId);

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

export async function analyzeClaimWeb(companyId: string, claimId: string) {
  const bundle = await loadClaimBundleWeb(companyId, claimId);
  if (!bundle) return null;
  return analyzeClaim(bundle);
}

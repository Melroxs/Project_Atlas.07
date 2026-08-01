// apps/web/src/lib/operations-server.ts
// Server-side Operations Intelligence for the Next.js dashboard.
// Loads claim bundles through server-db and runs the SHARED engine
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
  evidenceLinks,
} from '@project-atlas/database';
import { eq, inArray, desc } from 'drizzle-orm';
import {
  ClaimBundle,
  analyzeOperations,
  analyzePortfolio,
  CompanyOperationsOverview,
} from '@project-atlas/claim-intelligence';

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

export async function computeOperationsWeb(companyId: string, claimId: string) {
  await setCompanyContext(companyId);
  const bundle = await loadClaimBundleWeb(companyId, claimId);
  if (!bundle) return null;
  return analyzeOperations(bundle);
}

export async function computeCompanyOperationsWeb(companyId: string): Promise<CompanyOperationsOverview | null> {
  await setCompanyContext(companyId);
  const bundles = await loadCompanyBundlesWeb(companyId);
  if (bundles.length === 0) return null;
  return analyzePortfolio({ bundles });
}

// Single-claim bundle (mirrors the API loader).
export async function loadClaimBundleWeb(companyId: string, claimId: string): Promise<ClaimBundle | null> {
  const [claim] = await db
    .select()
    .from(claims)
    .where(eq((claims as any).id, claimId))
    .limit(1);
  if (!claim) return null;

  const claimDocs = await db.select().from(documents).where(eq((documents as any).claimId, claimId));
  const claimSups = await db
    .select()
    .from(supplements)
    .where(eq((supplements as any).claimId, claimId))
    .orderBy(desc((supplements as any).createdAt));
  const claimInterviews = await db.select().from(interviews).where(eq((interviews as any).claimId, claimId));
  const claimNotes = await db.select().from(notes).where(eq((notes as any).entityId, claimId));
  const claimActivity = await db.select().from(activityLogs).where(eq((activityLogs as any).claimId, claimId));

  const docIds = claimDocs.map((d: any) => d.id);
  const claimLinks: any[] =
    docIds.length > 0
      ? await db
          .select()
          .from(evidenceLinks)
          .where(inArray((evidenceLinks as any).documentId, docIds))
          .catch(() => [] as any[])
      : [];

  let property = null;
  if ((claim as any).propertyId) {
    [property] = await db.select().from(properties).where(eq((properties as any).id, (claim as any).propertyId)).limit(1);
  }

  const communications = [
    ...claimNotes.map((n: any) => ({ id: n.id, source: 'note' as const, content: n.content || '', createdAt: new Date(n.createdAt).toISOString() })),
    ...claimActivity.filter((a: any) => a.description).map((a: any) => ({ id: a.id, source: 'activity' as const, content: a.description, createdAt: new Date(a.createdAt).toISOString() })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const conflictingEstimates = new Set<string>();
  for (const s of claimSups) {
    if (Number(s.requestedAmount ?? 0) > Number(s.approvedAmount ?? 0)) {
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

// Company-wide bulk bundle loading for portfolio analytics.
export async function loadCompanyBundlesWeb(companyId: string): Promise<ClaimBundle[]> {
  const claimRows: any[] = await db.select().from(claims).where(eq((claims as any).companyId, companyId));
  if (claimRows.length === 0) return [];
  const claimIds = claimRows.map((c) => c.id);

  const [docRows, supRows, intRows, noteRows, actRows] = (await Promise.all([
    db.select().from(documents).where(inArray((documents as any).claimId, claimIds)),
    db.select().from(supplements).where(inArray((supplements as any).claimId, claimIds)).orderBy(desc((supplements as any).createdAt)),
    db.select().from(interviews).where(inArray((interviews as any).claimId, claimIds)),
    db.select().from(notes).where(inArray((notes as any).entityId, claimIds)),
    db.select().from(activityLogs).where(inArray((activityLogs as any).claimId, claimIds)),
  ])) as [any[], any[], any[], any[], any[]];

  const allDocIds = docRows.map((d: any) => d.id);
  const linkRows: any[] =
    allDocIds.length > 0
      ? await db.select().from(evidenceLinks).where(inArray((evidenceLinks as any).documentId, allDocIds)).catch(() => [] as any[])
      : [];

  const propIds = claimRows.map((c: any) => c.propertyId).filter(Boolean);
  const propRows: any[] = propIds.length > 0 ? await db.select().from(properties).where(inArray((properties as any).id, propIds)) : [];
  const propMap = new Map(propRows.map((p: any) => [p.id, p]));

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

  const conflictingByClaim = new Map<string, Set<string>>();
  for (const c of claimRows) {
    const set = new Set<string>();
    for (const s of supsByClaim.get(c.id) || []) {
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
      return { ...classified, conflictDetected: conflictingByClaim.get(claim.id)?.has(d.id) || undefined };
    });
    const claimNotes = notesByClaim.get(claim.id) || [];
    const claimActivity = actByClaim.get(claim.id) || [];
    const property = claim.propertyId ? propMap.get(claim.propertyId) || null : null;
    const communications = [
      ...claimNotes.map((n: any) => ({ id: n.id, source: 'note' as const, content: n.content || '', createdAt: new Date(n.createdAt).toISOString() })),
      ...claimActivity.filter((a: any) => a.description).map((a: any) => ({ id: a.id, source: 'activity' as const, content: a.description, createdAt: new Date(a.createdAt).toISOString() })),
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
      property: property ? { address: property.address || null, city: property.city || null, state: property.state || null, zip: property.zip || null } : null,
      documents: claimDocs,
      supplements: (supsByClaim.get(claim.id) || []).map((s: any) => ({
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

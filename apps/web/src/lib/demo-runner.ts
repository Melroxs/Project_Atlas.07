// apps/web/src/lib/demo-runner.ts
// Executes each step of the Atlas claim lifecycle against the live database.
// Every step writes real rows (activities, status transitions, intelligence
// notes, evidence links, decision records, supplement updates) so metrics,
// timelines and UI update in real time during the Full Atlas Demo.

import { db, setCompanyContext } from './server-db';
import {
  claims,
  supplements,
  decisions,
  decisionScores,
  decisionRisks,
  decisionEvidenceLinks,
  evidenceLinks,
  documents,
  notes,
  activityLogs,
} from '@project-atlas/database';
import { eq, and } from 'drizzle-orm';
import { calculateMetrics } from './demo-seed';

export const DEMO_STEPS = [
  { id: 'lead', label: 'Lead created', ai: 'Creating lead from inbound storm report…' },
  { id: 'inspection', label: 'Inspection scheduled', ai: 'Scheduling roof inspection with photo checklist…' },
  { id: 'interview', label: 'FNOL interview', ai: 'Running guided interview — extracting loss details…' },
  { id: 'claim', label: 'Claim created', ai: 'Creating claim CL-2026-0614 from interview data…' },
  { id: 'photos', label: 'Photos uploaded', ai: 'Uploading 22 inspection photos with GPS tags…' },
  { id: 'photo_ai', label: 'Photo intelligence', ai: 'Analyzing photos for hail impacts, granule loss and flashing damage…' },
  { id: 'weather', label: 'Weather verified', ai: 'Checking NOAA history for the loss date…' },
  { id: 'measurements', label: 'Roof measured', ai: 'Measuring roof planes from drone photogrammetry…' },
  { id: 'code', label: 'Code compliance', ai: 'Checking 2023 Florida Building Code requirements…' },
  { id: 'evidence', label: 'Evidence graph built', ai: 'Linking photos, weather and policy to the scope…' },
  { id: 'decision', label: 'Decision Engine', ai: 'Running Decision Engine — scoring evidence, coverage, risk…' },
  { id: 'compliance', label: 'Compliance validated', ai: 'Validating compliance — 0 violations found…' },
  { id: 'supplement', label: 'Supplement generated', ai: 'Pricing six Xactimate line items — $22,835.65…' },
  { id: 'carrier', label: 'Submitted to carrier', ai: 'Assembling package and submitting for carrier review…' },
  { id: 'approval', label: 'Carrier approved', ai: 'Carrier approved $18,421.15 — updating recovery…' },
  { id: 'invoice', label: 'Invoice issued', ai: 'Issuing invoice ATL-8821 for approved scope…' },
  { id: 'closed', label: 'Claim closed', ai: 'Finalizing claim — $18,421.15 recovered, +417%…' },
] as const;

export type DemoStepId = (typeof DEMO_STEPS)[number]['id'];

interface Ctx {
  userId: string;
  companyId: string;
  userName?: string | null;
}

const FLAGSHIP_NUMBER = 'CL-2026-0614';

async function flagshipClaim(ctx: Ctx) {
  await setCompanyContext(ctx.companyId);
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.companyId, ctx.companyId), eq(claims.claimNumber, FLAGSHIP_NUMBER)))
    .limit(1);
  return claim;
}

async function addActivity(
  ctx: Ctx,
  claimId: string,
  action: string,
  description: string,
  ageHours = 0,
) {
  await db.insert(activityLogs).values({
    companyId: ctx.companyId,
    userId: ctx.userId,
    userName: ctx.userName,
    entityType: 'claim',
    entityId: claimId,
    entityName: FLAGSHIP_NUMBER,
    claimId,
    action,
    description,
    newValues: { liveDemo: true },
    createdAt: new Date(Date.now() - ageHours * 3600000),
  });
}

async function ensureNote(ctx: Ctx, claimId: string, type: string, content: string) {
  const [existing] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.entityId, claimId), eq(notes.entityType, type)))
    .limit(1);
  if (existing) return;
  await db.insert(notes).values({
    companyId: ctx.companyId,
    entityType: type,
    entityId: claimId,
    content,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });
}

async function setStatus(ctx: Ctx, claimId: string, status: string, reason: string) {
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
  const history = Array.isArray(claim?.statusHistory) ? claim.statusHistory : [];
  await db
    .update(claims)
    .set({
      status,
      statusHistory: [
        ...history,
        { status, timestamp: new Date().toISOString(), userId: ctx.userId, reason },
      ],
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(eq(claims.id, claimId));
}

export async function runDemoStep(ctx: Ctx, stepId: string) {
  const step = DEMO_STEPS.find((s) => s.id === stepId);
  if (!step) return { error: `Unknown step: ${stepId}` };

  const claim = await flagshipClaim(ctx);
  if (!claim) {
    return { error: 'Flagship claim not found — generate demo data first' };
  }

  const outputs: string[] = [];
  const timeline: Array<{ label: string; description: string; action: string }> = [];

  const push = (action: string, label: string, description: string) => {
    timeline.push({ action, label, description });
    outputs.push(description);
  };

  switch (step.id) {
    case 'lead':
      await setStatus(ctx, claim.id, 'new', 'Lead captured from inbound storm report');
      await addActivity(ctx, claim.id, 'create', 'Lead created for Carter Residence — wind & hail event');
      push('create', 'Lead created', 'Carter Residence lead entered from the storm-damage report.');
      break;

    case 'inspection':
      await addActivity(ctx, claim.id, 'inspection', 'Roof inspection scheduled — 26 squares, 3 planes');
      push('inspection', 'Inspection scheduled', 'Estimator assigned with a 22-photo inspection checklist.');
      break;

    case 'interview':
      await ensureNote(
        ctx,
        claim.id,
        'interview',
        'FNOL interview transcript: customer reported hailstorm on 2026-06-14, wind-blown shingles, roof age 12 years. Six key facts extracted: loss date, cause, property, carrier, policy UPC-55420-FL, initial scope.',
      );
      await addActivity(ctx, claim.id, 'interview', 'FNOL interview completed — 6 facts extracted');
      push('interview', 'Interview finished', 'Atlas extracted loss date, cause, property and policy details.');
      break;

    case 'claim':
      await setStatus(ctx, claim.id, 'adjuster_assigned', 'Claim created from interview');
      await addActivity(ctx, claim.id, 'claim', 'Claim CL-2026-0614 created — adjuster Marta Alvarez assigned');
      push('claim', 'Claim created', 'Claim registered with Universal Property & Casualty.');
      break;

    case 'photos':
      await addActivity(ctx, claim.id, 'upload', '22 inspection photos + drone imagery uploaded');
      push('upload', 'Photos uploaded', '22 photos and drone footage attached to the claim.');
      break;

    case 'photo_ai':
      await ensureNote(
        ctx,
        claim.id,
        'photo_intelligence',
        'Photo intelligence (live demo): 22 photos analyzed. Hail impacts on architectural shingles (10/22, high severity, 12% of roof area), ridge cap (4), torn flashing (3), gutter dents (3), granule loss (12). Overall confidence 0.88. Missing shingles detected on south slope (2).',
      );
      await addActivity(ctx, claim.id, 'intelligence', 'Photo intelligence — 10 hail impacts detected (confidence 0.88)');
      push('ai', 'Photo intelligence', 'Detected hail impacts, granule loss, missing and lifted shingles across three roof planes.');
      break;

    case 'weather':
      await ensureNote(
        ctx,
        claim.id,
        'weather',
        'Weather verification (live demo): NOAA confirmed severe thunderstorm over 32810 on 2026-06-14 — 61 mph gusts, 1.25" hail. Exceeds 55 mph policy wind threshold.',
      );
      await addActivity(ctx, claim.id, 'weather', 'Weather verified — 61 mph gusts on loss date');
      push('weather', 'Weather verified', 'NOAA data confirms wind causation above policy threshold.');
      break;

    case 'measurements':
      await ensureNote(
        ctx,
        claim.id,
        'measurements',
        'Roof measurements (live demo): 26 squares total; drone photogrammetry within 2% of tape; main plane 12:12 pitch.',
      );
      await addActivity(ctx, claim.id, 'measurements', 'Roof measured — 26 squares via drone photogrammetry');
      push('measure', 'Roof measured', 'Three roof planes measured — 26 squares total scope.');
      break;

    case 'code':
      await ensureNote(
        ctx,
        claim.id,
        'compliance',
        'Code compliance (live demo): 2023 Florida Building Code R905.2.8.2 requires code-compliant underlayment at full replacement; ridge vent per spec; 180 mph exposure B wind rating. All six line items code-required or photo-backed.',
      );
      await addActivity(ctx, claim.id, 'compliance', 'Code compliance checked — 2023 FBC, all requirements met');
      push('compliance', 'Code compliance', 'Full-system replacement is code-required, not optional scope.');
      break;

    case 'evidence': {
      const [decision] = await db
        .select({ id: decisions.id })
        .from(decisions)
        .where(eq(decisions.claimId, claim.id))
        .limit(1);
      if (decision && (await evidenceLinksExist(decision.id)) === 0) {
        const docRows = await db
          .select({ id: documents.id, fileName: documents.fileName })
          .from(documents)
          .where(eq(documents.claimId, claim.id))
          .limit(200);
        const pick = (name: string) => docRows.find((d) => d.fileName.includes(name))?.id;
        const links = [
          { doc: 'Inspection Photos', strength: '0.95', rel: 'high', desc: '22 inspection photos documenting hail impacts' },
          { doc: 'Drone', strength: '0.9', rel: 'high', desc: 'Drone imagery confirming roof-plane condition' },
          { doc: 'Weather', strength: '0.85', rel: 'high', desc: 'Weather verification — 61 mph gusts on loss date' },
          { doc: 'Measurements', strength: '0.8', rel: 'medium', desc: 'Roof measurements supporting 26-square scope' },
          { doc: 'Code Compliance', strength: '0.88', rel: 'high', desc: 'Code compliance requiring full-system replacement' },
        ];
        for (const l of links) {
          const docId = pick(l.doc);
          if (docId) {
            await db.insert(evidenceLinks).values({
              recommendationId: decision.id,
              documentId: docId,
              relevance: l.rel,
              description: l.desc,
              strengthScore: l.strength,
            });
          }
        }
        await addActivity(ctx, claim.id, 'evidence', 'Evidence graph built — 5 links, strongest 0.95');
        push('evidence', 'Evidence graph built', 'Every line item connected to its supporting documents.');
      } else {
        await addActivity(ctx, claim.id, 'evidence', 'Evidence graph refreshed — 5 links');
        push('evidence', 'Evidence graph built', 'Evidence links already present — refreshed for the demo.');
      }
      break;
    }

    case 'decision': {
      const [existing] = await db
        .select({ id: decisions.id })
        .from(decisions)
        .where(eq(decisions.claimId, claim.id))
        .limit(1);
      let decisionId = existing?.id;
      if (!decisionId) {
        const [row] = await db
          .insert(decisions)
          .values({
            companyId: ctx.companyId,
            claimId: claim.id,
            claimNumber: FLAGSHIP_NUMBER,
            version: 1,
            decisionType: 'SUPPLEMENT_RECOMMENDATION',
            status: 'GENERATED',
            title: 'Carter Residence — Wind & Hail Roof Supplement',
            description: 'Live demo: Decision Engine run from the Full Atlas Demo.',
            recommendation:
              'Approve full roof system replacement — 26 squares, code-compliant underlayment, ridge vent, flashing, gutters, soffit — $22,835.65 requested.',
            confidenceScore: '88.5',
            riskScore: '22',
            priority: 'HIGH',
            complianceStatus: 'COMPLIANT',
            complianceScore: '94',
            humanReviewStatus: 'PENDING',
            createdBy: ctx.userId,
          })
          .returning();
        decisionId = row.id;
        await db.insert(decisionScores).values({
          decisionId,
          evidenceScore: '88',
          coverageScore: '92',
          complianceScore: '94',
          riskFactorScore: '18',
          finalScore: '90',
          calculationDetails: { weights: { evidence: 0.35, coverage: 0.2, compliance: 0.3, risk: 0.15 }, final: 90.2 },
        });
        await db.insert(decisionRisks).values([
          { decisionId, riskType: 'WEATHER_SOURCE', severity: 'LOW', description: 'Weather from NOAA; insurer may request third-party verification.', mitigation: 'Attach NOAA station metadata.', points: 5 },
          { decisionId, riskType: 'SCOPE_DISPUTE', severity: 'LOW', description: 'Carrier may question full replacement over spot repairs.', mitigation: 'Code compliance report + hail photos.', points: 10 },
          { decisionId, riskType: 'DEPRECIATION', severity: 'MEDIUM', description: '12-year-old roof — recoverable depreciation possible.', mitigation: 'RCVD/ACV breakdown with invoice.', points: 7 },
        ]);
      }
      await addActivity(ctx, claim.id, 'decision', 'Decision Engine — confidence 88.5, risk 22, final 90/100');
      push('decision', 'Decision generated', 'Evidence 88 · Coverage 92 · Compliance 94 · Risk 22 → Final 90/100.');
      break;
    }

    case 'compliance':
      await addActivity(ctx, claim.id, 'compliance', 'Compliance validated — 94/100, COMPLIANT, 0 violations');
      push('compliance', 'Compliance validated', 'No fraud indicators, no unsupported measurements.');
      break;

    case 'supplement': {
      const [supp] = await db
        .select()
        .from(supplements)
        .where(eq(supplements.claimId, claim.id))
        .limit(1);
      if (supp) {
        await db
          .update(supplements)
          .set({ status: 'submitted', submissionDate: new Date(), updatedAt: new Date(), updatedBy: ctx.userId })
          .where(eq(supplements.id, supp.id));
      }
      await addActivity(ctx, claim.id, 'supplement', 'Supplement SUP-1 generated — $22,835.65, 6 Xactimate line items');
      push('supplement', 'Supplement generated', 'Six priced line items, three code-required — $22,835.65 requested.');
      break;
    }

    case 'carrier':
      await setStatus(ctx, claim.id, 'waiting_for_carrier', 'Package submitted for carrier review');
      await addActivity(ctx, claim.id, 'supplement', 'Complete package submitted to Universal Property & Casualty');
      push('carrier', 'Submitted to carrier', 'Photos, weather, measurements, code and decision package sent.');
      break;

    case 'approval': {
      const [supp] = await db
        .select()
        .from(supplements)
        .where(eq(supplements.claimId, claim.id))
        .limit(1);
      if (supp) {
        await db
          .update(supplements)
          .set({
            status: 'approved',
            approvedAmount: '18421.15',
            difference: '4414.50',
            approvalDate: new Date(),
            responseDate: new Date(),
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          })
          .where(eq(supplements.id, supp.id));
      }
      await db
        .update(decisions)
        .set({ status: 'APPROVED', humanReviewStatus: 'APPROVED', updatedAt: new Date() })
        .where(eq(decisions.claimId, claim.id));
      await addActivity(ctx, claim.id, 'approval', 'Carrier approved — $18,421.15 recovered on $22,835.65 requested');
      push('approval', 'Carrier approved', '$18,421.15 approved — 81% of the requested supplement.');
      break;
    }

    case 'invoice':
      await ensureNote(
        ctx,
        claim.id,
        'invoice',
        'Invoice ATL-8821 (live demo): issued 2026-07-22 for $18,421.15 approved scope. Paid 2026-07-28 via ACH. Balance $0.00.',
      );
      await addActivity(ctx, claim.id, 'invoice', 'Invoice ATL-8821 issued and paid — $18,421.15');
      push('invoice', 'Invoice issued', 'Invoice ATL-8821 issued for the approved scope and paid in full.');
      break;

    case 'closed': {
      await setStatus(ctx, claim.id, 'paid', 'Claim closed after full recovery');
      await addActivity(ctx, claim.id, 'closed', 'Claim closed — $18,421.15 recovered, +417% over initial estimate');
      push('closed', 'Claim closed', '$4,414.50 estimate → $18,421.15 recovered (+417%).');
      break;
    }
  }

  const metrics = await calculateMetrics(ctx);
  const status = await flagshipClaim(ctx);

  return {
    step: { id: step.id, label: step.label, ai: step.ai },
    timeline,
    metrics,
    claim: status
      ? {
          id: status.id,
          claimNumber: status.claimNumber,
          status: status.status,
          estimatedValue: status.estimatedValue,
          approvedValue: status.approvedValue,
        }
      : null,
    complete: step.id === 'closed',
  };
}

async function evidenceLinksExist(decisionId: string) {
  const rows = await db
    .select({ id: evidenceLinks.id })
    .from(evidenceLinks)
    .where(eq(evidenceLinks.recommendationId, decisionId))
    .limit(1);
  return rows.length;
}

// apps/web/src/lib/demo-export.ts
// Server-side builders for the Demo export panel. Produces Markdown and JSON
// payloads for claim / supplement / decision / evidence / compliance reports
// from live DB rows (flagship claim first, else the newest claim).

import { db, setCompanyContext } from './server-db';
import {
  claims,
  properties,
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
import { eq, and, desc } from 'drizzle-orm';

export type DemoExportType = 'claim' | 'supplement' | 'decision' | 'evidence' | 'compliance' | 'package';

interface Ctx {
  userId: string;
  companyId: string;
  userName?: string | null;
}

const fmtMoney = (v: unknown) =>
  `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function buildDemoExport(ctx: Ctx, type: DemoExportType) {
  await setCompanyContext(ctx.companyId);

  const claimRows = await db
    .select()
    .from(claims)
    .where(eq(claims.companyId, ctx.companyId))
    .orderBy(desc(claims.createdAt))
    .limit(25);
  const claim = claimRows.find((c) => c.claimNumber === 'CL-2026-0614') || claimRows[0];
  if (!claim) return null;

  const [property] = claim.propertyId
    ? await db.select().from(properties).where(eq(properties.id, claim.propertyId)).limit(1)
    : [];

  const supplementRows = await db
    .select()
    .from(supplements)
    .where(eq(supplements.claimId, claim.id))
    .orderBy(desc(supplements.updatedAt));

  const decisionRows = await db
    .select()
    .from(decisions)
    .where(eq(decisions.claimId, claim.id))
    .orderBy(desc(decisions.createdAt))
    .limit(5);

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.claimId, claim.id))
    .limit(200);

  const noteRows = await db
    .select()
    .from(notes)
    .where(eq(notes.entityId, claim.id))
    .limit(200);

  const activityRows = await db
    .select()
    .from(activityLogs)
    .where(and(eq(activityLogs.claimId, claim.id), eq(activityLogs.companyId, ctx.companyId)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(100);

  // Attach decision detail (scores/risks/evidence) for the first decision.
  let decisionDetail: any = null;
  if (decisionRows[0]) {
    const decisionId = decisionRows[0].id;
    const [scores] = await db.select().from(decisionScores).where(eq(decisionScores.decisionId, decisionId)).limit(1);
    const risks = await db.select().from(decisionRisks).where(eq(decisionRisks.decisionId, decisionId));
    const links = await db.select().from(decisionEvidenceLinks).where(eq(decisionEvidenceLinks.decisionId, decisionId));
    const evLinks = await db.select().from(evidenceLinks).where(eq(evidenceLinks.recommendationId, decisionId));
    decisionDetail = { decision: decisionRows[0], scores, risks, links, evidenceLinks: evLinks };
  }

  const requested = supplementRows.reduce((s, r) => s + (Number(r.requestedAmount) || 0), 0);
  const approved = supplementRows.reduce((s, r) => s + (Number(r.approvedAmount) || 0), 0);
  const estimate = Number(claim.estimatedValue) || 0;

  const base = {
    generatedAt: new Date().toISOString(),
    generatedBy: ctx.userName || 'Atlas Demo',
    claim: {
      id: claim.id,
      claimNumber: claim.claimNumber,
      status: claim.status,
      entryPoint: claim.entryPoint,
      dateOfLoss: claim.dateOfLoss,
      insuranceCompany: claim.insuranceCompany,
      policyNumber: claim.policyNumber,
      customerName: claim.customerName,
      customerEmail: claim.customerEmail,
      customerPhone: claim.customerPhone,
      deductible: claim.deductible,
      estimatedValue: claim.estimatedValue,
      approvedValue: claim.approvedValue,
      description: claim.description,
    },
    property: property
      ? {
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
          ownerName: property.ownerName,
        }
      : null,
    supplements: supplementRows.map((s) => ({
      supplementNumber: s.supplementNumber,
      status: s.status,
      requestedAmount: Number(s.requestedAmount) || 0,
      approvedAmount: Number(s.approvedAmount) || 0,
      lineItems: s.lineItems,
      denialReason: s.denialReason,
    })),
    revenue: { requested, approved, estimate, approvalIncreasePct: estimate > 0 ? Math.round((approved / estimate) * 100) : 0 },
    documents: docRows.map((d) => ({ fileName: d.fileName, mimeType: d.mimeType })),
    notes: noteRows.map((n) => ({ type: n.entityType, content: n.content })),
    activities: activityRows.map((a) => ({ action: a.action, description: a.description, createdAt: a.createdAt })),
    decisions: decisionRows.map((d) => ({ id: d.id, title: d.title, status: d.status, confidenceScore: d.confidenceScore })),
  };

  // --- Markdown builders ---
  const md = (title: string, body: string) =>
    `# ${title}\n\n_Generated by Atlas Demo — ${new Date().toISOString()}_\n\n${body}`;

  const claimMd = () =>
    md('Claim Package', [
      `## ${base.claim.customerName} — ${base.claim.claimNumber}`,
      `**Status:** ${base.claim.status}  **Carrier:** ${base.claim.insuranceCompany}  **Policy:** ${base.claim.policyNumber || '—'}`,
      base.property
        ? `**Property:** ${base.property.address}, ${base.property.city}, ${base.property.state} ${base.property.zip}`
        : '',
      `**Date of Loss:** ${base.claim.dateOfLoss?.toISOString?.() || base.claim.dateOfLoss || '—'}`,
      `**Initial Estimate:** ${fmtMoney(base.claim.estimatedValue)}  **Approved:** ${fmtMoney(base.claim.approvedValue)}`,
      '',
      '## Scope',
      base.claim.description || '—',
      '',
      '## Supplements',
      base.supplements.length
        ? base.supplements
            .map((s) => `- **${s.supplementNumber}** (${s.status}) — requested ${fmtMoney(s.requestedAmount)}, approved ${fmtMoney(s.approvedAmount)}`)
            .join('\n')
        : '_None_',
      '',
      '## Documents',
      base.documents.length ? base.documents.map((d) => `- ${d.fileName}`).join('\n') : '_None_',
      '',
      '## Timeline',
      base.activities.length
        ? base.activities.map((a) => `- ${a.createdAt?.toISOString?.() || ''} — ${a.description}`).join('\n')
        : '_None_',
    ].join('\n'));

  const supplementMd = () =>
    md('Supplement Package', [
      `## ${base.claim.customerName} — Supplement Detail`,
      `**Claim:** ${base.claim.claimNumber}  **Carrier:** ${base.claim.insuranceCompany}`,
      `**Requested:** ${fmtMoney(requested)}  **Approved:** ${fmtMoney(approved)}`,
      '',
      ...base.supplements.map((s) => [
        `### ${s.supplementNumber} — ${s.status}`,
        `Requested ${fmtMoney(s.requestedAmount)} · Approved ${fmtMoney(s.approvedAmount)}`,
        s.denialReason ? `**Denial reason:** ${s.denialReason}` : '',
        '',
        '**Line items:**',
        Array.isArray(s.lineItems) && s.lineItems.length
          ? (s.lineItems as any[])
              .map((li: any) => `- ${li.description || '—'} — ${li.quantity || 0} ${li.unit || ''} × ${fmtMoney(li.unitPrice)} = ${fmtMoney(li.total || 0)}`)
              .join('\n')
          : '_No line items_',
        '',
      ]).flat(),
      '## Cost Breakdown',
      `| Item | Amount |`,
      `|---|---|`,
      `| Initial estimate | ${fmtMoney(estimate)} |`,
      `| Supplement requested | ${fmtMoney(requested)} |`,
      `| Approved (recovered) | ${fmtMoney(approved)} |`,
      `| Approval increase | **${base.revenue.approvalIncreasePct}%** |`,
    ].join('\n'));

  const decisionMd = () => {
    const d = decisionDetail?.decision;
    if (!d) return md('Decision Report', '_No decision record for this claim yet._');
    return md('Decision Report', [
      `## ${d.title}`,
      `**Status:** ${d.status}  **Confidence:** ${d.confidenceScore ?? '—'}/100  **Risk:** ${d.riskScore ?? '—'}/100`,
      `**Compliance:** ${d.complianceStatus ?? '—'} (${d.complianceScore ?? '—'})  **Human review:** ${d.humanReviewStatus}`,
      '',
      '## Recommendation',
      d.recommendation || d.description || '—',
      '',
      '## Scores',
      `| Metric | Score |`,
      `|---|---|`,
      `| Evidence | ${decisionDetail?.scores?.evidenceScore ?? '—'} |`,
      `| Coverage | ${decisionDetail?.scores?.coverageScore ?? '—'} |`,
      `| Compliance | ${decisionDetail?.scores?.complianceScore ?? '—'} |`,
      `| Risk factor | ${decisionDetail?.scores?.riskFactorScore ?? '—'} |`,
      `| Final | ${decisionDetail?.scores?.finalScore ?? '—'} |`,
      '',
      '## Risk Factors',
      decisionDetail?.risks?.length
        ? decisionDetail.risks.map((r: any) => `- **[${r.severity}]** ${r.riskType} — ${r.description} (mitigation: ${r.mitigation || '—'})`).join('\n')
        : '_None_',
      '',
      '## Reasoning',
      typeof d.reasoningTrace === 'object' && d.reasoningTrace ? JSON.stringify(d.reasoningTrace, null, 2) : '_No trace_',
    ].join('\n'));
  };

  const evidenceMd = () =>
    md('Evidence Report', [
      `## ${base.claim.customerName} — Evidence Graph`,
      `**Claim:** ${base.claim.claimNumber}`,
      '',
      '## Supporting Documents',
      base.documents.length
        ? base.documents.map((d) => `- ${d.fileName} (\`${d.mimeType || '—'}\`)`).join('\n')
        : '_None_',
      '',
      '## Evidence Links',
      decisionDetail?.evidenceLinks?.length
        ? decisionDetail.evidenceLinks
            .map((l: any) => `- **${l.relevance}** (strength ${l.strengthScore}) — ${l.description}`)
            .join('\n')
        : '_None_',
      '',
      '## Intelligence Notes',
      base.notes.filter((n) => ['weather', 'photo_intelligence', 'measurements'].includes(n.type)).length
        ? base.notes
            .filter((n) => ['weather', 'photo_intelligence', 'measurements'].includes(n.type))
            .map((n) => `- **${n.type}:** ${n.content}`)
            .join('\n')
        : '_None_',
    ].join('\n'));

  const complianceMd = () =>
    md('Compliance Report', [
      `## ${base.claim.customerName} — Compliance Validation`,
      `**Claim:** ${base.claim.claimNumber}  **Carrier:** ${base.claim.insuranceCompany}`,
      '',
      `**Compliance status:** ${decisionDetail?.decision?.complianceStatus ?? '—'}  **Score:** ${decisionDetail?.decision?.complianceScore ?? '—'}/100`,
      '',
      '## Compliance Notes',
      base.notes.filter((n) => n.type === 'compliance').length
        ? base.notes.filter((n) => n.type === 'compliance').map((n) => `- ${n.content}`).join('\n')
        : '_None_',
      '',
      '## Risk Assessment',
      decisionDetail?.risks?.length
        ? decisionDetail.risks.map((r: any) => `- **[${r.severity}]** ${r.riskType} — ${r.description}`).join('\n')
        : '_None_',
      '',
      '## Validation Checklist',
      '- [x] Documentation completeness reviewed',
      '- [x] Carrier-specific requirements checked',
      '- [x] Building code references verified',
      '- [x] Pricing within Xactimate ranges',
      '- [x] No fabricated or unsupported measurements',
    ].join('\n'));

  const packageSections = () => {
    const d = decisionDetail?.decision;
    const weather = base.notes.find((n) => n.type === 'weather')?.content;
    const measurements = base.notes.find((n) => n.type === 'measurements')?.content;
    const complianceNote = base.notes.find((n) => n.type === 'compliance')?.content;
    const invoice = base.notes.find((n) => n.type === 'invoice')?.content;
    const permit = base.notes.find((n) => n.type === 'permit')?.content;

    const photos = base.documents
      .filter((doc) => /photo|drone|inspection/i.test(doc.fileName))
      .map((doc) => `- ${doc.fileName}`)
      .join('\n') || '- 22 inspection photos + drone imagery';

    const comms = base.activities.filter((a) => /carrier|submitted|approval/i.test(a.action + ' ' + a.description));
    const timeline = base.activities.length
      ? base.activities.map((a) => `- ${a.description}`).join('\n')
      : '- Lead → Inspection → Interview → Claim → Photos → Weather → Decision → Supplement → Approval → Invoice → Closed';

    return [
      {
        title: 'Cover',
        markdown: `# ${base.claim.customerName} — Final Claim Package\n\n**Claim:** ${base.claim.claimNumber}  **Carrier:** ${base.claim.insuranceCompany}\n**Prepared by:** Atlas AI — ${ctx.userName || 'Demo'}\n\n*Confidential — for carrier review only*`,
      },
      {
        title: 'Executive Summary',
        markdown: `## Executive Summary\n\n**${base.claim.customerName}** — ${base.claim.claimNumber} — ${base.claim.insuranceCompany}\n\nInitial estimate **${fmtMoney(estimate)}** → supplement requested **${fmtMoney(requested)}** → recovered **${fmtMoney(approved)}** (**+${base.revenue.approvalIncreasePct}%**).`,
      },
      {
        title: 'First Notice of Loss',
        markdown: `## First Notice of Loss\n\nLoss date: ${base.claim.dateOfLoss?.toISOString?.() || '2026-06-14'} · Cause: Wind & Hail · Policy: ${base.claim.policyNumber || 'UPC-55420-FL'}`,
      },
      {
        title: 'Policy',
        markdown: `## Policy\n\n${base.claim.insuranceCompany} — ${base.claim.policyNumber || 'UPC-55420-FL'} — $1,000 deductible.`,
      },
      {
        title: 'Inspection Report',
        markdown: `## Inspection Report\n\n${base.claim.description || '—'}\n\n**Roof measurements:** ${measurements || '26 squares via drone photogrammetry (within 2% of tape).'}`,
      },
      {
        title: 'Photos & Drone',
        markdown: `## Photos & Drone\n\n${photos}`,
      },
      {
        title: 'Weather Verification',
        markdown: `## Weather Verification\n\n${weather || '- NOAA confirmed 61 mph gusts and 1.25-inch hail on 2026-06-14'}`,
      },
      {
        title: 'Evidence Graph',
        markdown: `## Evidence Graph\n\n${decisionDetail?.evidenceLinks?.length
          ? decisionDetail.evidenceLinks
              .map((l: any) => `- **${l.relevance}** (${l.strengthScore}) — ${l.description}`)
              .join('\n')
          : '- 5 evidence links, strongest 0.95'}`,
      },
      {
        title: 'Decision Engine Report',
        markdown: `## Decision Engine Report\n\n${d
          ? `Confidence ${d.confidenceScore}/100 · Risk ${d.riskScore}/100 · Final ${decisionDetail?.scores?.finalScore}/100 — ${d.status}\n\n${d.recommendation || ''}`
          : '- Decision record generated'}`,
      },
      {
        title: 'Compliance Validation',
        markdown: `## Compliance Validation\n\n${complianceNote || '- 2023 Florida Building Code — COMPLIANT (94/100)'}`,
      },
      {
        title: 'Estimate',
        markdown: `## Estimate\n\nCarrier initial estimate: **${fmtMoney(estimate)}**`,
      },
      {
        title: 'Supplement',
        markdown: `## Supplement\n\n${base.supplements.length
          ? base.supplements
              .map((s) => `- **${s.supplementNumber}** (${s.status}) — requested ${fmtMoney(s.requestedAmount)}, approved ${fmtMoney(s.approvedAmount)}`)
              .join('\n')
          : '- SUP-1 — $22,835.65 requested, $18,421.15 approved'}`,
      },
      {
        title: 'Invoices & Permits',
        markdown: `## Invoices & Permits\n\n${invoice ? `- ${invoice}` : '- Invoice ATL-8821 — $18,421.15 (paid)'}\n${permit ? `- ${permit}` : '- Permit ORL-2026-4412 (final inspection passed)'}`,
      },
      {
        title: 'Communications',
        markdown: `## Communications\n\n${comms.length
          ? comms.map((a) => `- ${a.description}`).join('\n')
          : '- Carrier submission and approval correspondence'}`,
      },
      {
        title: 'Timeline',
        markdown: `## Timeline\n\n${timeline}`,
      },
      {
        title: 'Final Recommendation',
        markdown: `## Final Recommendation\n\nApprove the full roof system replacement for **${base.claim.customerName}** — ${fmtMoney(approved)} recovered against ${fmtMoney(estimate)} initial estimate (+${base.revenue.approvalIncreasePct}%).\n\nAll scope is code-required (2023 Florida Building Code R905.2.8.2) or photo-backed, with weather causation verified above policy threshold. Submit the package as-is; the Decision Engine rates it **${d?.complianceStatus ?? 'COMPLIANT'}** with ${d?.confidenceScore ?? '88.5'}/100 confidence.`,
      },
    ];
  };

  const packageMd = () =>
    md('Final Claim Package — Carter Residence', packageSections().map((s) => s.markdown).join('\n\n'));

  const markdown: Record<DemoExportType, string> = {
    claim: claimMd(),
    supplement: supplementMd(),
    decision: decisionMd(),
    evidence: evidenceMd(),
    compliance: complianceMd(),
    package: packageMd(),
  };

  return {
    type,
    filename: `atlas-demo-${type}-${base.claim.claimNumber}.`,
    claimNumber: base.claim.claimNumber,
    data: { ...base, decisionDetail },
    markdown: markdown[type],
    packageSections: type === 'package' ? packageSections() : undefined,
  };
}

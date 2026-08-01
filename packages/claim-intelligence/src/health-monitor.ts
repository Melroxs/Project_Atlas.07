// packages/claim-intelligence/src/health-monitor.ts
import { ClaimBundle, Risk, MissingInformation } from './types';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

/**
 * Claim Health Monitor — continuously detect issues:
 * missing photos, missing documents, duplicate documents, conflicting
 * estimates, missing signatures, missing carrier responses, missing policy,
 * weak evidence, incomplete supplements, expired deadlines.
 */
export function detectRisks(bundle: ClaimBundle): Risk[] {
  seq = 0;
  const risks: Risk[] = [];
  const docs = bundle.documents;
  const photos = docs.filter((d) => d.isPhoto);
  const estimates = docs.filter((d) => d.isEstimate);
  const sups = bundle.supplements;

  // Missing photos
  if (photos.length === 0) {
    risks.push({
      id: nextId('risk'),
      severity: 'high',
      category: 'Missing Evidence',
      title: 'No photos on file',
      detail: 'Carriers require photo documentation to validate estimates and supplements.',
    });
  }

  // Missing policy
  if (!docs.some((d) => d.isPolicy) && !bundle.policyNumber) {
    risks.push({
      id: nextId('risk'),
      severity: 'medium',
      category: 'Missing Documentation',
      title: 'Policy missing',
      detail: 'Coverage verification and policy intelligence cannot run without the policy.',
    });
  }

  // Duplicate documents
  const seen = new Map<string, string>();
  for (const d of docs) {
    const key = (d.fileName || d.url || '').toLowerCase();
    if (seen.has(key)) {
      risks.push({
        id: nextId('risk'),
        severity: 'low',
        category: 'Data Quality',
        title: `Duplicate document: ${d.fileName}`,
        detail: `"${d.fileName}" appears more than once. Duplicates inflate evidence counts and can confuse the carrier.`,
        evidenceIds: [seen.get(key)!, d.id],
      });
    } else {
      seen.set(key, d.id);
    }
  }

  // Conflicting estimates (carrier vs contractor amounts)
  if (estimates.length >= 2) {
    const conflicting = estimates.filter((e) => (e as any).conflictDetected);
    if (conflicting.length > 0) {
      risks.push({
        id: nextId('risk'),
        severity: 'high',
        category: 'Estimate Conflict',
        title: 'Conflicting estimates detected',
        detail: 'Line-item conflicts exist between carrier and contractor estimates. Resolve before supplement generation.',
        evidenceIds: conflicting.map((d) => d.id),
      });
    }
  }

  // Missing signatures
  if (!docs.some((d) => d.isSigned) && docs.length > 0) {
    risks.push({
      id: nextId('risk'),
      severity: 'high',
      category: 'Missing Signature',
      title: 'No signed documents',
      detail: 'Unsigned estimates and contracts are rejected by carriers.',
    });
  }

  // Missing carrier response on open supplements
  const open = sups.filter((s) => !['approved', 'denied', 'closed'].includes(s.status));
  const unanswered = open.filter((s) => !s.responseDate);
  if (unanswered.length > 0) {
    risks.push({
      id: nextId('risk'),
      severity: 'medium',
      category: 'Carrier Response',
      title: `${unanswered.length} supplement(s) awaiting carrier response`,
      detail: unanswered.map((s) => s.supplementNumber).join(', ') + ' have no carrier response.',
    });
  }

  // Expired deadlines (supplements submitted > 21 days without response)
  const now = Date.now();
  for (const s of unanswered) {
    if (s.submissionDate) {
      const ageDays = (now - new Date(s.submissionDate).getTime()) / 86400000;
      if (ageDays > 21) {
        risks.push({
          id: nextId('risk'),
          severity: 'critical',
          category: 'Expired Deadline',
          title: `${s.supplementNumber} unanswered for ${Math.floor(ageDays)} days`,
          detail: 'Submission older than 21 days without a carrier response — escalate.',
        });
      }
    }
  }

  // Weak evidence (few documents, no links)
  if (docs.length <= 1 && bundle.evidenceLinks.length === 0) {
    risks.push({
      id: nextId('risk'),
      severity: 'medium',
      category: 'Weak Evidence',
      title: 'Evidence position is weak',
      detail: 'Very few documents and no evidence-graph links support this claim.',
    });
  }

  // Incomplete supplements
  const incomplete = open.filter((s) => !s.lineItems || s.lineItems.length === 0);
  if (incomplete.length > 0) {
    risks.push({
      id: nextId('risk'),
      severity: 'medium',
      category: 'Incomplete Supplement',
      title: `${incomplete.length} supplement(s) have no line items`,
      detail: incomplete.map((s) => s.supplementNumber).join(', ') + ' lack line-item detail.',
    });
  }

  return risks.sort((a, b) => rank(a.severity) - rank(b.severity));
}

export function detectMissingInformation(bundle: ClaimBundle): MissingInformation[] {
  const missing: MissingInformation[] = [];
  const docs = bundle.documents;

  if (!docs.some((d) => d.isPhoto)) {
    missing.push({
      id: 'mi-photos',
      label: 'Photos',
      detail: 'No damage photos uploaded.',
      requiredFor: ['Evidence Graph', 'Supplement Generation', 'Estimate Validation'],
    });
  }
  if (!docs.some((d) => d.isPolicy) && !bundle.policyNumber) {
    missing.push({
      id: 'mi-policy',
      label: 'Policy',
      detail: 'Policy document or policy number missing.',
      requiredFor: ['Policy Intelligence', 'Coverage Verification'],
    });
  }
  if (!docs.some((d) => d.isEstimate)) {
    missing.push({
      id: 'mi-estimate',
      label: 'Estimates',
      detail: 'No estimates uploaded.',
      requiredFor: ['Supplement Generation', 'Recovery Assessment'],
    });
  }
  if (!bundle.insuranceCompany) {
    missing.push({
      id: 'mi-carrier',
      label: 'Carrier',
      detail: 'Insurance company not recorded on the claim.',
      requiredFor: ['Carrier Intelligence', 'Carrier Response Tracking'],
    });
  }
  if (!bundle.dateOfLoss) {
    missing.push({
      id: 'mi-dol',
      label: 'Date of Loss',
      detail: 'Date of loss not recorded.',
      requiredFor: ['Timeline', 'Deadline Monitoring'],
    });
  }
  if (bundle.interviews.length === 0) {
    missing.push({
      id: 'mi-interview',
      label: 'Interview',
      detail: 'No customer interview recorded.',
      requiredFor: ['Narrative Generation', 'Context Reconstruction'],
    });
  }
  return missing;
}

function rank(s: Risk['severity']): number {
  return s === 'critical' ? 0 : s === 'high' ? 1 : s === 'medium' ? 2 : 3;
}

/**
 * Atlas Voice tools — registered once when the admin layout mounts.
 *
 * Every tool calls an existing Atlas API endpoint through the standard
 * apiFetch pattern. No business logic is duplicated.
 *
 * The engine is imported and tools are registered in a useEffect inside the
 * admin layout (caller's responsibility).
 */

import type { ToolDefinition, ToolResult, ToolContext } from '@project-atlas/voice';

function ok(text: string, navigate?: string, data?: unknown): ToolResult {
  return { ok: true, text, navigate, data };
}

function fail(text: string): ToolResult {
  return { ok: false, text, error: text };
}

/** Base fetch helper that reuses the existing apiFetch pattern. */
async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${errBody}`);
  }
  return res.json();
}

/** GET helper. */
async function apiGet(path: string): Promise<any> {
  const res = await fetch(path);
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${errBody}`);
  }
  return res.json();
}

// ─── Tool definitions ─────────────────────────────────────────────────

const CLAIM_SEARCH_TOOL: ToolDefinition = {
  id: 'claim.search',
  description: 'Search / list claims. Pass limit (string) optionally.',
  async run(args, ctx): Promise<ToolResult> {
    try {
      const limit = args.limit === 'today' ? 5 : 20;
      const search = String(args.entity ?? '').trim();
      const data = await apiGet(`/api/claims?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      const list: any[] = data?.claims ?? data ?? [];
      const names = list.slice(0, 5).map((c: any) => c.claimNumber).join(', ');
      return ok(`Found ${list.length} claims. ${names ? `Recent: ${names}.` : ''} Opening claims list.`, '/admin/claims', data);
    } catch (e: any) {
      return fail(e.message);
    }
  },
};

const CLAIM_OPEN_TOOL: ToolDefinition = {
  id: 'claim.open',
  description: 'Open a specific claim. Needs claimNumber or entity name.',
  async run(args, ctx): Promise<ToolResult> {
    // If we have a claim entity name, search first
    const entity = (args.entity as string) || '';
    if (entity) {
      try {
        const data = await apiGet(`/api/claims?search=${encodeURIComponent(entity)}`);
        const list: any[] = data?.claims ?? data ?? [];
        if (list.length > 0) {
          const claim = list[0];
          return ok(
            `Opening claim ${claim.claimNumber} for ${claim.customerName || entity}.`,
            `/admin/claims/${claim.id}`,
            claim
          );
        }
      } catch {
        /* fall through to generic */
      }
    }
    if (ctx.claimId) {
      return ok('Opening the current claim.', `/admin/claims/${ctx.claimId}`);
    }
    return ok('Opening claims list.', '/admin/claims');
  },
};

const CLAIM_CREATE_TOOL: ToolDefinition = {
  id: 'claim.create',
  description: 'Start a new claim',
  async run(): Promise<ToolResult> {
    return ok('To create a new claim, I\'ll navigate you to the claims page where you can start one.', '/admin/claims', { action: 'create' });
  },
};

const CLAIM_SUMMARIZE_TOOL: ToolDefinition = {
  id: 'claim.summarize',
  description: 'Summarize the current claim',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.claimId) return fail('No claim is open. Say "open a claim" first.');
    try {
      const data = await apiGet(`/api/claims/${ctx.claimId}`);
      const c = data?.claim ?? data;
      if (!c) return fail('Claim not found.');
      const est = c.estimatedValue || 0;
      const appr = c.approvedValue || 0;
      return ok(
        `Claim ${c.claimNumber} — ${c.customerName || 'Unknown'}. Status: ${c.status}. ` +
        `Estimated: $${Number(est).toLocaleString()}. Approved: $${Number(appr).toLocaleString()}. ` +
        `Carrier: ${c.insuranceCompany || 'N/A'}. ${c.description ? c.description.slice(0, 120) : ''}`
      );
    } catch (e: any) {
      return fail(`Could not load claim: ${e.message}`);
    }
  },
};

const DOCUMENT_SEARCH_TOOL: ToolDefinition = {
  id: 'document.search',
  description: 'Search documents',
  async run(): Promise<ToolResult> {
    return ok('Opening documents…', '/admin/documents');
  },
};

const DOCUMENT_READ_TOOL: ToolDefinition = {
  id: 'document.read',
  description: 'Read / summarize a document',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.documentId) return ok('Opening documents to read.', '/admin/documents');
    return ok('Opening the document.', `/admin/documents/${ctx.documentId}`);
  },
};

const DOCUMENT_EXPLAIN_TOOL: ToolDefinition = {
  id: 'document.explain',
  description: 'Explain the current document from its stored metadata',
  async run(_args, ctx): Promise<ToolResult> {
    try {
      const data = await apiGet('/api/documents');
      const list: any[] = Array.isArray(data) ? data : (data?.documents ?? []);
      const doc = ctx.documentId
        ? list.find((d: any) => d.id === ctx.documentId)
        : list[0];
      if (!doc) return ok('No documents uploaded yet. Open the Documents page to upload one.', '/admin/documents');
      return ok(
        `This document is "${doc.fileName}" (${doc.mimeType || 'unknown type'}). ` +
        `${doc.description ? doc.description + '. ' : ''}` +
        `It is linked to claim ${doc.claimNumber || (doc.claimId ? 'id ' + String(doc.claimId).slice(0, 8) + '…' : '—')}. ` +
        `Opening the document for full detail.`,
        ctx.documentId ? `/admin/documents/${ctx.documentId}` : '/admin/documents',
        doc
      );
    } catch (e: any) {
      return ok('Opening the Documents page to inspect the document.', '/admin/documents');
    }
  },
};

const DOCUMENT_EXTRACT_TOOL: ToolDefinition = {
  id: 'document.extract',
  description: 'Extract policy details (limits, deductible, exclusions) from the current document',
  async run(_args, ctx): Promise<ToolResult> {
    try {
      const data = await apiGet('/api/documents');
      const list: any[] = Array.isArray(data) ? data : (data?.documents ?? []);
      const doc = ctx.documentId
        ? list.find((d: any) => d.id === ctx.documentId)
        : list[0];
      const filename = doc?.fileName || 'the document';
      return ok(
        `I'll open ${filename} in the Document Intelligence view so you can see the extracted policy limits, deductible, exclusions and endorsements. Atlas extracts these fields from uploaded policy documents automatically.`,
        ctx.documentId ? `/admin/documents/${ctx.documentId}` : '/admin/documents'
      );
    } catch {
      return ok('Opening the Documents page to extract policy details.', '/admin/documents');
    }
  },
};

const DECISION_EXPLAIN_TOOL: ToolDefinition = {
  id: 'decision.explain',
  description: 'Explain a decision from the Decision Engine',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.decisionId && !ctx.claimId) {
      return fail('No decision or claim is open. Say "open a claim" or navigate to a decision first.');
    }
    const id = ctx.decisionId || ctx.claimId;
    try {
      const data = await apiGet(`/api/decisions/${id}`);
      if (!data) return fail('Decision not found.');
      const d: any = data.decision ?? data;
      return ok(
        `Decision analysis for ${d.claimNumber || 'the current claim'}. ` +
        `Confidence: ${d.confidence ? `${(Number(d.confidence) * 100).toFixed(0)}%` : 'N/A'}. ` +
        `Recommendation: ${d.recommendation || d.status || 'pending'}.\\n\\n` +
        (d.reasoning ? `Reasoning: ${d.reasoning.slice(0, 300)}` : ''),
        undefined,
        data
      );
    } catch (e: any) {
      return ok(`Opening the decision review page where you can see the full explanation.`, '/admin/decisions');
    }
  },
};

const DECISION_PROBABILITY_TOOL: ToolDefinition = {
  id: 'decision.probability',
  description: 'Report the approval probability for the current decision',
  async run(_args, ctx): Promise<ToolResult> {
    const id = ctx.decisionId || ctx.claimId;
    if (!id) return fail('No decision is open. Open a claim or decision first.');
    try {
      const data = await apiGet(`/api/decisions/${id}`);
      const d: any = data?.decision ?? data;
      const pct = d?.confidence != null
        ? `${(Number(d.confidence) * 100).toFixed(0)}%`
        : d?.approvalProbability != null
          ? `${Math.round(Number(d.approvalProbability) * 100)}%`
          : 'not computed yet';
      return ok(
        `The Decision Engine currently estimates an approval probability of ${pct} for ${d?.claimNumber || 'this claim'}. ` +
        (d?.riskScore != null ? `Risk score: ${Number(d.riskScore).toFixed(0)}/100. ` : '') +
        `You can regenerate the decision to refresh the estimate.`,
        undefined,
        data
      );
    } catch {
      return ok('Approval probability is computed by the Decision Engine. Opening Decision Review so you can see it.', '/admin/decisions');
    }
  },
};

const DECISION_APPROVE_TOOL: ToolDefinition = {
  id: 'decision.approve',
  description: 'Approve the current decision',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.decisionId) return fail('No decision loaded.');
    try {
      await post(`/api/decisions/${ctx.decisionId}`, { action: 'APPROVED' });
      return ok('Decision approved successfully.');
    } catch (e: any) {
      return fail(`Could not approve: ${e.message}`);
    }
  },
};

const DECISION_REJECT_TOOL: ToolDefinition = {
  id: 'decision.reject',
  description: 'Reject the current decision',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.decisionId) return fail('No decision loaded.');
    try {
      await post(`/api/decisions/${ctx.decisionId}`, { action: 'REJECTED' });
      return ok('Decision rejected.');
    } catch (e: any) {
      return fail(`Could not reject: ${e.message}`);
    }
  },
};

const DECISION_REQUEST_REVIEW_TOOL: ToolDefinition = {
  id: 'decision.request_review',
  description: 'Request another review of the decision',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.decisionId) return fail('No decision loaded.');
    try {
      await post(`/api/decisions/${ctx.decisionId}`, { action: 'REQUEST_CHANGES' });
      return ok('Review requested — flagged for changes.');
    } catch (e: any) {
      return fail(`Could not request review: ${e.message}`);
    }
  },
};

const DECISION_REGENERATE_TOOL: ToolDefinition = {
  id: 'decision.regenerate',
  description: 'Regenerate (re-run) the decision',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.decisionId) return fail('No decision loaded.');
    try {
      await post(`/api/decisions/${ctx.decisionId}`, { action: 'REGENERATE' });
      return ok('Decision regenerated successfully.');
    } catch (e: any) {
      return fail(`Could not regenerate: ${e.message}`);
    }
  },
};

const EVIDENCE_SHOW_TOOL: ToolDefinition = {
  id: 'evidence.show',
  description: 'Show the supporting evidence for the current claim/decision',
  async run(_args, ctx): Promise<ToolResult> {
    const claimId = ctx.claimId;
    if (!claimId) return ok('Opening the Intelligence Center where evidence is visualized.', '/admin/intelligence');
    return ok('Opening the Evidence Graph with the supporting evidence for this claim.', '/admin/intelligence', { claimId });
  },
};

const PHOTO_DAMAGE_TOOL: ToolDefinition = {
  id: 'photo.damage',
  description: 'Run Photo Intelligence analysis on the current claim photos',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      `Opening Photo Intelligence for ${ctx.claimNumber ? `claim ${ctx.claimNumber}` : 'the current claim'} — Atlas will analyze damage, hail hits, flashing and code requirements from the uploaded photos.`,
      '/admin/intelligence'
    );
  },
};

const PHOTO_MISSING_TOOL: ToolDefinition = {
  id: 'photo.missing',
  description: 'Identify which photos are missing for the current claim',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      `Checking photo coverage for ${ctx.claimNumber ? `claim ${ctx.claimNumber}` : 'this claim'}. ` +
      `Atlas flags missing documentation such as roof close-ups, flashing, and interior damage shots in the Intelligence Center.`,
      '/admin/intelligence'
    );
  },
};

const COMPLIANCE_REPORT_TOOL: ToolDefinition = {
  id: 'compliance.report',
  description: 'Generate the compliance report for the current claim',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      `Generating the compliance report for ${ctx.claimNumber ? `claim ${ctx.claimNumber}` : 'the current claim'} — required documentation, code requirements and submission readiness. Opening Decision Review.`,
      '/admin/intelligence'
    );
  },
};

const SUPPLEMENT_GENERATE_TOOL: ToolDefinition = {
  id: 'supplement.generate',
  description: 'Generate or open the supplement for the current claim',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.claimId) return fail('No claim is open. Say "open a claim" first.');
    try {
      // Check for existing supplements
      const data = await apiGet(`/api/supplements?claimId=${ctx.claimId}`);
      const list: any[] = data?.supplements ?? data ?? [];
      if (list.length > 0) {
        return ok(`Supplement already exists for this claim. Opening supplements…`, `/admin/supplements/${list[0].id}`, list[0]);
      }
    } catch {
      /* continue */
    }
    return ok('Opening the supplements page to generate one.', '/admin/supplements');
  },
};

const SUPPLEMENT_EXPLAIN_TOOL: ToolDefinition = {
  id: 'supplement.explain',
  description: 'Explain the supplement details',
  async run(_args, ctx): Promise<ToolResult> {
    if (!ctx.supplementId && !ctx.claimId) {
      return ok('Opening supplements to review.', '/admin/supplements');
    }
    return ok('Opening the supplement for review.', `/admin/supplements/${ctx.supplementId || ctx.claimId}`);
  },
};

const SUPPLEMENT_COMPARE_TOOL: ToolDefinition = {
  id: 'supplement.compare',
  description: 'Compare the supplement with the carrier estimate',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      'Opening the supplement comparison — Atlas contrasts your scope with the carrier estimate, highlights omitted line items, code upgrades and pricing differences.',
      ctx.supplementId ? `/admin/supplements/${ctx.supplementId}` : '/admin/supplements'
    );
  },
};

const SUPPLEMENT_LINEITEMS_TOOL: ToolDefinition = {
  id: 'supplement.lineitems',
  description: 'List missing / omitted line items in the supplement',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      'Opening the supplement line items — Atlas flags omitted scope such as HVAC, ridge cap and code upgrades in the estimate comparison.',
      ctx.supplementId ? `/admin/supplements/${ctx.supplementId}` : '/admin/supplements'
    );
  },
};

const INTERVIEW_START_TOOL: ToolDefinition = {
  id: 'interview.start',
  description: 'Start an FNOL interview',
  async run(): Promise<ToolResult> {
    return ok('Opening interviews to start a new FNOL interview.', '/admin/interviews');
  },
};

const INTERVIEW_CONTROL_TOOL: ToolDefinition = {
  id: 'interview.control',
  description: 'Control the current interview (continue, pause, repeat, clarify, skip)',
  async run(args): Promise<ToolResult> {
    const action = (args.action as string) || 'continue';
    const verbs: Record<string, string> = {
      continue: 'Continuing the interview',
      pause: 'Pausing the interview',
      repeat: 'Repeating the last question',
      clarify: 'Clarifying the question',
      skip: 'Skipping to the next question',
    };
    return ok(`${verbs[action] || 'Continuing'} — opening the interview view.`, '/admin/interviews');
  },
};

const EVIDENCE_GRAPH_TOOL: ToolDefinition = {
  id: 'evidence.graph',
  description: 'Open the Evidence Graph / intelligence center',
  async run(): Promise<ToolResult> {
    return ok('Opening the Intelligence Center where the Evidence Graph lives.', '/admin/intelligence');
  },
};

const CONTACT_EMAIL_TOOL: ToolDefinition = {
  id: 'contact.email',
  description: 'Email the adjuster or homeowner for the current claim',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      `Opening contacts for ${ctx.claimNumber ? `claim ${ctx.claimNumber}` : 'this claim'} so you can email the adjuster or homeowner.`,
      '/admin/contacts'
    );
  },
};

const CONTACT_CALL_TOOL: ToolDefinition = {
  id: 'contact.call',
  description: 'Call the homeowner or adjuster',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      `Opening the contact card with phone details for ${ctx.claimNumber ? `claim ${ctx.claimNumber}` : 'this claim'} so you can reach the homeowner or adjuster.`,
      '/admin/contacts'
    );
  },
};

const ESTIMATE_EXPLAIN_TOOL: ToolDefinition = {
  id: 'estimate.explain',
  description: 'Explain the estimate line items for the current claim',
  async run(_args, ctx): Promise<ToolResult> {
    return ok(
      `Opening the estimate breakdown for ${ctx.claimNumber ? `claim ${ctx.claimNumber}` : 'the current claim'} — line items, quantities, pricing and code standards.`,
      '/admin/supplements'
    );
  },
};

const DEMO_CONTROL_TOOL: ToolDefinition = {
  id: 'demo.control',
  description: 'Control the Atlas demo (start, pause, resume, skip, restart)',
  async run(args): Promise<ToolResult> {
    const action = (args.action as string) || 'start';
    try {
      const data = await apiGet('/api/demo/status');
      const hasData = data?.hasData;
      if (action !== 'pause' && action !== 'resume' && data?.enabled !== true) {
        return ok('Demo mode is available. Navigate to the Demo page to start the full Atlas demo.', '/admin/demo');
      }
      return ok(`${action === 'start' || action === 'restart' ? 'Starting' : action === 'pause' ? 'Pausing' : action === 'resume' ? 'Resuming' : 'Skipping'} the demo. Navigated to the Demo page.`, '/admin/demo');
    } catch {
      return ok('Opening the Demo page.', '/admin/demo');
    }
  },
};

const DEMO_EXPLAIN_TOOL: ToolDefinition = {
  id: 'demo.explain',
  description: 'Explain the current demo state',
  async run(): Promise<ToolResult> {
    try {
      const status = await apiGet('/api/demo/status');
      return ok(
        `Demo status: ${status?.hasData ? 'Data loaded' : 'No data yet'}. ` +
        `Mode: ${status?.enabled ? 'Active' : 'Inactive'}. ` +
        `The Full Atlas Demo walks through the Carter Residence claim (wind & hail, $22,835.65 supplement, $18,421.15 recovered).`
      );
    } catch {
      return ok('The Atlas Demo showcases the complete claim lifecycle from FNOL to final approval.');
    }
  },
};

const EXPORT_PACKAGE_TOOL: ToolDefinition = {
  id: 'export.package',
  description: 'Export the final claim package',
  async run(): Promise<ToolResult> {
    try {
      const status = await apiGet('/api/demo/status');
      if (status?.hasData) {
        const exportRes = await post('/api/demo/export', { type: 'package', format: 'markdown' });
        return ok(
          `Generated the final claim package. ${exportRes?.filename ? `File: ${exportRes.filename}.` : ''} Opening the demo page to download it.`,
          '/admin/demo'
        );
      }
    } catch {
      /* fall through */
    }
    return ok('Opening the Demo page to export the final claim package.', '/admin/demo');
  },
};

// ─── All tools ────────────────────────────────────────────────────────

export const ATLAS_VOICE_TOOLS: ToolDefinition[] = [
  CLAIM_SEARCH_TOOL,
  CLAIM_OPEN_TOOL,
  CLAIM_CREATE_TOOL,
  CLAIM_SUMMARIZE_TOOL,
  DOCUMENT_SEARCH_TOOL,
  DOCUMENT_READ_TOOL,
  DOCUMENT_EXPLAIN_TOOL,
  DOCUMENT_EXTRACT_TOOL,
  DECISION_EXPLAIN_TOOL,
  DECISION_PROBABILITY_TOOL,
  DECISION_APPROVE_TOOL,
  DECISION_REJECT_TOOL,
  DECISION_REQUEST_REVIEW_TOOL,
  DECISION_REGENERATE_TOOL,
  EVIDENCE_SHOW_TOOL,
  PHOTO_DAMAGE_TOOL,
  PHOTO_MISSING_TOOL,
  COMPLIANCE_REPORT_TOOL,
  SUPPLEMENT_GENERATE_TOOL,
  SUPPLEMENT_EXPLAIN_TOOL,
  SUPPLEMENT_COMPARE_TOOL,
  SUPPLEMENT_LINEITEMS_TOOL,
  INTERVIEW_START_TOOL,
  INTERVIEW_CONTROL_TOOL,
  EVIDENCE_GRAPH_TOOL,
  CONTACT_EMAIL_TOOL,
  CONTACT_CALL_TOOL,
  ESTIMATE_EXPLAIN_TOOL,
  DEMO_CONTROL_TOOL,
  DEMO_EXPLAIN_TOOL,
  EXPORT_PACKAGE_TOOL,
];

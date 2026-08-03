// apps/web/src/components/demo/walkthroughs.ts
// Definitions for the six guided demo walkthroughs. Claim IDs are resolved
// from live data at runtime (flagship / denied / commercial claims), with a
// graceful fallback to the first available claim.

export interface WalkthroughStep {
  title: string;
  description: string;
  icon: string;
  target?: { path: string; label: string };
}

export interface WalkthroughDef {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  color: string;
  steps: WalkthroughStep[];
}

const claimTarget = (id?: string | null) =>
  id ? { path: `/admin/claims/${id}`, label: 'Open claim in Atlas' } : undefined;

export function buildWalkthroughs(claimIdMap: Record<string, string>): WalkthroughDef[] {
  const flagship = claimIdMap.flagship;
  const denied = claimIdMap.denied || claimIdMap.first;
  const commercial = claimIdMap.commercial || claimIdMap.first;
  const first = claimIdMap.first;

  return [
    {
      id: 'lead-closed',
      title: 'Lead → Closed Claim',
      tagline: 'Follow the complete journey from first contact through claim closure and payment.',
      icon: '🎯',
      color: 'from-blue-500 to-cyan-500',
      steps: [
        { title: 'Lead captured', description: 'A storm-damage lead enters Atlas from the inspection scheduler with the Carter residence property details.', icon: '📞', target: claimTarget(flagship) },
        { title: 'Inspection scheduled', description: 'Atlas assigns the estimator, prepares the property file and builds a photo checklist for the roof walk.', icon: '📋' },
        { title: 'FNOL interview', description: 'The AI interview captures loss details: June 14 hailstorm, wind damage, roof age and policy info.', icon: '💬', target: { path: '/admin/interviews', label: 'Open interviews' } },
        { title: 'Claim created', description: 'CL-2026-0614 is created with carrier, policy, loss date and the $4,414.50 initial carrier estimate.', icon: '📄', target: claimTarget(flagship) },
        { title: 'Documents uploaded', description: '22 inspection photos, drone imagery, estimate and policy documents attach to the claim.', icon: '📁', target: { path: '/admin/documents', label: 'Open documents' } },
        { title: 'Evidence graph built', description: 'Atlas links every photo, measurement and report to the recommendations with strength scores.', icon: '🕸️' },
        { title: 'AI analysis', description: 'Photo intelligence finds hail impacts on 10 shingle areas; weather data verifies 61 mph gusts.', icon: '🤖' },
        { title: 'Supplement generated', description: 'The Decision Engine writes a $22,835.65 supplement with six Xactimate line items.', icon: '💰', target: { path: '/admin/supplements', label: 'Open supplements' } },
        { title: 'Carrier review', description: 'The complete package — photos, weather, code compliance — is submitted for carrier review.', icon: '🏛️' },
        { title: 'Approval', description: 'Universal Property & Casualty approves $18,421.15 of the supplement.', icon: '✅', target: { path: '/admin/decisions', label: 'Open decision record' } },
        { title: 'Payment received', description: 'Invoice ATL-8821 is issued and paid — $18,421.15 recovered, a 417% increase over the estimate.', icon: '💵' },
        { title: 'Claim closed', description: 'Final inspection passed, permit closed, and the claim is marked paid and closed.', icon: '🎉', target: claimTarget(flagship) },
      ],
    },
    {
      id: 'inspection-supplement',
      title: 'Inspection → Supplement',
      tagline: 'Contractor-first: how an inspection turns into an approved supplement.',
      icon: '🔍',
      color: 'from-purple-500 to-pink-500',
      steps: [
        { title: 'Property walk', description: 'The estimator walks 26 squares of roof across three planes, tagging every suspected impact.', icon: '🏠', target: claimTarget(flagship) },
        { title: 'Photos captured', description: '22 photos are captured with GPS tags and uploaded straight from the field.', icon: '📷', target: { path: '/admin/documents', label: 'Open documents' } },
        { title: 'Damage detection', description: 'Photo intelligence flags hail impacts, torn flashing and gutter damage with 0.88 confidence.', icon: '🎯' },
        { title: 'Measurements', description: 'Drone photogrammetry measures all roof planes within 2% of tape measurement.', icon: '📐' },
        { title: 'Weather verification', description: 'NOAA data confirms 61 mph gusts and 1.25-inch hail on the loss date — over policy threshold.', icon: '⛈️' },
        { title: 'Decision Engine', description: 'Atlas scores evidence (88), coverage (92), compliance (94) and risk (18) → final 90/100.', icon: '🧠', target: { path: '/admin/decisions', label: 'Open decision record' } },
        { title: 'Supplement drafted', description: 'Six Xactimate line items total $22,835.65, every one code-required or photo-backed.', icon: '📝', target: { path: '/admin/supplements', label: 'Open supplements' } },
        { title: 'Review & export', description: 'The supplement package is reviewed and exported as Markdown, JSON or PDF.', icon: '📤' },
      ],
    },
    {
      id: 'denied-recovery',
      title: 'Denied Supplement Recovery',
      tagline: 'Turn a denial into approval with AI-driven gap analysis.',
      icon: '⚠️',
      color: 'from-orange-500 to-red-500',
      steps: [
        { title: 'Supplement denied', description: 'Robert Garcia’s structural supplement is denied — carrier cites “pre-existing damage”.', icon: '🚫', target: claimTarget(denied) },
        { title: 'AI denial analysis', description: 'Atlas parses the denial letter, extracts the exact reasons and maps them to evidence gaps.', icon: '🧠' },
        { title: 'Missing evidence flagged', description: 'The engine identifies missing load calculations and engineer sign-off as the deciding factors.', icon: '🔎' },
        { title: 'Documentation gathered', description: 'Engineer report, load calculations and pre-loss photos are collected and linked.', icon: '📁', target: { path: '/admin/documents', label: 'Open documents' } },
        { title: 'Supplement regenerated', description: 'A revised $31,000 supplement is drafted with every denial point answered.', icon: '🔄', target: { path: '/admin/supplements', label: 'Open supplements' } },
        { title: 'Resubmitted & approved', description: 'The carrier approves the resubmission — $18,421.15-style recoveries are achievable.', icon: '✅' },
      ],
    },
    {
      id: 'commercial',
      title: 'Commercial Restoration',
      tagline: 'Multi-building commercial claims with complex stakeholders.',
      icon: '🏢',
      color: 'from-green-500 to-emerald-500',
      steps: [
        { title: 'Commercial property', description: 'Westgate Shopping Centre — a three-building TPO roof system in Nashville.', icon: '🏬', target: claimTarget(commercial) },
        { title: 'Multiple buildings', description: 'Buildings A, B and C each with distinct damage scopes and permits.', icon: '🏗️' },
        { title: 'Multiple adjusters', description: 'Three carrier adjusters coordinate on separate supplement tracks.', icon: '👥' },
        { title: 'Large supplement', description: 'Three supplements totaling $193,400 requested across the campus.', icon: '💰', target: { path: '/admin/supplements', label: 'Open supplements' } },
        { title: 'Permit tracking', description: 'Atlas tracks permits, inspections and HVAC curb adapter approvals.', icon: '📜' },
        { title: 'Revenue dashboard', description: 'Executive metrics show requested vs approved revenue and outstanding exposure.', icon: '📊', target: { path: '/admin', label: 'Open dashboard' } },
      ],
    },
    {
      id: 'interview-claim',
      title: 'Interview-Driven Claim Creation',
      tagline: 'Create a claim, property and scope from a guided AI conversation.',
      icon: '💬',
      color: 'from-indigo-500 to-blue-500',
      steps: [
        { title: 'Launch the AI interview', description: 'Atlas starts a First Notice of Loss conversation and asks the first question.', icon: '🚀', target: { path: '/admin/interviews', label: 'Open interviews' } },
        { title: 'Answer questions', description: '“What happened?” — “A June 14 hailstorm hit the roof, wind blew shingles off.”', icon: '🗣️' },
        { title: 'Property generated', description: 'Atlas creates the property record from the address and details you provide.', icon: '🏠' },
        { title: 'Claim generated', description: 'A claim is created with status, carrier, loss date and entry point from the conversation.', icon: '📄' },
        { title: 'Damage scope drafted', description: 'Interview answers become an initial scope Atlas cross-checks against photos.', icon: '🩹' },
        { title: 'Timeline established', description: 'Atlas seeds the activity timeline with every event from the interview.', icon: '🗓️', target: claimTarget(first) },
      ],
    },
    {
      id: 'ai-supplement',
      title: 'AI Supplement Generation',
      tagline: 'Watch Atlas reason, score and price a supplement live.',
      icon: '🤖',
      color: 'from-cyan-500 to-teal-500',
      steps: [
        { title: 'Reasoning', description: 'Atlas explains the pipeline: photos → weather → measurements → code → supplement.', icon: '🧠', target: { path: '/admin/decisions', label: 'Open decision record' } },
        { title: 'Evidence', description: 'Every line item is backed by photos, drone imagery and the compliance report.', icon: '🕸️' },
        { title: 'Confidence', description: 'Engine confidence: 88.5/100, driven by evidence strength 0.95 and coverage 92.', icon: '📈' },
        { title: 'Compliance', description: 'Compliance score 94/100 — 2023 Florida Building Code, COMPLIANT status.', icon: '🛡️' },
        { title: 'Risk', description: 'Risk 22/100: depreciation is the only material factor, with a clear mitigation plan.', icon: '⚠️' },
        { title: 'Xactimate line items', description: 'Six priced line items from shingles to soffit — $22,835.65 total.', icon: '🧾' },
        { title: 'Cost breakdown', description: 'Estimate $4,414.50 → requested $22,835.65 → approved $18,421.15.', icon: '💵' },
        { title: 'Approval prediction', description: 'Atlas predicts approval with 88% probability based on carrier history.', icon: '🔮' },
      ],
    },
  ];
}

export function resolveClaimIds(claims: Array<{ id: string; claimNumber: string }>): Record<string, string> {
  const byNumber = new Map(claims.map((c) => [c.claimNumber, c.id]));
  const first = claims[0]?.id;
  return {
    flagship: byNumber.get('CL-2026-0614') || first,
    denied: byNumber.get('CL-2024-0311') || first,
    commercial: byNumber.get('CL-2023-1188') || first,
    first,
  };
}

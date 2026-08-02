// apps/web/src/lib/demo-seed.ts
// DB-backed demo seed for the deployed web app. Seeds a realistic, already-operating
// company dataset into the authenticated user's company so every page has live data.

import { db, setCompanyContext } from './server-db';
import {
  adjusters,
  properties,
  claims,
  supplements,
  interviews,
  documents,
  notes,
  activityLogs,
} from '@project-atlas/database';
import { eq, inArray, and, like } from 'drizzle-orm';

const DEMO_SOURCE = 'demo-seed';

interface SeedContext {
  userId: string;
  companyId: string;
  userName?: string | null;
}

// ---------------------------------------------------------------
// Persona templates — 6 realistic insurance restoration scenarios
// ---------------------------------------------------------------

interface PersonaTemplate {
  key: string;
  claimNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  insuranceCompany: string;
  policyNumber: string;
  damageType: string;
  status: string;
  workflow: 'A' | 'B';
  story: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dateOfLoss: string;
  adjusterName: string;
  adjusterCompany: string;
  estimatedValue: string;
  approvedValue: string;
  deductible: string;
  description: string;
  supplements: Array<{
    supplementNumber: string;
    status: string;
    carrier: string;
    requestedAmount: string;
    approvedAmount: string;
    description: string;
  }>;
}

const PERSONAS: PersonaTemplate[] = [
  {
    key: 'john-mitchell',
    claimNumber: 'CL-2024-0142',
    customerName: 'John Mitchell',
    customerEmail: 'john.mitchell@example.com',
    customerPhone: '(555) 214-8890',
    insuranceCompany: 'State Farm',
    policyNumber: 'SF-88231-44',
    damageType: 'Hail & Wind — Roof',
    status: 'approved',
    workflow: 'A',
    story:
      'Hailstorm damaged the roof and siding. Hidden damage discovered during inspection led to a second-round supplement that was fully approved.',
    address: '4821 Maple Grove Lane',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    dateOfLoss: '2024-03-14',
    adjusterName: 'Karen Whitfield',
    adjusterCompany: 'State Farm',
    estimatedValue: '48200',
    approvedValue: '52150',
    deductible: '2500',
    description:
      'Hail damage to architectural shingles, ridge cap, gutters, and vinyl siding.',
    supplements: [
      {
        supplementNumber: 'SUP-1',
        status: 'approved',
        carrier: 'State Farm',
        requestedAmount: '14250',
        approvedAmount: '14250',
        description:
          'Hidden decking damage and replaced ridge vent discovered during tear-off.',
      },
      {
        supplementNumber: 'SUP-2',
        status: 'submitted',
        carrier: 'State Farm',
        requestedAmount: '3850',
        approvedAmount: '0',
        description: 'Soffit and fascia replacement after final inspection.',
      },
    ],
  },
  {
    key: 'emily-johnson',
    claimNumber: 'CL-2024-0228',
    customerName: 'Emily Johnson',
    customerEmail: 'emily.johnson@example.com',
    customerPhone: '(555) 390-1127',
    insuranceCompany: 'Allstate',
    policyNumber: 'AL-5512-998',
    damageType: 'Water — Mold Remediation',
    status: 'partially_approved',
    workflow: 'A',
    story:
      'Burst pipe caused water damage and secondary mold growth. Engineer report documented the mold remediation scope.',
    address: '917 Birchwood Court',
    city: 'Columbus',
    state: 'OH',
    zip: '43215',
    dateOfLoss: '2024-05-02',
    adjusterName: 'Marcus Delgado',
    adjusterCompany: 'Allstate',
    estimatedValue: '73600',
    approvedValue: '61200',
    deductible: '1000',
    description:
      'Water extraction, dry-out, mold remediation, and reconstruction of affected rooms.',
    supplements: [
      {
        supplementNumber: 'SUP-1',
        status: 'partially_approved',
        carrier: 'Allstate',
        requestedAmount: '18800',
        approvedAmount: '14900',
        description:
          'Mold remediation and HEPA filtration scope per engineer report.',
      },
      {
        supplementNumber: 'SUP-2',
        status: 'needs_revision',
        carrier: 'Allstate',
        requestedAmount: '6400',
        approvedAmount: '0',
        description:
          'Cabinetry replacement — carrier requested itemized photos before approval.',
      },
    ],
  },
  {
    key: 'robert-garcia',
    claimNumber: 'CL-2024-0311',
    customerName: 'Robert Garcia',
    customerEmail: 'robert.garcia@example.com',
    customerPhone: '(555) 771-4036',
    insuranceCompany: 'Farmers',
    policyNumber: 'FM-7701-221',
    damageType: 'Fire — Structural',
    status: 'denied',
    workflow: 'A',
    story:
      'Kitchen fire caused structural damage to framing. Initial supplement was denied; appeal with engineer documentation is pending.',
    address: '2540 Oak Street',
    city: 'Denver',
    state: 'CO',
    zip: '80211',
    dateOfLoss: '2024-01-19',
    adjusterName: 'Sandra Okafor',
    adjusterCompany: 'Farmers',
    estimatedValue: '96800',
    approvedValue: '0',
    deductible: '5000',
    description:
      'Fire and smoke damage to kitchen, adjacent framing, and HVAC system.',
    supplements: [
      {
        supplementNumber: 'SUP-1',
        status: 'denied',
        carrier: 'Farmers',
        requestedAmount: '26400',
        approvedAmount: '0',
        description:
          'Structural framing repairs — denied pending engineer report.',
      },
      {
        supplementNumber: 'SUP-2',
        status: 'waiting_for_carrier',
        carrier: 'Farmers',
        requestedAmount: '31000',
        approvedAmount: '0',
        description:
          'Appeal with full engineer report and load calculations.',
      },
    ],
  },
  {
    key: 'lisa-chen',
    claimNumber: 'CL-2024-0405',
    customerName: 'Lisa Chen',
    customerEmail: 'lisa.chen@example.com',
    customerPhone: '(555) 644-2219',
    insuranceCompany: 'Liberty Mutual',
    policyNumber: 'LM-3004-776',
    damageType: 'Wind — Roof & Siding',
    status: 'estimate_submitted',
    workflow: 'B',
    story:
      'Contractor discovered wind damage during a routine maintenance visit — no claim was filed yet. Atlas guided the FNOL interview and claim creation.',
    address: '1555 Prairie View Drive',
    city: 'Kansas City',
    state: 'MO',
    zip: '64111',
    dateOfLoss: '2024-06-21',
    adjusterName: 'Tom Becker',
    adjusterCompany: 'Liberty Mutual',
    estimatedValue: '35500',
    approvedValue: '0',
    deductible: '1500',
    description:
      'Wind uplift damage to roof shingles and loose siding panels.',
    supplements: [
      {
        supplementNumber: 'SUP-1',
        status: 'draft',
        carrier: 'Liberty Mutual',
        requestedAmount: '9800',
        approvedAmount: '0',
        description:
          'Initial scope prepared by Atlas from inspection photos — awaiting adjuster assignment.',
      },
    ],
  },
  {
    key: 'westgate',
    claimNumber: 'CL-2023-1188',
    customerName: 'Westgate Shopping Centre LLC',
    customerEmail: 'facilities@westgate.example.com',
    customerPhone: '(555) 812-0093',
    insuranceCompany: 'Travelers',
    policyNumber: 'TR-9902-114',
    damageType: 'Commercial — Roof System',
    status: 'waiting_for_carrier',
    workflow: 'A',
    story:
      'Large commercial roof claim across three buildings. Multiple supplements in flight with significant outstanding revenue.',
    address: '660 Commerce Parkway',
    city: 'Nashville',
    state: 'TN',
    zip: '37203',
    dateOfLoss: '2023-10-04',
    adjusterName: 'Robert Nguyen',
    adjusterCompany: 'Travelers',
    estimatedValue: '184000',
    approvedValue: '121000',
    deductible: '10000',
    description:
      'TPO roof system replacement across Buildings A, B, and C with standing water repair.',
    supplements: [
      {
        supplementNumber: 'SUP-1',
        status: 'approved',
        carrier: 'Travelers',
        requestedAmount: '64200',
        approvedAmount: '64200',
        description: 'Building A roof replacement.',
      },
      {
        supplementNumber: 'SUP-2',
        status: 'approved',
        carrier: 'Travelers',
        requestedAmount: '56800',
        approvedAmount: '56800',
        description: 'Building B roof replacement and interior water damage.',
      },
      {
        supplementNumber: 'SUP-3',
        status: 'waiting_for_carrier',
        carrier: 'Travelers',
        requestedAmount: '72400',
        approvedAmount: '0',
        description:
          'Building C roof replacement plus HVAC curb adapters — final outstanding supplement.',
      },
    ],
  },
  {
    key: 'oak-valley',
    claimNumber: 'CL-2023-0977',
    customerName: 'Oak Valley Apartments',
    customerEmail: 'pm@oakvalley.example.com',
    customerPhone: '(555) 903-4471',
    insuranceCompany: 'Nationwide',
    policyNumber: 'NW-6601-332',
    damageType: 'Emergency Mitigation — Multi-unit',
    status: 'supplement_pending',
    workflow: 'B',
    story:
      'Frozen pipes across multiple units caused emergency mitigation and long-running reconstruction with a pending supplement.',
    address: '2200 Oak Valley Drive',
    city: 'Minneapolis',
    state: 'MN',
    zip: '55401',
    dateOfLoss: '2023-12-11',
    adjusterName: 'Danielle Foster',
    adjusterCompany: 'Nationwide',
    estimatedValue: '142000',
    approvedValue: '115000',
    deductible: '7500',
    description:
      'Emergency water extraction, dry-out, and reconstruction across 8 units.',
    supplements: [
      {
        supplementNumber: 'SUP-1',
        status: 'approved',
        carrier: 'Nationwide',
        requestedAmount: '88400',
        approvedAmount: '88400',
        description: 'Mitigation and dry-out across affected units.',
      },
      {
        supplementNumber: 'SUP-2',
        status: 'submitted',
        carrier: 'Nationwide',
        requestedAmount: '37200',
        approvedAmount: '0',
        description: 'Reconstruction of units 2, 3, and 7.',
      },
    ],
  },
];

// ---------------------------------------------------------------
// Additional data (non-persona)
// ---------------------------------------------------------------

const EXTRA_ADJUSTERS = [
  { fullName: 'James Thornton', insuranceCompany: 'Progressive', territory: 'Midwest' },
  { fullName: 'Alicia Ramos', insuranceCompany: 'USAA', territory: 'Southwest' },
  { fullName: 'Peter Kovac', insuranceCompany: 'GEICO', territory: 'Northeast' },
  { fullName: 'Renee Whitaker', insuranceCompany: 'American Family', territory: 'Midwest' },
  { fullName: 'Derek Osei', insuranceCompany: 'Travelers', territory: 'Southeast' },
];

const EXTRA_CLAIMS = [
  {
    claimNumber: 'CL-2024-0513',
    insuranceCompany: 'State Farm',
    customerName: 'Marcus Webb',
    damageType: 'Wind — Roof',
    status: 'inspection_completed',
    address: '310 Cedar Falls Road',
    city: 'Madison',
    state: 'WI',
    zip: '53703',
    dateOfLoss: '2024-07-08',
    estimatedValue: '28400',
  },
  {
    claimNumber: 'CL-2024-0566',
    insuranceCompany: 'Allstate',
    customerName: 'Priya Sharma',
    damageType: 'Water — Plumbing',
    status: 'adjuster_assigned',
    address: '88 Riverside Avenue',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    dateOfLoss: '2024-07-19',
    estimatedValue: '19750',
  },
  {
    claimNumber: 'CL-2024-0601',
    insuranceCompany: 'Farmers',
    customerName: 'George Callahan',
    damageType: 'Hail — Roof',
    status: 'new',
    address: '1402 Hillcrest Street',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73102',
    dateOfLoss: '2024-07-25',
    estimatedValue: '31200',
  },
];

// ---------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------

export async function seedDemoData(ctx: SeedContext) {
  await setCompanyContext(ctx.companyId);

  // Idempotent: clear any previous demo-seed rows first
  await clearDemoData(ctx);

  // --- Adjusters ---
  const personaAdjusters = PERSONAS.map((p, i) => ({
    fullName: p.adjusterName,
    insuranceCompany: p.adjusterCompany,
    email: `${p.adjusterName.toLowerCase().replace(/[^a-z]+/g, '.')}@carrier.example.com`,
    phone: `(555) 1${String(i).padStart(2, '0')}-${String(100 + i * 37)}`,
    office: p.adjusterCompany,
    territory: i % 2 === 0 ? 'Midwest' : 'National',
    active: true,
  }));
  const allAdjusterRows = [...personaAdjusters, ...EXTRA_ADJUSTERS.map((a, i) => ({
    fullName: a.fullName,
    insuranceCompany: a.insuranceCompany,
    email: `${a.fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@carrier.example.com`,
    phone: `(555) 2${String(i).padStart(2, '0')}-${String(300 + i * 41)}`,
    office: a.insuranceCompany,
    territory: a.territory,
    active: true,
  }))];
  const insertedAdjusters = await db
    .insert(adjusters)
    .values(
      allAdjusterRows.map((a) => ({
        ...a,
        companyId: ctx.companyId,
        createdBy: ctx.userId,
      })),
    )
    .returning();
  const adjusterByPersona = new Map<string, string>();
  PERSONAS.forEach((p, i) => {
    adjusterByPersona.set(p.key, insertedAdjusters[i].id);
  });

  // --- Properties (persona) ---
  const personaProperties = PERSONAS.map((p) => ({
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    ownerName: p.customerName,
  }));
  const personaPropertyRows = await db
    .insert(properties)
    .values(
      personaProperties.map((pr) => ({
        ...pr,
        companyId: ctx.companyId,
        createdBy: ctx.userId,
      })),
    )
    .returning();
  const propertyByPersona = new Map<string, string>();
  PERSONAS.forEach((p, i) => {
    propertyByPersona.set(p.key, personaPropertyRows[i].id);
  });

  // --- Extra properties for extra claims ---
  const extraProperties = await db
    .insert(properties)
    .values(
      EXTRA_CLAIMS.map((c) => ({
        address: c.address,
        city: c.city,
        state: c.state,
        zip: c.zip,
        ownerName: c.customerName,
        companyId: ctx.companyId,
        createdBy: ctx.userId,
      })),
    )
    .returning();

  // --- Claims (persona) ---
  const personaClaimRows = await db
    .insert(claims)
    .values(
      PERSONAS.map((p, i) => ({
        companyId: ctx.companyId,
        claimNumber: p.claimNumber,
        entryPoint: 'existing_claim',
        sourceSystem: DEMO_SOURCE,
        status: p.status,
        dateOfLoss: new Date(p.dateOfLoss),
        dateReported: new Date(p.dateOfLoss),
        insuranceCompany: p.insuranceCompany,
        policyNumber: p.policyNumber,
        deductible: p.deductible,
        estimatedValue: p.estimatedValue,
        approvedValue: p.approvedValue,
        description: p.description,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
        adjusterId: adjusterByPersona.get(p.key),
        propertyId: propertyByPersona.get(p.key),
        statusHistory: [
          {
            status: p.status,
            timestamp: new Date().toISOString(),
            userId: ctx.userId,
            userName: ctx.userName,
            reason: 'Seeded demo claim',
          },
        ],
        createdBy: ctx.userId,
      })),
    )
    .returning();
  const claimByPersona = new Map<string, string>();
  PERSONAS.forEach((p, i) => {
    claimByPersona.set(p.key, personaClaimRows[i].id);
  });

  // --- Extra claims ---
  const extraClaimRows = await db
    .insert(claims)
    .values(
      EXTRA_CLAIMS.map((c, i) => ({
        companyId: ctx.companyId,
        claimNumber: c.claimNumber,
        entryPoint: 'new_claim',
        sourceSystem: DEMO_SOURCE,
        status: c.status,
        dateOfLoss: new Date(c.dateOfLoss),
        dateReported: new Date(c.dateOfLoss),
        insuranceCompany: c.insuranceCompany,
        customerName: c.customerName,
        description: c.damageType,
        estimatedValue: c.estimatedValue,
        propertyId: extraProperties[i].id,
        adjusterId: insertedAdjusters[i % insertedAdjusters.length].id,
        statusHistory: [
          {
            status: c.status,
            timestamp: new Date().toISOString(),
            userId: ctx.userId,
            userName: ctx.userName,
            reason: 'Seeded demo claim',
          },
        ],
        createdBy: ctx.userId,
      })),
    )
    .returning();

  const allClaimRows = [...personaClaimRows, ...extraClaimRows];

  // --- Supplements ---
  const supplementValues: any[] = [];
  PERSONAS.forEach((p) => {
    const claimId = claimByPersona.get(p.key)!;
    p.supplements.forEach((s) => {
      supplementValues.push({
        companyId: ctx.companyId,
        claimId,
        supplementNumber: `${p.claimNumber}-${s.supplementNumber}`,
        version: '1',
        status: s.status,
        carrier: s.carrier,
        requestedAmount: s.requestedAmount,
        approvedAmount: s.approvedAmount,
        difference:
          Number(s.requestedAmount) - Number(s.approvedAmount) > 0
            ? String(Number(s.requestedAmount) - Number(s.approvedAmount))
            : '0',
        lineItems: [
          { description: s.description, category: p.damageType, quantity: 1, unit: 'Each', unitPrice: Number(s.requestedAmount), total: Number(s.requestedAmount), depreciation: 0, tax: 0 },
        ],
        internalNotes: 'Seeded by Atlas demo generator',
        statusHistory: [],
        revisionHistory: [],
        adjusterId: adjusterByPersona.get(p.key),
        createdBy: ctx.userId,
      });
    });
  });
  await db.insert(supplements).values(supplementValues);

  // --- Interviews ---
  const interviewValues = PERSONAS.map((p, i) => ({
    companyId: ctx.companyId,
    claimId: claimByPersona.get(p.key)!,
    propertyId: propertyByPersona.get(p.key)!,
    interviewNumber: `INT-2024-${String(100 + i)}`,
    templateId: 'fnol-v1',
    templateName: 'First Notice of Loss (FNOL)',
    status: 'completed',
    currentSection: 'review',
    progress: '100',
    responses: {
      customerName: p.customerName,
      damageType: p.damageType,
      dateOfLoss: p.dateOfLoss,
      insuranceCompany: p.insuranceCompany,
      notes: p.description,
    },
    conversationHistory: [
      { role: 'system', content: 'FNOL interview completed for demo claim.' },
    ],
    metadata: { seeded: true, source: DEMO_SOURCE },
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));
  await db.insert(interviews).values(interviewValues);

  // --- Documents ---
  const docTemplates = [
    { name: 'Insurance Policy.pdf', type: 'application/pdf', size: 245000 },
    { name: 'Damage Photos.zip', type: 'application/zip', size: 1840000 },
    { name: 'Estimate Xactimate.xact', type: 'application/x-xactimate', size: 98000 },
    { name: 'Engineer Report.pdf', type: 'application/pdf', size: 612000 },
    { name: 'FNOL Interview.pdf', type: 'application/pdf', size: 132000 },
    { name: 'Carrier Correspondence.pdf', type: 'application/pdf', size: 88000 },
  ];
  const documentValues: any[] = [];
  PERSONAS.forEach((p) => {
    const claimId = claimByPersona.get(p.key)!;
    docTemplates.forEach((doc, i) => {
      documentValues.push({
        companyId: ctx.companyId,
        claimId,
        url: `data:text/plain;base64,${Buffer.from(
          `${p.claimNumber} — ${doc.name} (demo document)`,
        ).toString('base64')}`,
        fileName: `${p.claimNumber}-${doc.name}`,
        mimeType: doc.type,
        sizeBytes: doc.size + i * 1000,
        createdBy: ctx.userId,
      });
    });
  });
  EXTRA_CLAIMS.forEach((c, ci) => {
    const claimId = extraClaimRows[ci].id;
    docTemplates.slice(0, 3).forEach((doc) => {
      documentValues.push({
        companyId: ctx.companyId,
        claimId,
        url: `data:text/plain;base64,${Buffer.from(
          `${c.claimNumber} — ${doc.name} (demo document)`,
        ).toString('base64')}`,
        fileName: `${c.claimNumber}-${doc.name}`,
        mimeType: doc.type,
        sizeBytes: doc.size,
        createdBy: ctx.userId,
      });
    });
  });
  await db.insert(documents).values(documentValues);

  // --- Notes ---
  const noteValues = PERSONAS.map((p) => ({
    companyId: ctx.companyId,
    entityType: 'claim',
    entityId: claimByPersona.get(p.key)!,
    content: p.story,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));
  await db.insert(notes).values(noteValues);

  // --- Activities ---
  const activityTemplates = [
    { action: 'create', description: 'Claim created via Atlas demo seed' },
    { action: 'interview', description: 'FNOL interview completed' },
    { action: 'upload', description: 'Damage photos uploaded' },
    { action: 'supplement', description: 'Supplement prepared by Atlas AI' },
    { action: 'status_change', description: 'Status updated by adjuster' },
  ];
  const activityValues: any[] = [];
  allClaimRows.forEach((claimRow, ci) => {
    activityTemplates.forEach((act, ai) => {
      activityValues.push({
        companyId: ctx.companyId,
        userId: ctx.userId,
        userName: ctx.userName,
        entityType: 'claim',
        entityId: claimRow.id,
        entityName: claimRow.claimNumber,
        claimId: claimRow.id,
        action: act.action,
        description: act.description,
        newValues: { seeded: true },
        createdAt: new Date(Date.now() - (allClaimRows.length - ci) * 86400000 - ai * 3600000),
      });
    });
  });
  await db.insert(activityLogs).values(activityValues);

  // ---------------------------------------------------------------
  // Build response payloads
  // ---------------------------------------------------------------
  const personaPayloads = PERSONAS.map((p) => {
    const claimId = claimByPersona.get(p.key)!;
    return {
      id: claimId,
      claimId,
      customerId: p.customerName,
      propertyId: propertyByPersona.get(p.key)!,
      customerName: p.customerName,
      claimNumber: p.claimNumber,
      insuranceCompany: p.insuranceCompany,
      damageType: p.damageType,
      status: p.status,
      workflow: p.workflow,
      story: p.story,
      address: p.address,
      supplements: p.supplements.map((s) => ({
        supplementNumber: `${p.claimNumber}-${s.supplementNumber}`,
        status: s.status,
        requestedAmount: Number(s.requestedAmount),
        approvedAmount: Number(s.approvedAmount),
      })),
    };
  });

  const walkthroughs = [
    {
      id: 'lisa-chen',
      title: 'Start with Lisa Chen',
      description: 'Demonstrates contractor-first workflow from inspection to claim creation',
      workflow: 'B',
      claimId: claimByPersona.get('lisa-chen'),
      customerId: 'lisa-chen',
      propertyId: propertyByPersona.get('lisa-chen'),
      steps: [
        'Review property inspection photos',
        'Examine FNOL interview responses',
        'Review claim creation details',
        'Analyze AI supplement recommendations',
        'Review approved supplement with missing line items',
      ],
    },
    {
      id: 'john-mitchell',
      title: 'Open John & Sarah Mitchell',
      description: 'Demonstrates an approved supplement with AI recommendations',
      workflow: 'A',
      claimId: claimByPersona.get('john-mitchell'),
      customerId: 'john-mitchell',
      propertyId: propertyByPersona.get('john-mitchell'),
      steps: [
        'Review insurance claim details',
        'Examine hidden damage discovery',
        'Review AI supplement recommendations',
        'Analyze approved supplement',
        'Review payment and claim closure',
      ],
    },
    {
      id: 'emily-johnson',
      title: 'Review Emily Johnson',
      description: 'Demonstrates multiple supplement revisions and engineering reports',
      workflow: 'A',
      claimId: claimByPersona.get('emily-johnson'),
      customerId: 'emily-johnson',
      propertyId: propertyByPersona.get('emily-johnson'),
      steps: [
        'Review water damage claim',
        'Examine mold remediation supplement',
        'Review engineer report documentation',
        'Analyze second supplement revision',
        'Review final approval and payment',
      ],
    },
    {
      id: 'robert-garcia',
      title: 'Review Robert Garcia',
      description: 'Demonstrates denied supplements and appeal workflow',
      workflow: 'A',
      claimId: claimByPersona.get('robert-garcia'),
      customerId: 'robert-garcia',
      propertyId: propertyByPersona.get('robert-garcia'),
      steps: [
        'Review fire damage claim',
        'Examine structural damage supplement',
        'Review denial reason and carrier response',
        'Analyze appeal documentation',
        'Review pending appeal status',
      ],
    },
    {
      id: 'westgate',
      title: 'Explore Westgate Shopping Centre',
      description: 'Demonstrates commercial claims, executive dashboard metrics, multiple supplements and outstanding revenue',
      workflow: 'A',
      claimId: claimByPersona.get('westgate'),
      customerId: 'westgate',
      propertyId: propertyByPersona.get('westgate'),
      steps: [
        'Review commercial roof claim',
        'Examine large-scale supplement',
        'Review outstanding final supplement',
        'Analyze revenue metrics',
        'Review executive dashboard data',
      ],
    },
    {
      id: 'oak-valley',
      title: 'Explore Oak Valley Apartments',
      description: 'Demonstrates emergency mitigation, multiple buildings, and long-running claims',
      workflow: 'B',
      claimId: claimByPersona.get('oak-valley'),
      customerId: 'oak-valley',
      propertyId: propertyByPersona.get('oak-valley'),
      steps: [
        'Review emergency mitigation claim',
        'Examine multi-building damage',
        'Review long-running claim timeline',
        'Analyze activity history',
        'Review pending supplement',
      ],
    },
  ];

  const metrics = await calculateMetrics(ctx);

  return {
    company: { id: ctx.companyId, name: 'Atlas Demo Company' },
    companyId: ctx.companyId,
    summary: {
      customers: PERSONAS.length + EXTRA_CLAIMS.length,
      properties: PERSONAS.length + EXTRA_CLAIMS.length,
      claims: allClaimRows.length,
      adjusters: insertedAdjusters.length,
      documents: documentValues.length,
      interviews: interviewValues.length,
      supplements: supplementValues.length,
      activities: activityValues.length,
      users: 1,
    },
    personas: personaPayloads,
    metrics,
  };
}

export async function clearDemoData(ctx: SeedContext) {
  await setCompanyContext(ctx.companyId);

  const demoClaims = await db
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.companyId, ctx.companyId), eq(claims.sourceSystem, DEMO_SOURCE)));

  const demoClaimIds = demoClaims.map((c) => c.id);

  if (demoClaimIds.length === 0) return { success: true, message: 'No demo data to clear' };

  await db.delete(activityLogs).where(inArray(activityLogs.claimId, demoClaimIds));
  await db.delete(notes).where(inArray(notes.entityId, demoClaimIds));
  await db.delete(supplements).where(inArray(supplements.claimId, demoClaimIds));
  await db.delete(interviews).where(inArray(interviews.claimId, demoClaimIds));
  await db.delete(documents).where(inArray(documents.claimId, demoClaimIds));
  await db.delete(claims).where(inArray(claims.id, demoClaimIds));

  // Clean up demo adjusters only — identified by the seeded email domain marker,
  // never by createdBy (which would delete adjusters the user created mid-demo).
  await db
    .delete(adjusters)
    .where(and(eq(adjusters.companyId, ctx.companyId), like(adjusters.email, '%@carrier.example.com')));

  // Clean up demo properties (persona + extra claim properties have no source
  // marker, so match by ownerName against the known demo customer list).
  const demoOwnerNames = [
    ...PERSONAS.map((p) => p.customerName),
    ...EXTRA_CLAIMS.map((c) => c.customerName),
  ];
  for (const owner of demoOwnerNames) {
    await db
      .delete(properties)
      .where(and(eq(properties.companyId, ctx.companyId), eq(properties.ownerName, owner)));
  }

  return { success: true, message: `Cleared ${demoClaimIds.length} demo claims` };
}

export async function getDemoStatus(ctx: SeedContext) {
  const demoClaims = await db
    .select({ id: claims.id })
    .from(claims)
    .where(eq(claims.companyId, ctx.companyId))
    .limit(1);
  const hasData = demoClaims.length > 0;
  // Demo experience is always available; hasData reflects whether the company
  // already has claims (seeded or otherwise) so the UI can show a generate CTA.
  return {
    enabled: true,
    hasData,
    companyId: ctx.companyId,
  };
}

export async function calculateMetrics(ctx: SeedContext) {
  const claimRows = await db
    .select()
    .from(claims)
    .where(eq(claims.companyId, ctx.companyId));
  const supplementRows = await db
    .select()
    .from(supplements)
    .where(eq(supplements.companyId, ctx.companyId));

  const totalClaims = claimRows.length;
  const activeClaims = claimRows.filter(
    (c) => !['closed', 'approved', 'paid'].includes(c.status),
  ).length;

  const pendingSupplements = supplementRows.filter(
    (s) => ['draft', 'ready_for_review', 'submitted', 'waiting_for_carrier', 'needs_revision'].includes(s.status),
  ).length;
  const approvedSupplements = supplementRows.filter(
    (s) => ['approved', 'paid', 'partially_approved'].includes(s.status),
  ).length;

  const totalRevenueRequested = supplementRows.reduce(
    (sum, s) => sum + (Number(s.requestedAmount) || 0),
    0,
  );
  const totalRevenueApproved = supplementRows.reduce(
    (sum, s) => sum + (Number(s.approvedAmount) || 0),
    0,
  );
  const approvalRate =
    supplementRows.length > 0
      ? Math.round((approvedSupplements / supplementRows.length) * 100)
      : 0;

  return {
    totalClaims,
    activeClaims,
    pendingSupplements,
    approvedSupplements,
    totalRevenueRequested,
    totalRevenueApproved,
    approvalRate,
    aiAcceptanceRate: Math.min(approvedSupplements * 12, 96),
    activeUsers: 1,
    topCarriers: [
      { name: 'State Farm', count: 2 },
      { name: 'Allstate', count: 2 },
      { name: 'Farmers', count: 2 },
      { name: 'Travelers', count: 1 },
      { name: 'Nationwide', count: 1 },
    ],
    topAdjusters: [
      { name: 'Karen Whitfield', count: 1 },
      { name: 'Marcus Delgado', count: 1 },
      { name: 'Sandra Okafor', count: 1 },
      { name: 'Tom Becker', count: 1 },
      { name: 'Robert Nguyen', count: 1 },
    ],
  };
}

export { DEMO_SOURCE };

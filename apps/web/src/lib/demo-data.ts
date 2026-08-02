// apps/web/src/lib/demo-data.ts
// Read-only helpers for the demo experience — pull live seeded data from the DB
// so personas, claims, activities and walkthroughs always reflect real rows.

import { db, setCompanyContext } from './server-db';
import { claims, supplements, properties, activityLogs } from '@project-atlas/database';
import { eq, desc } from 'drizzle-orm';

interface Ctx {
  userId: string;
  companyId: string;
  userName?: string | null;
}

// Get persona cards (derived from demo-seeded claims)
export async function getPersonas(ctx: Ctx) {
  await setCompanyContext(ctx.companyId);

  const claimRows = await db
    .select()
    .from(claims)
    .where(eq(claims.companyId, ctx.companyId))
    .orderBy(desc(claims.createdAt));

  const personas: any[] = [];
  for (const c of claimRows) {
    const suppRows = await db
      .select()
      .from(supplements)
      .where(eq(supplements.claimId, c.id));
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, c.propertyId || '00000000-0000-0000-0000-000000000000'));

    personas.push({
      id: c.id,
      claimId: c.id,
      customerName: c.customerName || 'Unknown Customer',
      claimNumber: c.claimNumber,
      insuranceCompany: c.insuranceCompany || '—',
      damageType: c.description?.slice(0, 60) || 'Property damage',
      status: c.status,
      workflow: c.entryPoint === 'existing_claim' ? 'A' : 'B',
      story: c.description || 'Active restoration claim.',
      address: property?.address || '',
      supplements: suppRows.map((s) => ({
        supplementNumber: s.supplementNumber,
        status: s.status,
        requestedAmount: Number(s.requestedAmount) || 0,
        approvedAmount: Number(s.approvedAmount) || 0,
      })),
    });
  }

  return personas;
}

// Get guided walkthroughs (derived from seeded claims)
export async function getWalkthroughs(ctx: Ctx) {
  await setCompanyContext(ctx.companyId);

  const claimRows = await db
    .select()
    .from(claims)
    .where(eq(claims.companyId, ctx.companyId))
    .orderBy(desc(claims.createdAt))
    .limit(8);

  const titles = [
    'Lead to Closed Claim',
    'Inspection to Supplement',
    'Denied Supplement Recovery',
    'Commercial Restoration',
    'Interview Driven Claim Creation',
    'AI Supplement Generation',
  ];

  return claimRows.map((c, i) => ({
    id: `walkthrough-${i + 1}`,
    title: titles[i % titles.length],
    description: `Follow this ${c.customerName || 'claim'} through its lifecycle`,
    workflow: c.entryPoint === 'existing_claim' ? 'A' : 'B',
    claimId: c.id,
    customerId: c.id,
    propertyId: c.propertyId,
    steps: [
      'Review claim details',
      'Examine uploaded documents',
      'Review AI supplement recommendations',
      'Analyze the decision record',
      'Approve and export the package',
    ],
  }));
}

// Get all seeded claims (for the demo claims view)
export async function getDemoClaims(ctx: Ctx) {
  await setCompanyContext(ctx.companyId);
  const claimRows = await db
    .select()
    .from(claims)
    .where(eq(claims.companyId, ctx.companyId))
    .orderBy(desc(claims.createdAt))
    .limit(50);
  return claimRows;
}

// Get activity timeline
export async function getDemoActivities(ctx: Ctx, claimId?: string) {
  await setCompanyContext(ctx.companyId);
  const base = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.companyId, ctx.companyId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(500);
  return claimId ? base.filter((a) => a.claimId === claimId) : base;
}

// Get all supplements (for the demo supplements view)
export async function getDemoSupplements(ctx: Ctx) {
  await setCompanyContext(ctx.companyId);
  return db
    .select()
    .from(supplements)
    .where(eq(supplements.companyId, ctx.companyId))
    .orderBy(desc(supplements.updatedAt));
}

export { DEMO_SOURCE } from './demo-seed';

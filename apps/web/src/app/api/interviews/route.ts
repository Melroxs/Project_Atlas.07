import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { interviews } from '@project-atlas/database';
import { eq, and, desc, count } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const interviewSchema = z.object({
  interviewNumber: z.string().min(1).optional(), // auto-generated when omitted
  templateId: z.string().min(1),
  templateName: z.string().min(1),
  propertyId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  responses: z.record(z.any()).optional(),
  conversationHistory: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.string().default('draft'),
  currentSection: z.string().optional(),
  progress: z.string().or(z.number()).optional(),
});

function generateInterviewNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INT-${ymd}-${rand}`;
}

// GET /api/interviews - List interviews with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1') || 1;
    const limit = parseInt(searchParams.get('limit') || '20') || 20;
    const offset = (page - 1) * limit;

    const status = searchParams.get('status') || '';
    const templateId = searchParams.get('templateId') || '';

    const conditions = [eq(interviews.companyId, context.companyId)];
    if (status) conditions.push(eq(interviews.status, status));
    if (templateId) conditions.push(eq(interviews.templateId, templateId));

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countResult] = await db
      .select({ value: count() })
      .from(interviews)
      .where(whereClause);

    const results = await db
      .select()
      .from(interviews)
      .where(whereClause)
      .orderBy(desc(interviews.createdAt))
      .limit(limit)
      .offset(offset);

    const total = countResult?.value || 0;

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Interviews GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch interviews' }, { status: 500 });
  }
}

// POST /api/interviews - Create interview
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = interviewSchema.parse(body);

    const [newInterview] = await db
      .insert(interviews)
      .values({
        interviewNumber: validated.interviewNumber || generateInterviewNumber(),
        templateId: validated.templateId,
        templateName: validated.templateName,
        propertyId: validated.propertyId,
        claimId: validated.claimId,
        responses: validated.responses,
        conversationHistory: validated.conversationHistory,
        metadata: validated.metadata,
        status: validated.status || 'draft',
        currentSection: validated.currentSection,
        progress: validated.progress !== undefined ? String(validated.progress) : '0',
        companyId: context.companyId,
        createdBy: context.userId,
        updatedBy: context.userId,
      })
      .returning();

    return NextResponse.json(newInterview, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Interviews POST error:', error);
    return NextResponse.json({ error: 'Failed to create interview' }, { status: 500 });
  }
}
